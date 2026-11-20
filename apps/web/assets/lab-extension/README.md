# Approved Kiki extension logo

User-approved capital K with a green baseline dot. The K is an outline from the
existing UI's Space Grotesk Bold; colors match --ink (#111) and --concept (#34a853).

kiki-extension-icon.svg is the editable vector source. The transparent PNGs are
rendered at 16, 32, 48 and 128 pixels. The web packaging script embeds these flat
files in the download and sets both manifest.icons and action.default_icon, keeping
upstream extension permissions intact. Folder preparation accepts and writes the
icon files when installing or updating an existing iconless Kiki folder.
