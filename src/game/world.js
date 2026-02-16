import { TILE_TYPES, WORLD_HEIGHT, WORLD_WIDTH } from './constants';

const makeGrid = (value) =>
  Array.from({ length: WORLD_HEIGHT }, () => Array(WORLD_WIDTH).fill(value));

const inBounds = (x, y) => x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT;

function setRect(tiles, blocked, x1, y1, x2, y2, tileType, solid = false) {
  for (let y = y1; y <= y2; y += 1) {
    for (let x = x1; x <= x2; x += 1) {
      if (!inBounds(x, y)) {
        continue;
      }
      tiles[y][x] = tileType;
      blocked[y][x] = solid;
    }
  }
}

function setLine(tiles, blocked, x1, y1, x2, y2, tileType, solid = false) {
  if (x1 === x2) {
    const from = Math.min(y1, y2);
    const to = Math.max(y1, y2);
    for (let y = from; y <= to; y += 1) {
      if (!inBounds(x1, y)) {
        continue;
      }
      tiles[y][x1] = tileType;
      blocked[y][x1] = solid;
    }
    return;
  }

  const from = Math.min(x1, x2);
  const to = Math.max(x1, x2);
  for (let x = from; x <= to; x += 1) {
    if (!inBounds(x, y1)) {
      continue;
    }
    tiles[y1][x] = tileType;
    blocked[y1][x] = solid;
  }
}

export function createWorldData() {
  const tiles = makeGrid(TILE_TYPES.GRASS);
  const blocked = makeGrid(false);

  setLine(tiles, blocked, 0, 20, 63, 20, TILE_TYPES.PATH, false);
  setLine(tiles, blocked, 31, 0, 31, 39, TILE_TYPES.PATH, false);

  setRect(tiles, blocked, 36, 8, 56, 18, TILE_TYPES.PATH, false);

  setRect(tiles, blocked, 5, 27, 13, 34, TILE_TYPES.WATER, true);
  setRect(tiles, blocked, 44, 2, 50, 6, TILE_TYPES.WATER, true);

  setRect(tiles, blocked, 2, 4, 27, 4, TILE_TYPES.FENCE, true);
  setRect(tiles, blocked, 2, 25, 27, 25, TILE_TYPES.FENCE, true);
  setRect(tiles, blocked, 2, 4, 2, 25, TILE_TYPES.FENCE, true);
  setRect(tiles, blocked, 27, 4, 27, 25, TILE_TYPES.FENCE, true);

  setRect(tiles, blocked, 4, 6, 7, 6, TILE_TYPES.PATH, false);
  setRect(tiles, blocked, 23, 20, 31, 20, TILE_TYPES.PATH, false);

  setRect(tiles, blocked, 3, 1, 10, 6, TILE_TYPES.HOUSE, true);
  setRect(tiles, blocked, 6, 7, 7, 7, TILE_TYPES.PATH, false);

  setRect(tiles, blocked, 45, 8, 53, 13, TILE_TYPES.SHOP, true);
  setRect(tiles, blocked, 49, 14, 49, 14, TILE_TYPES.PATH, false);

  tiles[11][8] = TILE_TYPES.BIN;

  setRect(tiles, blocked, 55, 26, 61, 33, TILE_TYPES.HOUSE, true);
  setRect(tiles, blocked, 58, 25, 58, 25, TILE_TYPES.PATH, false);

  const farmPlotRect = {
    x1: 4,
    y1: 9,
    x2: 25,
    y2: 24,
  };

  const shopTile = { x: 49, y: 14 };
  const shippingBinTile = { x: 8, y: 11 };
  const sleepTile = { x: 6, y: 7 };

  const npcSchedule = [
    { minute: 6 * 60, x: 58, y: 25 },
    { minute: 9 * 60, x: 40, y: 12 },
    { minute: 13 * 60, x: 30, y: 20 },
    { minute: 17 * 60, x: 15, y: 20 },
    { minute: 20 * 60, x: 58, y: 25 },
  ];

  return {
    tiles,
    blocked,
    farmPlotRect,
    shopTile,
    shippingBinTile,
    sleepTile,
    npcSchedule,
    spawnTile: { x: 8, y: 20 },
  };
}
