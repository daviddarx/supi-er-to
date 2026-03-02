# Briefing

I want to create an interactive gallery to view the collection of my graffitis.
The collection consists in one only folder with a set of images sorted chronologically, without subcategories.
Images have tags: `bone` (my previous nickname) and `supi` (my current nickname).

The user has the choice between the following gallery modes:

- Classic
- Grid
- Explorative
- Experimental

A hidden route `/admin` will allow me to log in in order to add new pictures.

# UI & Interaction

The interface consists in the following elements:

## Header

Title: `SUPI.ER.TO`
Subline: `BONE is dead — long live SUPI.ER.TO — Zürich`
Small decent texts, left aligned. Same font-size for both, title bold.
The header is fixed positioned on the top left.

## Options

A group of options, fix posioned on the top-right. In this group, the following elements are dipslayed next to each others, from left to right:

### Images set selector

A select to choose which images are displayed:

- `Everything` (default, all images)
- `SUPI.ER.TO` (tag `supi`)
- `BONE` (tag `bone`)

On select, the current gallery mode will refresh with the new image set.

### Gallery mode selector

A button-group with icons-only buttons for each gallery mode. The button for the current mode is marked as active. On click of a button, the current set is refreshed with the new mode.

### Dark mode

A toggle to switch `dark` and `light` modes. Icon-only, only one displayed at the time. Dark-mode is default. Once the user change the mode, it will be saved in the local storage.

### Logged in options

When I'm logged in, a group of two buttons:

- `New piece arrival`: opens a sheet with the necessary fields to add a new image.
- `Log out`: to log out.

## Gallery module

The components to display the image according to the current gallery mode.
Embed different distinct components for each gallery mode:

### Classic

The most simple one. The images are displayed below each other.
The newest images are on the top.
The column as a max width of 1200 pixels and is centered.
A click on an image launches the fullscreen carousel mode.

### Grid

A masonry grid.
The newest images are on the top.
The column as a max width of 2000 pixels and is centered.
According to the current viewport resize, the grid is regenerated to ensure that the colums have a maximal width of approximately 500px.
A click on an image launches the fullscreen carousel mode.

### Explorative

A drag-n-drop infinite viewport with all images placed randomly.
Inspiration: https://glyphs.djr.com/
For the positions, imagine a table where all images are mixed and displayed next to each other, vertically and horizontaly, without a clear grid, a bit more freestyle.
Each image has a small random rotation, to remind the natural feeling of images spread out on a table.
The images can be sometimes a bit overlapping other images, on their edge only, to avoid hidding their content.
The viewport is infinite. If user drags a lot, he will start to see again the first images that he saw at first.
But the goal is to spread all the image randomly first (virtually, to spare performances), to give the best overview.
The drag and drop should be very smooth. Performance is key, like on the reference.
With a small inertia when the user release the drag, according to the drag direction.
The system should also work and feel native on touch screens.
On hover of the images, a small full-screen icon-button appears on the top right of the picture. A click on it launches the fullscreen carousel mode.

### Experimental

This mode is more experimental. A threejs scene represent an abstract sky-line of buildings.
The buildings are represented with simple cubes, cubic and rectangular.
The look and feel is very minimal. The volume of the cubes are visible with very light shadows.
In light mode the scene is mostly white, with light grey shadows.
In dark mode it's mostly dark grey, with lighter grey shadow.
The scene represents the rooftops of the skyline.
On this rooftop my graffiti are placed randomly on the "walls".
One graffiti pro roof top.
By default, if the user doesn't interact, the camera is navigating through the skyline, a bit higher positioned than the buildingd.
It navigates from graffiti to graffiti slowly.
User can use orbital controls to control the camera, which automatic move is cancelled for a while after the interacts.
If the user stop interacting the camera will wait for a few seconds to start it's move again.
Like for the explorative view, the landscape of the skyline is virtually unlimited.
It only displays the building until a limit of xxx pixels to enhance performance.
As the camera move, new buildings are displayed in the far, with fade-in.
If a user clicks on a graffiti, the camera moves to display the graffiti in front of the camera, bigger.
After a while again the camera starts to move again.

### Fullscreen carousel mode

This mode is displayed above the gallery, in the different modes, keeping the view as it was before the carzel is displayed.
The carousel is displayed in a full screen dialog/modal, with icon-only (cross) close button on the top-right corner, and `Esc` shortcut to close.
The background of the dialog is white for the light mode and black for the dark mode, each with 0.8 opacity.
The image are displayed full screen, similar to css background-image cover mode.
The images have a padding of 5vw.
The user can swap images in a chronological order (the same as in the gallery below) by swiping (drag n drop on desktop) or by using prev/next icon-only (arrows), which are placed in the middle vertically and on the edges horizontally (prev left, next right).

## Responsiveness

On mobile the header and the options aren't fixed. They are displayed below each other at the top of the page.
For the grid mode, images are displayed below each others.
The gutter is 20px.

# Look and feel

Font: https://fonts.google.com/specimen/DM+Mono?categoryFilters=Appearance:%2FMonospace%2FMonospace
The look and feel is very minimalistic and compact.
Based on the default theme of shadcn.
Most changes are done on the shadcn config level.
When buttons are icon only, a tooltip is displayed on hover.
Texts and tooltips are small.
The icons are simple abstract line svgs, 24x24px, crispy lines, created by you, with a coherent style for all icons.
There is no shadows.
Borders have 1px width.
Text inputs and buttons have always the same font size.
Button and boxes have 2px border radius.

# Admin

I'll get logged in using github auth.
The list of images is stored in a local JSON file.
When I add a new image, it will update this JSON.
No need to update or delete features.

# Images Processing

All images (base set and added through admin) are compressed, equivalent to photoshop's save for the web with quality 800.
While creating the project, you'll find the base set here @images-sources. Make a first compression for them too.
For compressing use a library or vanilla node to do it locally, But don't send the pictures in your context to avoid overcharging it.
For each mode, define targeted sizes for responsive images (thumnails, fullscreen, etc) on the several common viewports.
Also create compressed image for theses targeted sizes.

# Tech Stack & Briefing

- Responsive React & Nextjs SPA, hosted on Netlify.
- Tailwin for styling.
- UI components from shadcn.
- Github for auth and manage file-based db.

Important: clean the memory and ressources between the different modes, when the user changes mode.

## Drag'n'Drop

What is the best library for it? Feeling on touchscreen should be as native as possible.

## Masonry Grid

Is it now possible to do it with native css? if not, what is the best library?

## Full-screen carousel mode

I had nice experiences with https://yet-another-react-lightbox.com/examples, which also manage the modal. Is there better libaries? You could also use shadcn dialog and a carrousel libary like swiper.

## Performance & Images Loading

Performances: images are loaded only once they are visible on the viewport, or even more ideally, their loading starts just before they're gonna enter the viewport, to enhance loading time. Create a component for loadable images, with a slight background (white/black with 0.05 opacity, depending on the light mode.) as preview (with already correct aspec ratio, even if image isn't loaded already). Once image is loaded, fade it in above the background.
