import { TILE_SIZE, TILE_TYPES } from './constants';

const TILE_VARIANT_COUNTS = {
  [TILE_TYPES.GRASS]: 4,
  [TILE_TYPES.PATH]: 3,
  [TILE_TYPES.WATER]: 4,
};

function hashInt(x, y, seed = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  n = (n ^ (n >> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n ^ (n >> 16)) >>> 0;
}

export function coordNoise(x, y, seed = 0) {
  return hashInt(x, y, seed) / 4294967295;
}

function pickVariant(type, x, y) {
  const count = TILE_VARIANT_COUNTS[type] ?? 1;
  if (count <= 1) {
    return 0;
  }

  return hashInt(x, y, 41) % count;
}

export function getTileTextureKey(type, x, y, waterFrame = 0) {
  if (type === TILE_TYPES.GRASS) {
    return `tile-grass-${pickVariant(type, x, y)}`;
  }

  if (type === TILE_TYPES.PATH) {
    return `tile-path-${pickVariant(type, x, y)}`;
  }

  if (type === TILE_TYPES.WATER) {
    const offset = pickVariant(type, x, y);
    return `tile-water-${(offset + waterFrame) % 4}`;
  }

  if (type === TILE_TYPES.FENCE) {
    return 'tile-fence';
  }

  if (type === TILE_TYPES.HOUSE) {
    return 'tile-house';
  }

  if (type === TILE_TYPES.SHOP) {
    return 'tile-shop';
  }

  if (type === TILE_TYPES.BIN) {
    return 'tile-bin';
  }

  return 'tile-grass-0';
}

function createTexture(scene, key, width, height, paint) {
  const tex = scene.textures.createCanvas(key, width, height);
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  paint(ctx, width, height);
  tex.refresh();
}

function rect(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function px(ctx, color, x, y) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawGrassTile(scene, key, variant) {
  const tones = ['#6aa865', '#619f5d', '#78b674', '#8dc88a'];
  const flowerA = '#f8e5a0';
  const flowerB = '#eb8cc2';

  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x + variant * 31, y, 5);
        if (n < 0.23) {
          px(ctx, tones[0], x, y);
        } else if (n < 0.68) {
          px(ctx, tones[1], x, y);
        } else if (n < 0.9) {
          px(ctx, tones[2], x, y);
        } else {
          px(ctx, tones[3], x, y);
        }
      }
    }

    for (let i = 0; i < 36; i += 1) {
      const sx = hashInt(i, variant, 17) % TILE_SIZE;
      const sy = hashInt(i, variant, 29) % TILE_SIZE;
      const blade = hashInt(i, variant, 47) % 2 === 0 ? '#507f4f' : '#8fd38f';
      px(ctx, blade, sx, sy);
      if (sy > 0) {
        px(ctx, '#3f6a3f', sx, sy - 1);
      }
    }

    for (let i = 0; i < 4; i += 1) {
      const sx = hashInt(i, variant, 67) % 28 + 2;
      const sy = hashInt(i, variant, 79) % 28 + 2;
      const flower = i % 2 === 0 ? flowerA : flowerB;
      px(ctx, flower, sx, sy);
      px(ctx, '#fdf7de', sx + 1, sy);
      px(ctx, '#fdf7de', sx, sy + 1);
    }
  });
}

function drawPathTile(scene, key, variant) {
  const tones = ['#b68f63', '#c39f74', '#a57f56', '#8c6a46'];

  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x + variant * 13, y, 11);
        if (n < 0.18) {
          px(ctx, tones[3], x, y);
        } else if (n < 0.6) {
          px(ctx, tones[0], x, y);
        } else if (n < 0.86) {
          px(ctx, tones[1], x, y);
        } else {
          px(ctx, tones[2], x, y);
        }
      }
    }

    for (let i = 0; i < 40; i += 1) {
      const sx = hashInt(i, variant, 101) % TILE_SIZE;
      const sy = hashInt(i, variant, 107) % TILE_SIZE;
      px(ctx, '#7b5a3b', sx, sy);
    }

    rect(ctx, '#c8aa82', 0, 0, TILE_SIZE, 1);
    rect(ctx, '#6d5137', 0, TILE_SIZE - 1, TILE_SIZE, 1);
  });
}

