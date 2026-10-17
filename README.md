# Gem Heist - CS42 Week 09 (Enemy AI Pathfinding with EasyStar)

## Run it
Browsers block loading the map/images from file://, so serve the folder:

    cd CS42-Week09
    python3 -m http.server 8000      # then open http://localhost:8000
    (or use VS Code "Live Server")

## Controls
- Arrow keys / WASD: move      - Click / tap a tile: walk there (EasyStar finds the route)
- P: show/hide AI path lines   - M: mute

## Requirements checklist
- Keyboard AND pointer input.
- EasyStar enemy AI (easystar-0.4.4.js, provided utilities in script.js):
  - Hunter (red): paths to the player.
  - Ambusher (orange): paths to a tile ahead of the player.
  - Thief (purple): paths to the nearest collectible gem and steals it.
- Tile map: assets/map.json (Tiled JSON) + assets/tiles.png. Tile properties
  `collides` and `score` (movement cost) feed EasyStar; `slow` makes mud slow movement.
  Object layers "Spawns" and "Gems" hold start positions and gem locations.
- External assets: tileset, 6 sprites, 6 sound effects in /assets.

## Troubleshooting
If something fails to load or crashes, a red message box appears at the bottom of the page
naming the file or error. The whole `CS42-Week09` folder (including `assets/`) must be uploaded
with its structure intact, and the page must be opened through the web server, not from the zip.
