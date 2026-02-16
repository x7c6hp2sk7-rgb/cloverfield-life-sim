# Cloverfield Life Sim

A top-down farming and village life simulation inspired by Stardew-style loops.

## Features

- Tile-based top-down world with farm and town areas
- Farming loop: till, water, plant, grow over days, harvest
- In-game day cycle with weather (including rainy auto-watering days)
- NPC daily schedule, movement, and friendship dialogue
- Economy loop with seed shop + shipping bin
- Stamina system and day transition/sleep logic
- Save/load with browser localStorage (`K` to save, `L` to load)

## Controls

- Move: `WASD` or Arrow keys
- Select tool: `1-5`
- Use selected tool: `Space`
- Context interact (talk, buy seed, ship crops): `E`
- Sleep near house door: `N` (after 6:00 PM)
- Save: `K`
- Load: `L`

## Tool Slots

1. Hoe
2. Watering Can
3. Plant Seeds
4. Harvest
5. Talk / Interact

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This project includes `gh-pages` deployment.

1. Create a GitHub repo and set the default branch (usually `main`).
2. Commit/push this project to that repo.
3. Run:

```bash
npm run deploy:gh
```

4. In GitHub repo settings, ensure Pages is configured for the `gh-pages` branch.

## Notes

- Save data is local to each browser profile.
- Art is generated procedurally at runtime for a zero-asset setup.