function drawWaterTile(scene, key, frame) {
  const tones = ['#4f88cf', '#5b99e0', '#3a75c0', '#79b5eb'];

  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x, y + frame * 5, 23);
        const ripple = Math.sin((x + frame * 3 + y * 0.4) * 0.5);
        if (ripple > 0.65) {
          px(ctx, tones[3], x, y);
        } else if (n < 0.2) {
          px(ctx, tones[2], x, y);
        } else if (n < 0.75) {
          px(ctx, tones[0], x, y);
        } else {
          px(ctx, tones[1], x, y);
        }
      }
    }

    rect(ctx, '#9cd0ff', 0, 0, TILE_SIZE, 1);
    rect(ctx, '#2d5c95', 0, TILE_SIZE - 1, TILE_SIZE, 1);
  });
}

function drawFenceTile(scene, key) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    rect(ctx, '#6ba767', 0, 0, TILE_SIZE, TILE_SIZE);

    rect(ctx, '#7d5735', 4, 4, 4, 24);
    rect(ctx, '#7d5735', 24, 4, 4, 24);
    rect(ctx, '#6a4528', 5, 4, 2, 24);
    rect(ctx, '#6a4528', 25, 4, 2, 24);

    rect(ctx, '#98663f', 6, 9, 20, 3);
    rect(ctx, '#98663f', 6, 17, 20, 3);
    rect(ctx, '#593920', 6, 11, 20, 1);
    rect(ctx, '#593920', 6, 19, 20, 1);

    rect(ctx, '#4f7e4d', 0, TILE_SIZE - 2, TILE_SIZE, 2);
  });
}

function drawHouseTile(scene, key, isShop) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    const roofA = isShop ? '#8d5d88' : '#7b5d53';
    const roofB = isShop ? '#7b4f77' : '#6a4e45';
    const wallA = isShop ? '#d4bdc7' : '#d6c1aa';
    const wallB = isShop ? '#b99caf' : '#b89d85';

    rect(ctx, wallA, 0, 0, TILE_SIZE, TILE_SIZE);

    for (let y = 0; y < TILE_SIZE; y += 4) {
      for (let x = 0; x < TILE_SIZE; x += 4) {
        rect(ctx, (x + y) % 8 === 0 ? wallA : wallB, x, y, 4, 4);
      }
    }

    rect(ctx, roofA, 0, 0, TILE_SIZE, 10);
    for (let x = 0; x < TILE_SIZE; x += 4) {
      rect(ctx, x % 8 === 0 ? roofA : roofB, x, 0, 4, 10);
    }

    rect(ctx, '#5a4637', 0, 10, TILE_SIZE, 2);

    rect(ctx, '#6f8daa', 6, 15, 6, 6);
    rect(ctx, '#6f8daa', 20, 15, 6, 6);
    rect(ctx, '#2f4257', 6, 15, 6, 1);
    rect(ctx, '#2f4257', 20, 15, 6, 1);

    rect(ctx, '#815634', 13, 20, 6, 12);
    rect(ctx, '#5b3a21', 13, 20, 1, 12);
    px(ctx, '#d9c58b', 17, 26);
  });
}

function drawBinTile(scene, key) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    rect(ctx, '#5a8757', 0, 0, TILE_SIZE, TILE_SIZE);
    rect(ctx, '#77502e', 8, 8, 16, 18);
    rect(ctx, '#8d643c', 7, 6, 18, 4);
    rect(ctx, '#55351b', 9, 10, 14, 14);
    rect(ctx, '#9a7447', 10, 11, 12, 12);
    rect(ctx, '#4e3219', 13, 15, 6, 8);
    rect(ctx, '#ab8450', 12, 6, 8, 2);
  });
}

function drawSoil(scene, key, wet) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    const baseA = wet ? '#4c3c32' : '#745233';
    const baseB = wet ? '#5a473b' : '#815e3c';
    const furrow = wet ? '#3a2d25' : '#5d4128';

    rect(ctx, baseA, 0, 0, TILE_SIZE, TILE_SIZE);

    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x, y, wet ? 131 : 127);
        if (n > 0.77) {
          px(ctx, baseB, x, y);
        }
      }
    }

    for (let x = 3; x < TILE_SIZE; x += 6) {
      rect(ctx, furrow, x, 2, 2, TILE_SIZE - 4);
    }
  });
}

