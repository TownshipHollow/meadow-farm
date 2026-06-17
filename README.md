# Meadow Patch VR

A simple peaceful WebXR farming game for Quest Browser and desktop browsers.

## What you can do

- Smooth walk around a small farm.
- Use the hoe to till soil.
- Plant carrot, wheat, tomato, potato, and pumpkin seeds.
- Harvest mature crops to sell them automatically.
- Buy seeds and upgrades from the shop.
- Get natural weather events, including rain that helps crops grow faster.
- Listen to a gentle generated ambient soundtrack after starting the game.

## Controls

On desktop:

- `WASD` or arrow keys to walk.
- Click plots or the shop.
- Number keys `1` to `4` switch Hoe, Plant, Harvest, and Shop.

In VR:

- Trigger interacts with plots and the shop.
- Thumbstick moves smoothly.
- A button cycles the 10-slot wrist inventory on your right arm.
- Squeeze also cycles inventory slots as a fallback.
- Point at the farm stand buttons to buy seeds or upgrades.
- Buying a seed also makes it the active seed for planting.

## Upload to GitHub Pages

Upload these files to your GitHub repository root:

```text
index.html
styles.css
main.js
README.md
```

Then enable Pages from the `main` branch and `/root` folder. Open the Pages URL in Quest Browser.

## Local run

From this folder:

```powershell
& "C:\Users\great\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "C:\Users\great\Documents\Codex\2026-06-16\a-vr-game-with-webxr\work\static-server.mjs"
```

Then open:

```text
http://127.0.0.1:8123/
```
