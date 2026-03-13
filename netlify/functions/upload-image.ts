import type { Handler } from "@netlify/functions"
import sharp from "sharp"
import { Octokit } from "@octokit/rest"
import { commitFiles } from "../../src/lib/github"
import type { GalleryImage } from "../../src/types"

/**
 * Validates a GitHub OAuth token by calling the /user endpoint and returns
 * the authenticated user's login name, or null if the token is invalid.
 *
 * @param token - GitHub OAuth access token from the Authorization header
 * @returns GitHub login string, or null on failure
 */
async function validateGithubToken(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "supi-er-to-admin",
    },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { login: string }
  return user.login
}

/**
 * Fetches the current images.json from the GitHub repo and parses it.
 * Returns an empty array if the file does not exist yet.
 *
 * Uses the server-side GITHUB_TOKEN (not the user's OAuth token) so this
 * call works even if the user's token has limited scopes.
 *
 * @param token - GitHub personal access token with repo read access
 * @param owner - Repository owner
 * @param repo  - Repository name
 * @returns Parsed array of GalleryImage entries
 */
async function fetchCurrentImages(
  token: string,
  owner: string,
  repo: string
): Promise<GalleryImage[]> {
  const octokit = new Octokit({ auth: token })

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: "public/data/images.json",
    })

    // getContent returns an array for directories; single file is an object with `content`
    if ("content" in data && typeof data.content === "string") {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8")
      return JSON.parse(decoded) as GalleryImage[]
    }
  } catch {
    // File doesn't exist yet — start with an empty array
  }

  return []
}

/**
 * Generates the next sequential ID for a given tag by scanning existing images
 * to find the highest numeric suffix for that tag prefix.
 *
 * Returns "{tag}-1" if no images with that tag exist yet.
 * Ignores IDs that do not match the "{tag}-{digits}" pattern (e.g. old
 * "img-{timestamp}" entries are safely skipped by the `startsWith` guard).
 *
 * @param tag           - The tag ("supi" | "bone") for the new image
 * @param existingImages - Current images.json entries from the repository
 * @returns             New ID string, e.g. "supi-198" or "bone-1"
 *
 * @example
 *   // images.json contains supi-1 through supi-197
 *   generateNextId("supi", images) // → "supi-198"
 *   // images.json has no "bone" entries
 *   generateNextId("bone", images) // → "bone-1"
 */