function drawCrop(scene, key, stage, alt) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    const stem = '#4e8a41';
    const leaf = ['#6fc55f', '#63b556', '#5da84e'][stage - 1];
    const fruit = ['#bde56c', '#e9d37d', '#f1c96a'][stage - 1];

    const sway = alt ? 1 : 0;
    const baseY = 28;

    rect(ctx, stem, 15 + sway, baseY - (5 + stage * 3), 2, 6 + stage * 3);
    rect(ctx, leaf, 11 + sway, baseY - (4 + stage * 2), 4, 2);
    rect(ctx, leaf, 17 + sway, baseY - (2 + stage * 2), 4, 2);

    if (stage === 1) {
      rect(ctx, fruit, 14 + sway, baseY - 10, 4, 4);
      return;
    }

    if (stage === 2) {
      rect(ctx, fruit, 12 + sway, baseY - 13, 8, 5);
      rect(ctx, '#f8e7b7', 14 + sway, baseY - 12, 3, 1);
      return;
    }

    rect(ctx, fruit, 11 + sway, baseY - 16, 10, 7);
    rect(ctx, '#f7e5b4', 13 + sway, baseY - 15, 4, 2);
    rect(ctx, '#e2b75b', 17 + sway, baseY - 11, 2, 2);
  });
}

function drawCharacterFrame(scene, key, colors, direction, step) {
  createTexture(scene, key, 24, 28, (ctx) => {
    const skin = colors.skin;
    const hair = colors.hair;
    const shirt = colors.shirt;
    const accent = colors.accent;
    const pants = colors.pants;
    const boots = '#4a3727';
    const outline = '#2a1b13';

    rect(ctx, outline, 7, 3, 10, 9);
    rect(ctx, skin, 8, 4, 8, 7);

    if (direction === 'up') {
      rect(ctx, hair, 8, 4, 8, 3);
      rect(ctx, hair, 8, 8, 8, 2);
    } else if (direction === 'side') {
      rect(ctx, hair, 8, 3, 8, 3);
      rect(ctx, hair, 8, 6, 6, 2);
      rect(ctx, '#ffffff', 14, 8, 1, 1);
      rect(ctx, '#2a1b13', 15, 8, 1, 1);
    } else {
      rect(ctx, hair, 8, 3, 8, 3);
      rect(ctx, '#ffffff', 10, 8, 1, 1);
      rect(ctx, '#ffffff', 13, 8, 1, 1);
      rect(ctx, '#2a1b13', 10, 8, 1, 1);
      rect(ctx, '#2a1b13', 13, 8, 1, 1);
      rect(ctx, '#cc8668', 11, 10, 2, 1);
    }

    rect(ctx, outline, 6, 11, 12, 10);
    rect(ctx, shirt, 7, 12, 10, 7);
    rect(ctx, accent, 11, 12, 2, 7);

    const armOffset = step === 0 ? 0 : 1;
    rect(ctx, skin, 5, 12 + armOffset, 2, 5);
    rect(ctx, skin, 17, 13 - armOffset, 2, 5);

    rect(ctx, pants, 8, 19, 8, 5);

    if (step === 0) {
      rect(ctx, boots, 8, 24, 3, 3);
      rect(ctx, boots, 13, 24, 3, 3);
    } else {
      rect(ctx, boots, 7, 24, 3, 3);
      rect(ctx, boots, 14, 24, 3, 3);
    }
  });
}

