import { Octokit } from "@octokit/rest"

export interface CommitFile {
  path: string
  content: Buffer
  encoding: "base64" | "utf-8"
}

/**
 * Commits one or more files to a GitHub repository in a single atomic commit.
 *
 * Flow: getRef → createBlob(s) → createTree → createCommit → updateRef
 *
 * @param files - Array of file descriptors (path + Buffer content)
 * @param message - Git commit message
 * @param options - GitHub token, owner, repo, and optional branch (default: "main")
 * @throws Error if any GitHub API call fails
 */
export async function commitFiles(
  files: CommitFile[],
  message: string,
  options: {
    token: string
    owner: string
    repo: string
    branch?: string
  }
): Promise<void> {
  const { token, owner, repo, branch = "main" } = options
  const octokit = new Octokit({ auth: token })

  // 1. Get the current HEAD SHA
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  })
  const latestCommitSha = refData.object.sha

  // 2. Create a blob for each file (always base64-encoded for binary safety)
  const blobs = await Promise.all(
    files.map((file) =>
      octokit.git.createBlob({
        owner,
        repo,
        content: file.content.toString("base64"),
        encoding: "base64",
      })
    )
  )

  // 3. Create a new tree on top of the current HEAD
  const { data: treeData } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: latestCommitSha,
    tree: files.map((file, i) => ({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blobs[i].data.sha,
    })),
  })

  // 4. Create the commit object
  const { data: commitData } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeData.sha,
    parents: [latestCommitSha],
  })

  // 5. Move the branch ref to the new commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commitData.sha,
  })
}
