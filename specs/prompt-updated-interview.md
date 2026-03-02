# Briefing

I want to create an interactive gallery to view the collection of my graffitis.
The collection consists in one only folder with a set of images sorted chronologically, without subcategories.
Images have tags: `bone` (my previous nickname) and `supi` (my current nickname). Tags are exclusive — each image is either bone or supi, never both.

The user has the choice between the following gallery modes:

- Classic
- Grid
- Explorative
- Experimental

A hidden route `/admin` will allow me to log in in order to add new pictures.

# Source Images

Source directory: `image-sources/` (3 subfolders + 1 file at root):
- `00-photos/` → tag: `bone` (~62 JPGs)
- `01-sketch-bone/` → tag: `bone` (~86 JPGs)
- `02-rip.jpg` → tag: `bone` (single file at root)
- `03-sketch-supi/` → tag: `supi` (~48 JPGs)

Total: ~197 images. Collection will grow to 200–500+.

Filename convention in sources: numeric prefix (`00.jpg`, `01.jpg`, `60.1.jpg`, `00.0.jpg`, `00.1.jpg` for variants). The number is parsed as a float for sort ordering.

**Sort order for initial set**: Folder order first (00→01→02→03), then numeric filename order within each folder. All initial images share placeholder date `2024-01-01`; a `sortOrder` integer (0-indexed, global) is the secondary sort key.

# UI & Interaction

The interface consists in the following elements:

## Header

Title: `SUPI.ER.TO`
Subline: `BONE is dead — long live SUPI.ER.TO — Zürich`
Small decent texts, left aligned. Same font-size for both, title bold.
The header is fixed positioned on the top left on desktop. On mobile it is in-flow (static).

## Options

A group of options, fixed positioned on the top-right on desktop. On mobile it is in-flow, below the header. In this group, the following elements are displayed next to each other, from left to right:

### Images set selector

A select to choose which images are displayed:

- `Everything` (default, all images) — value: `all`
- `SUPI.ER.TO` (tag `supi`) — value: `supi`
- `BONE` (tag `bone`) — value: `bone`

On select, the current gallery mode will refresh with the new image set via a fade transition.

### Gallery mode selector

A button-group with icons-only buttons for each gallery mode. The button for the current mode is marked as active. On click of a button, the current set is refreshed with the new mode via a fade transition.

### Dark mode

A toggle to switch `dark` and `light` modes. Icon-only, only one displayed at the time. Dark-mode is default. Once the user changes the mode, it will be saved in the local storage.

### Logged in options

When I'm logged in, a group of two buttons:

- `New piece arrival`: opens a sheet with the necessary fields to add a new image.
- `Log out`: to log out.

## Gallery module

The components to display the image according to the current gallery mode.
Embed different distinct components for each gallery mode.
When switching modes or filters, a fade transition is used (Framer Motion AnimatePresence).
Memory and resources must be cleaned up when the user changes mode (RAF cancellation, Three.js disposal, etc.).

### Classic

The most simple one. The images are displayed below each other.
The newest images are on the top.
The column has a max width of 1200 pixels and is centered.
Images use the 1280px WebP.
A click on an image launches the fullscreen carousel mode.

### Grid

A masonry grid (using `react-masonry-css` — native CSS masonry is not cross-browser).
The newest images are on the top.
The column has a max width of 2000 pixels and is centered.
According to the current viewport resize, the grid is regenerated to ensure that the columns have a maximal width of approximately 500px.
Images use the 500px WebP thumbnails.
A click on an image launches the fullscreen carousel mode.
On mobile: single column.

### Explorative

A drag-and-pan infinite viewport with all images placed randomly.
Inspiration: https://glyphs.djr.com/
For the positions, imagine a table where all images are mixed and displayed next to each other, vertically and horizontally, without a clear grid, a bit more freestyle.
Each image has a small random rotation of ±8°, to remind the natural feeling of images spread out on a table.
The images can sometimes overlap other images, on their edge only, to avoid hiding their content.
The viewport is infinite via true seamless tiling (3×3 grid of tile copies, modulo wrap). The layout is random per session.
The drag and drop should be very smooth using `@use-gesture/react`. Performance is key.
With a small inertia when the user releases the drag, according to the drag direction (velocity decay of 0.95 per frame).
The system should also work and feel native on touch screens.
On hover of the images, a small full-screen icon-button appears on the top right of the picture. A click on it launches the fullscreen carousel mode.
On mobile (touch devices): single tap on image opens fullscreen carousel directly.

### Experimental