function drawDecorationTextures(scene) {
  createTexture(scene, 'deco-flower-0', 14, 14, (ctx) => {
    rect(ctx, '#4f8f44', 6, 7, 2, 6);
    rect(ctx, '#f9d88c', 4, 4, 2, 2);
    rect(ctx, '#f9d88c', 8, 4, 2, 2);
    rect(ctx, '#f1a2d0', 5, 2, 4, 3);
    rect(ctx, '#fef5df', 6, 4, 2, 2);
  });

  createTexture(scene, 'deco-flower-1', 14, 14, (ctx) => {
    rect(ctx, '#5a964f', 6, 7, 2, 6);
    rect(ctx, '#f7d3a5', 4, 4, 2, 2);
    rect(ctx, '#f7d3a5', 8, 4, 2, 2);
    rect(ctx, '#a59ff3', 5, 2, 4, 3);
    rect(ctx, '#fef5df', 6, 4, 2, 2);
  });

  createTexture(scene, 'deco-bush-0', 26, 20, (ctx) => {
    rect(ctx, '#456f3f', 3, 10, 20, 8);
    rect(ctx, '#5a8d53', 1, 8, 24, 7);
    rect(ctx, '#76a96f', 4, 6, 17, 5);
    rect(ctx, '#8fc286', 7, 5, 9, 3);
  });

  createTexture(scene, 'deco-bush-1', 26, 20, (ctx) => {
    rect(ctx, '#3f6938', 3, 10, 20, 8);
    rect(ctx, '#537f4b', 1, 8, 24, 7);
    rect(ctx, '#6f9f67', 4, 6, 17, 5);
    rect(ctx, '#86b87d', 7, 5, 9, 3);
  });

  createTexture(scene, 'deco-rock-0', 14, 10, (ctx) => {
    rect(ctx, '#7a8189', 2, 4, 10, 5);
    rect(ctx, '#9da4ad', 4, 3, 6, 3);
    rect(ctx, '#656c75', 2, 8, 10, 1);
  });
}

function drawUiTextures(scene) {
  createTexture(scene, 'ui-panel', 460, 136, (ctx, width, height) => {
    rect(ctx, 'rgba(11,17,25,0.80)', 0, 0, width, height);
    rect(ctx, 'rgba(39,59,76,0.75)', 2, 2, width - 4, height - 4);
    rect(ctx, 'rgba(14,22,30,0.90)', 4, 4, width - 8, height - 8);

    rect(ctx, '#8db8b9', 0, 0, width, 1);
    rect(ctx, '#8db8b9', 0, height - 1, width, 1);
    rect(ctx, '#8db8b9', 0, 0, 1, height);
    rect(ctx, '#8db8b9', width - 1, 0, 1, height);

    for (let x = 8; x < width - 8; x += 4) {
      rect(ctx, x % 12 === 0 ? 'rgba(130,170,180,0.24)' : 'rgba(80,120,130,0.15)', x, 8, 2, 2);
    }
  });

  createTexture(scene, 'ui-vignette', 512, 512, (ctx, width, height) => {
    const g = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 280);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(6,10,15,0.06)');
    g.addColorStop(1, 'rgba(6,10,15,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  });

  createTexture(scene, 'shadow-player', 24, 10, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(12, 5, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  createTexture(scene, 'shadow-npc', 24, 10, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(12, 5, 9, 3.7, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCharacterTextures(scene) {
  const characterDefs = [
    {
      prefix: 'player',
      colors: {
        skin: '#f0cb9c',
        hair: '#6a4b35',
        shirt: '#4e88cb',
        accent: '#8ec6f4',
        pants: '#4b5f7d',
      },
    },
    {
      prefix: 'npc',
      colors: {
        skin: '#ebc4a6',
        hair: '#4a385f',
        shirt: '#7ba85a',
        accent: '#acd489',
        pants: '#515c72',
      },
    },
  ];

  for (const def of characterDefs) {
    for (const direction of ['down', 'up', 'side']) {
      for (let step = 0; step < 2; step += 1) {
        drawCharacterFrame(scene, `${def.prefix}-${direction}-${step}`, def.colors, direction, step);
      }
    }
  }
}

function drawCropTextures(scene) {
  for (let stage = 1; stage <= 3; stage += 1) {
    drawCrop(scene, `crop-${stage}-a`, stage, false);
    drawCrop(scene, `crop-${stage}-b`, stage, true);
  }
}

export function bootstrapArt(scene) {
  for (let i = 0; i < 4; i += 1) {
    drawGrassTile(scene, `tile-grass-${i}`, i);
  }

  for (let i = 0; i < 3; i += 1) {
    drawPathTile(scene, `tile-path-${i}`, i);
  }

  for (let i = 0; i < 4; i += 1) {
    drawWaterTile(scene, `tile-water-${i}`, i);
  }

  drawFenceTile(scene, 'tile-fence');
  drawHouseTile(scene, 'tile-house', false);
  drawHouseTile(scene, 'tile-shop', true);
  drawBinTile(scene, 'tile-bin');
  drawSoil(scene, 'tile-soil-dry', false);
  drawSoil(scene, 'tile-soil-wet', true);

  drawCropTextures(scene);
  drawCharacterTextures(scene);
  drawDecorationTextures(scene);
  drawUiTextures(scene);
}
