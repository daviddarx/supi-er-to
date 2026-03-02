# Phase 9: Deployment & Verification

## 9.1 netlify.toml

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  directory = "netlify/functions"
  node_bundler = "nft"
  included_files = ["node_modules/sharp/**"]

# Redirect all routes to Next.js (handled by the plugin, but explicit for safety)
[[redirects]]
  from = "/*"
  to = "/.netlify/functions/___netlify-handler"
  status = 200
```

Install the Netlify Next.js plugin:

```bash
npm install --save-dev @netlify/plugin-nextjs
```

---

## 9.2 Environment Variables

Set these in both `.env.local` (local dev) and the Netlify dashboard (production):

| Variable | Description | Where |
|---|---|---|
| `GITHUB_ID` | GitHub OAuth App client ID | Netlify dashboard + .env.local |
| `GITHUB_SECRET` | GitHub OAuth App client secret | Netlify dashboard + .env.local |
| `GITHUB_TOKEN` | Personal access token, scope: `repo` | Netlify dashboard only |
| `GITHUB_REPO` | Format: `owner/repo-name` | Netlify dashboard + .env.local |
| `GITHUB_REPO_OWNER` | Your GitHub username or org | Netlify dashboard + .env.local |
| `ALLOWED_GITHUB_USERNAME` | Your GitHub username (admin whitelist) | Netlify dashboard + .env.local |
| `NEXTAUTH_SECRET` | Random string (see generation below) | Netlify dashboard + .env.local |
| `NEXTAUTH_URL` | Production URL (e.g. `https://supi-er-to.netlify.app`) | Netlify dashboard only |

**Generate NEXTAUTH_SECRET**:
```bash
openssl rand -base64 32
```

**GITHUB_TOKEN scope**:
- Classic token: `repo` (full repository access)
- Fine-grained token: `Contents: Read and write` on the specific repo

---

## 9.3 GitHub OAuth App Setup

1. Go to `github.com/settings/developers` → "OAuth Apps" → "New OAuth App"
2. Application name: `SUPI.ER.TO Admin`
3. Homepage URL: `https://supi-er-to.netlify.app` (your Netlify URL)
4. Authorization callback URL: `https://supi-er-to.netlify.app/api/auth/callback/github`
5. Copy "Client ID" → set as `GITHUB_ID`
6. Click "Generate a new client secret" → set as `GITHUB_SECRET`

For local development, create a **second** OAuth App (or update the same one temporarily):
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`

---

## 9.4 Pre-Deployment Checklist

Before the first deploy:

```bash
# 1. Process all source images (generates WebP files + images.json)
npm run process-images