This mode is more experimental. A React Three Fiber (Three.js) scene represents an abstract skyline of buildings.
The buildings are represented with simple boxes (cubic and rectangular).
The look and feel is very minimal. The volume of the cubes is visible with very light directional light.
In light mode the scene is mostly white (#F0F0F0), with light grey shadows.
In dark mode it's mostly dark grey (#2A2A2A), with lighter grey tones.

**Building structure**: Each building has a rooftop structure (stairhouse, AC enclosure, parapet wall) — a smaller box on top. Graffiti are placed on the vertical walls of these rooftop structures (as if someone painted from the rooftop). One graffiti per building.

**City layout**: Large finite city, random generative each page load. ~N buildings for N images. Grid-based placement with random jitter.

**Camera**: By default the camera auto-navigates from graffiti to graffiti slowly (~10 seconds per piece), with eased/lerped transitions. The camera is positioned at a slight elevation, facing each graffiti wall directly.

User can use orbital controls to control the camera, which cancels the automatic movement. If the user stops interacting, the camera waits 4 seconds then resumes auto-navigation.

If a user clicks on a graffiti, the camera moves to face that graffiti. Then after 4 seconds the camera resumes automatic navigation.
**No fullscreen carousel** from the Experimental mode — clicking just zooms the camera.

Performance: frustum culling (Three.js built-in), fade-in for buildings on mount. Memory cleanup on unmount (dispose all geometries, materials, textures).

### Fullscreen carousel mode

Library: `yet-another-react-lightbox` (YARL).
This mode is displayed above the gallery, keeping the view as it was before the carousel is displayed.
The carousel is displayed in a full screen dialog/modal, with icon-only (cross) close button on the top-right corner, and `Esc` shortcut to close.
The background of the dialog is `rgba(0,0,0,0.85)` for dark mode and `rgba(255,255,255,0.85)` for light mode.
The images are displayed full screen with a padding of 5vw.
The user can swap images by swiping (drag on desktop) or by using prev/next icon-only arrow buttons (middle vertically, left/right edges horizontally).
**Navigation respects the active filter**: if "SUPI.ER.TO" filter is active, carousel only cycles through supi images.
**URL deep linking**: when a carousel is opened, the URL updates to `?image={id}`. Navigating directly to `/?image={id}` opens the default (Classic) mode with the carousel overlay at that image.

## Responsiveness

On mobile the header and the options bar are not fixed. They are displayed below each other at the top of the page (in document flow).
For the grid mode, images are displayed in a single column.
The gutter is 20px.

# Look and feel

Font: DM Mono (Google Fonts monospace)
The look and feel is very minimalistic and compact.
Based on the default theme of shadcn.
Most changes are done on the shadcn config level (override CSS variables).
When buttons are icon only, a tooltip is displayed on hover.
Texts and tooltips are small (text-xs).
The icons are simple abstract line SVGs, 24×24px, crispy lines, created inline (not a library), with a coherent style for all icons. strokeWidth=1.5, fill=none, round caps.
There are no shadows (override globally).
Borders have 1px width.
Text inputs and buttons always have the same font size as body text.
Buttons and boxes have 2px border radius (override shadcn default).

# Admin

I'll get logged in using GitHub OAuth (next-auth). Only my specific GitHub username can log in (whitelist via env var `ALLOWED_GITHUB_USERNAME`). The admin route is the same Netlify site.

The list of images is stored in `public/data/images.json`.

**New piece arrival form fields**:
1. Image file upload (JPG or PNG, no size limit)
2. Preview: show the uploaded image before submitting
3. Date: defaults to today, editable
4. Tag: radio group (bone / supi)
5. Sort order: number input (order within same date)

When a new image is added:
1. A Netlify Function receives the image, compresses it to 3 WebP sizes using Sharp, and makes a single atomic GitHub API commit (3 WebP files + updated `images.json`). This triggers one Netlify rebuild.
2. The admin session sees the new image immediately in the UI (React state) while the rebuild runs in background (~1 minute).
3. Public visitors see the image after the rebuild completes.

No update or delete features needed.

# Images Processing

**Compression**: Sharp (Node.js), WebP output, quality 82 (≈ Photoshop Save for Web 80).
**Source directory**: `image-sources/` (not deployed, not in `public/`).
**Output directory**: `public/images/`
**Responsive sizes**: 500px wide (thumbnail), 1280px wide (medium), 2400px wide (full)
**Script**: `scripts/process-images.ts`, run with `npm run process-images`

For each source image, 3 WebP files are created:
- `{id}.500.webp`
- `{id}.1280.webp`
- `{id}.2400.webp`

Image data stored in `public/data/images.json`:
```json
{
  "id": "photos-00",
  "filename": "photos-00.webp",
  "date": "2024-01-01",
  "sortOrder": 0,
  "tag": "bone"
}
```

# Tech Stack

- Responsive React & Next.js SPA (App Router, TypeScript), hosted on Netlify.
- Tailwind CSS for styling.
- UI components from shadcn/ui.
- GitHub OAuth via next-auth for admin authentication.
- GitHub REST API for admin image commits (atomic multi-file commit).
- Framer Motion for mode transitions.
- `@use-gesture/react` for drag interactions (Explorative mode, best touch feel).
- `react-masonry-css` for masonry grid (native CSS masonry not cross-browser).
- `yet-another-react-lightbox` for fullscreen carousel.
- React Three Fiber + @react-three/drei for Three.js Experimental mode.
- Sharp for image compression (build script + Netlify Function).
- `@octokit/rest` for GitHub API.

Important: clean the memory and resources between the different modes, when the user changes mode.

# Implementation Specs

See individual phase files in this directory:
- `00-overview.md` — Architecture, all decisions, environment variables
- `01-setup-image-processing.md` — Project setup, image compression script
- `02-data-layer-types.md` — TypeScript types, data utilities, state management
- `03-layout-ui.md` — Header, OptionsBar, icons, LoadableImage, page structure
- `04-classic-grid-modes.md` — Classic and Grid gallery modes
- `05-explorative-mode.md` — Explorative infinite canvas mode
- `06-experimental-threejs.md` — Experimental Three.js mode
- `07-carousel-deeplinks.md` — Fullscreen carousel and URL deep links
- `08-admin-upload.md` — Admin auth, form, Netlify Function
- `09-deployment-verification.md` — Deployment config and verification checklist