function generateNextId(tag: "supi" | "bone", existingImages: GalleryImage[]): string {
  const prefix = `${tag}-`
  // Match exactly "{tag}-{digits}" — the startsWith guard prevents false matches
  // from other tags or legacy "img-{timestamp}" IDs
  const pattern = new RegExp(`^${tag}-(\\d+)$`)

  let maxNum = 0
  for (const img of existingImages) {
    // Skip any ID that doesn't start with this tag's prefix (covers legacy img-{ts} IDs)
    if (!img.id.startsWith(prefix)) continue
    const match = img.id.match(pattern)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  return `${tag}-${maxNum + 1}`
}

/**
 * Netlify Function: upload-image
 *
 * Accepts a base64-encoded image from the admin panel, compresses it to
 * three WebP sizes via Sharp, then commits all three images plus an updated
 * images.json to the GitHub repository in a single atomic commit.
 *
 * Authentication: the caller must supply a valid GitHub OAuth access token
 * (from next-auth) in the Authorization header. The token is validated
 * against the GitHub API and the ALLOWED_GITHUB_USERNAME allowlist.
 *
 * Request body (JSON):
 *   - file:      base64-encoded image bytes
 *   - mimeType:  MIME type (e.g. "image/jpeg")
 *   - date:      ISO date string (YYYY-MM-DD)
 *   - tag:       "supi" | "bone"
 *   - sortOrder: numeric sort position within the date
 *
 * Response body (JSON):
 *   - success: true
 *   - image:   GalleryImage entry that was committed
 */
const handler: Handler = async (event) => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = event.headers["authorization"] ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "No authorization token provided" }),
    }
  }

  const githubLogin = await validateGithubToken(token)
  if (githubLogin === null) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Invalid or expired GitHub token" }),
    }
  }
  if (githubLogin !== process.env.ALLOWED_GITHUB_USERNAME) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Unauthorized user" }),
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  if (!event.body) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Request body is empty" }),
    }
  }

  let body: {
    file?: string
    mimeType?: string
    date?: string
    tag?: string
    sortOrder?: number
  }

  try {
    body = JSON.parse(event.body) as typeof body
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Invalid JSON body" }),
    }
  }

  const { file: base64File, date, tag, sortOrder = 0 } = body

  if (!base64File || !date || !tag) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Missing required fields: file, date, tag" }),
    }
  }

  if (tag !== "supi" && tag !== "bone") {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: 'tag must be "supi" or "bone"' }),
    }
  }

  // Validate date is a real YYYY-MM-DD calendar date (regex + parse check)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Invalid date format; expected YYYY-MM-DD" }),
    }
  }

  const parsedSortOrder = Number(sortOrder)
  if (
    !Number.isFinite(parsedSortOrder) ||
    !Number.isInteger(parsedSortOrder) ||
    parsedSortOrder < 0 ||
    parsedSortOrder > 9999
  ) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "sortOrder must be an integer between 0 and 9999" }),
    }
  }

  // ── Image processing ──────────────────────────────────────────────────────
  const imageBuffer = Buffer.from(base64File, "base64")

  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
  if (!ALLOWED_MIME_TYPES.includes(body.mimeType || "")) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Invalid file type; must be JPEG, PNG, or WebP" }),
    }
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
  if (imageBuffer.length > MAX_FILE_SIZE) {
    return {
      statusCode: 413,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "File too large; maximum 50 MB" }),
    }
  }

  // Three output sizes per the spec: thumbnail, standard, full-res
  const SIZES = [500, 1280, 2400] as const

  let compressedBuffers: Buffer[]
  try {
    compressedBuffers = await Promise.all(
      SIZES.map((width) =>
        sharp(imageBuffer)
          .resize(width, undefined, {
            // Never upscale images smaller than the target width
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer()
      )
    )
  } catch (err) {
    console.error("Sharp processing error:", err)
    return {
      statusCode: 422,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Image processing failed — ensure file is a valid image" }),
    }
  }

  // Capture intrinsic dimensions from the 2400px output buffer (index 2 = 2400px).
  // SIZES is [500, 1280, 2400] so index 2 is always the 2400px variant.
  const meta2400 = await sharp(compressedBuffers[2]).metadata()
  const intrinsicWidth = meta2400.width ?? 0
  const intrinsicHeight = meta2400.height ?? 0

  // ── GitHub commit ─────────────────────────────────────────────────────────
  const repoOwner = process.env.GITHUB_REPO_OWNER!
  // GITHUB_REPO is stored as "owner/repo" in env; we only need the repo part here
  const repoName = process.env.GITHUB_REPO!.split("/")[1]
  const githubToken = process.env.GITHUB_TOKEN!

  const currentImages = await fetchCurrentImages(githubToken, repoOwner, repoName)

  // Derive the next sequential ID for this tag, e.g. "supi-198" or "bone-1"
  const id = generateNextId(tag as "supi" | "bone", currentImages)

  const newEntry: GalleryImage = {
    id,
    filename: `${id}.webp`,
    date,
    sortOrder: parsedSortOrder,
    tag: tag as "bone" | "supi",
    width: intrinsicWidth,
    height: intrinsicHeight,
  }

  // Append the new entry; sorting is handled at read time by the gallery
  const updatedImages = [...currentImages, newEntry]

  try {
    await commitFiles(
      [
        {
          path: `public/images/${id}.500.webp`,
          content: compressedBuffers[0],
          encoding: "base64",
        },
        {
          path: `public/images/${id}.1280.webp`,
          content: compressedBuffers[1],
          encoding: "base64",
        },
        {
          path: `public/images/${id}.2400.webp`,
          content: compressedBuffers[2],
          encoding: "base64",
        },
        {
          path: "public/data/images.json",
          // JSON is committed as base64 for consistency with the binary files
          content: Buffer.from(JSON.stringify(updatedImages, null, 2), "utf-8"),
          encoding: "base64",
        },
      ],
      `Add new piece: ${id} (${tag}, ${date})`,
      {
        token: githubToken,
        owner: repoOwner,
        repo: repoName,
      }
    )
  } catch (err) {
    console.error("GitHub commit error:", err)
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to commit to GitHub — check server logs" }),
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, image: newEntry }),
  }
}

export { handler }