# Verify output
ls public/images/*.webp | wc -l        # should be ~591 (197 × 3)
cat public/data/images.json | python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data), 'images')"

# 2. Build locally to catch TypeScript errors
npm run build

# 3. Check .env.local has all required variables
cat .env.local

# 4. Test admin locally
netlify dev   # requires netlify-cli: npm install -g netlify-cli
# Then: navigate to http://localhost:8888/admin
```

---

## 9.5 Local Development with Netlify Functions

Netlify Functions (including the upload function) require the Netlify CLI to run locally:

```bash
npm install -g netlify-cli
netlify link    # links to your Netlify site (one-time setup)
netlify dev     # starts Next.js + Netlify Functions on http://localhost:8888
```

Without `netlify dev`, the admin upload will fail (Netlify Function not available). The rest of the app works with `npm run dev`.

---

## 9.6 next.config.ts Considerations

For static export with Netlify:

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",        // generates static files
  images: {
    unoptimized: true,     // images are pre-processed via Sharp
  },
  trailingSlash: false,
}

export default nextConfig
```

**Note**: With `output: "export"`, next-auth API routes need special handling. The `@netlify/plugin-nextjs` handles this automatically — do not manually configure next-auth redirects.

---

## 9.7 Deployment Workflow

**First deploy**:
1. Run `npm run process-images` locally → images in `public/images/`, JSON in `public/data/`
2. Commit everything: `git add public/images/ public/data/images.json`
3. Push to GitHub → Netlify auto-deploys

**Adding new images (admin flow)**:
1. Navigate to `{site-url}/admin`
2. Log in with GitHub
3. Click "New piece arrival"
4. Upload image, set date/tag/sort order
5. Preview and submit
6. GitHub commit triggered → Netlify rebuilds (~1 min)
7. Image visible to public after rebuild; visible to admin immediately in session

---

## 9.8 End-to-End Verification Checklist

### Image Pipeline
- [ ] `npm run process-images` completes without errors
- [ ] `public/images/` contains `{id}.500.webp`, `{id}.1280.webp`, `{id}.2400.webp` for all 197 source images (~591 files total)
- [ ] `public/data/images.json` has exactly 197 entries, all with valid `id`, `date`, `sortOrder`, `tag`
- [ ] Sort order in JSON reflects folder order (00-photos entries before 01-sketch-bone entries)

### Classic Mode
- [ ] Images load with placeholder → fade-in transition
- [ ] Images are newest-first (check dates)
- [ ] Click an image → YARL carousel opens
- [ ] Carousel: Esc closes, left/right arrows navigate, X button closes
- [ ] Carousel: backdrop click closes
- [ ] URL updates to `?image={id}` when carousel opens, removed when closed
- [ ] Navigate to `/?image=photos-00` directly → Classic mode + carousel open at correct image

### Grid Mode
- [ ] Masonry layout renders correctly
- [ ] Columns are approximately 500px wide
- [ ] Resize viewport → columns recalculate
- [ ] Mobile (narrow viewport) → single column
- [ ] Click image → carousel opens

### Explorative Mode
- [ ] Canvas fills full viewport
- [ ] Images are randomly scattered with different rotations
- [ ] Drag pans the canvas (mouse)
- [ ] Drag on touch device (mobile) pans the canvas without browser scroll
- [ ] Release drag → inertia coasting
- [ ] Drag far left/right/up/down → images seamlessly repeat (seamless tiling)
- [ ] Hover over image → fullscreen button appears (desktop)
- [ ] Click fullscreen button → carousel opens at that image
- [ ] On mobile, tap image → carousel opens

### Experimental Mode
- [ ] 3D city renders without errors
- [ ] Building bodies and rooftop structures visible
- [ ] Graffiti textures appear on rooftop structure walls
- [ ] Camera auto-pilots slowly between graffiti pieces
- [ ] Orbital controls work (mouse drag rotates/pans)
- [ ] After 4 seconds of no interaction → auto-pilot resumes
- [ ] Click a graffiti image → camera moves to face it
- [ ] Works on mobile touch

### Dark / Light Mode
- [ ] Default is dark mode
- [ ] Toggle switches mode
- [ ] Mode persists on page refresh (localStorage)
- [ ] All gallery modes look correct in both modes
- [ ] Carousel backdrop: black in dark, white in light
- [ ] LoadableImage placeholder: same subtle grey in both modes

### Filter
- [ ] "Everything" shows all 197 images
- [ ] "SUPI.ER.TO" shows only supi-tagged images
- [ ] "BONE" shows only bone-tagged images
- [ ] Switching filter: fade transition, new image set
- [ ] Open carousel with SUPI filter active → prev/next only cycles SUPI images

### Mode Transitions
- [ ] Switching between any two modes triggers a fade-out/fade-in transition
- [ ] No visual artifacts during transition

### Mobile Responsiveness
- [ ] Header is not fixed (in-flow at top of page)
- [ ] OptionsBar is not fixed (in-flow below header)
- [ ] Grid mode collapses to single column
- [ ] All text is readable
- [ ] Explorative touch drag works without triggering browser scroll
- [ ] Experimental Three.js renders on mobile WebGL

### Admin Flow
- [ ] Navigate to `/admin` → redirected to GitHub OAuth
- [ ] Log in with correct GitHub account → admin UI appears
- [ ] Log in with wrong GitHub account → denied / redirected
- [ ] Upload a JPG → preview appears in sheet
- [ ] Set date, tag, sort order
- [ ] Submit → success response
- [ ] New image appears in admin session immediately (React state)
- [ ] Check GitHub repo → new commit with 4 files (3 WebP + updated images.json)
- [ ] Wait for Netlify rebuild → image appears publicly in gallery
- [ ] Log out → session cleared, redirected to home

### Performance
- [ ] Initial page load: images don't load until near viewport (check network tab)
- [ ] Classic mode: no images load until scrolled near them
- [ ] Switching from Experimental back to Classic: Three.js resources disposed (no memory leak; monitor in browser DevTools)
- [ ] Explorative with 200+ images: no jank during drag (check 60fps in performance tab)
