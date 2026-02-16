export const TILE_SIZE = 32;
export const WORLD_WIDTH = 64;
export const WORLD_HEIGHT = 40;

export const TOOL_ORDER = ['hoe', 'water', 'seed', 'harvest', 'talk'];

export const TOOL_LABELS = {
  hoe: 'Hoe',
  water: 'Watering Can',
  seed: 'Plant Seeds',
  harvest: 'Harvest',
  talk: 'Talk / Interact',
};

export const TILE_TYPES = {
  GRASS: 'grass',
  PATH: 'path',
  WATER: 'water',
  FENCE: 'fence',
  HOUSE: 'house',
  SHOP: 'shop',
  BIN: 'bin',
};

export const TILE_TEXTURES = {
  [TILE_TYPES.GRASS]: 'tile-grass',
  [TILE_TYPES.PATH]: 'tile-path',
  [TILE_TYPES.WATER]: 'tile-water',
  [TILE_TYPES.FENCE]: 'tile-fence',
  [TILE_TYPES.HOUSE]: 'tile-house',
  [TILE_TYPES.SHOP]: 'tile-shop',
  [TILE_TYPES.BIN]: 'tile-bin',
};

export const NPC_NAME = 'Mira';

export const WEATHER_TYPES = ['Sunny', 'Cloudy', 'Rainy'];
