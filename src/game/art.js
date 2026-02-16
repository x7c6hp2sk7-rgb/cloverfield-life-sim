import { TILE_SIZE, TILE_TYPES } from './constants';

const TILE_VARIANT_COUNTS = {
  [TILE_TYPES.GRASS]: 5,
  [TILE_TYPES.PATH]: 4,
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

function shadeTileEdges(ctx) {
  rect(ctx, 'rgba(255,238,200,0.10)', 0, 0, TILE_SIZE, 1);
  rect(ctx, 'rgba(0,0,0,0.13)', 0, TILE_SIZE - 1, TILE_SIZE, 1);
  rect(ctx, 'rgba(0,0,0,0.08)', TILE_SIZE - 1, 0, 1, TILE_SIZE);
}

function drawGrassTile(scene, key, variant) {
  const tones = ['#6f8d4a', '#7a9751', '#8da85a', '#688747', '#9db766'];
  const weeds = ['#4f6937', '#5e7940', '#7fa05a'];
  const fallenLeaf = ['#d1894f', '#bc7036', '#f1b164'];

  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x + variant * 23, y, 5);
        let color = tones[0];
        if (n > 0.78) {
          color = tones[4];
        } else if (n > 0.58) {
          color = tones[2];
        } else if (n > 0.36) {
          color = tones[1];
        } else if (n > 0.2) {
          color = tones[3];
        }
        px(ctx, color, x, y);
      }
    }

    for (let i = 0; i < 58; i += 1) {
      const sx = hashInt(i, variant, 17) % TILE_SIZE;
      const sy = hashInt(i, variant, 29) % TILE_SIZE;
      const blade = weeds[hashInt(i, variant, 31) % weeds.length];
      px(ctx, blade, sx, sy);
      if (sy > 0) {
        px(ctx, '#455d33', sx, sy - 1);
      }
    }

    for (let i = 0; i < 8; i += 1) {
      const sx = hashInt(i, variant, 43) % 28 + 2;
      const sy = hashInt(i, variant, 47) % 28 + 2;
      const leaf = fallenLeaf[hashInt(i, variant, 53) % fallenLeaf.length];
      px(ctx, leaf, sx, sy);
      if (sx + 1 < TILE_SIZE) {
        px(ctx, '#f1c089', sx + 1, sy);
      }
    }

    shadeTileEdges(ctx);
  });
}

function drawPathTile(scene, key, variant) {
  const base = ['#9f6f44', '#ad7d4e', '#875b35'];
  const stone = ['#c4ad82', '#b39567', '#8a6d4a'];

  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    rect(ctx, base[1], 0, 0, TILE_SIZE, TILE_SIZE);

    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x + variant * 17, y, 61);
        if (n > 0.8) {
          px(ctx, base[0], x, y);
        } else if (n < 0.18) {
          px(ctx, base[2], x, y);
        }
      }
    }

    for (let i = 0; i < 9; i += 1) {
      const sx = (hashInt(i, variant, 71) % 24) + 2;
      const sy = (hashInt(i, variant, 73) % 24) + 2;
      const w = (hashInt(i, variant, 79) % 4) + 2;
      const h = (hashInt(i, variant, 83) % 3) + 2;
      const c = stone[hashInt(i, variant, 89) % stone.length];
      rect(ctx, c, sx, sy, w, h);
      rect(ctx, 'rgba(0,0,0,0.2)', sx, sy + h, w, 1);
    }

    shadeTileEdges(ctx);
  });
}

function drawWaterTile(scene, key, frame) {
  const tones = ['#365f9f', '#4f7fc3', '#2a4d84', '#78a5de'];

  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    for (let y = 0; y < TILE_SIZE; y += 1) {
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const n = coordNoise(x + frame * 9, y, 97);
        const ripple = Math.sin((x * 0.5 + y * 0.15 + frame * 0.9) * 1.35);
        let color = tones[0];

        if (n < 0.2) {
          color = tones[2];
        } else if (n > 0.84) {
          color = tones[1];
        }

        if (ripple > 0.74) {
          color = tones[3];
        }

        px(ctx, color, x, y);
      }
    }

    for (let i = 0; i < 10; i += 1) {
      const sx = (hashInt(i, frame, 101) % 28) + 2;
      const sy = (hashInt(i, frame, 103) % 28) + 2;
      px(ctx, '#a5c8ef', sx, sy);
    }

    rect(ctx, '#8cb5eb', 0, 0, TILE_SIZE, 1);
    rect(ctx, '#233f6a', 0, TILE_SIZE - 1, TILE_SIZE, 1);
  });
}

function drawFenceTile(scene, key) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    drawGrassTile(scene, '__tmp-fence-ground', 0);
    const ground = scene.textures.get('__tmp-fence-ground').getSourceImage();
    ctx.drawImage(ground, 0, 0);

    rect(ctx, '#6f4527', 5, 5, 4, 24);
    rect(ctx, '#6f4527', 23, 5, 4, 24);
    rect(ctx, '#8a5933', 6, 5, 2, 24);
    rect(ctx, '#8a5933', 24, 5, 2, 24);

    rect(ctx, '#8f5f37', 7, 10, 18, 3);
    rect(ctx, '#8f5f37', 7, 18, 18, 3);
    rect(ctx, '#603b20', 7, 12, 18, 1);
    rect(ctx, '#603b20', 7, 20, 18, 1);

    rect(ctx, 'rgba(0,0,0,0.22)', 6, 22, 20, 2);
    shadeTileEdges(ctx);
  });

  scene.textures.remove('__tmp-fence-ground');
}

function drawHouseTile(scene, key, isShop) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    const roofA = isShop ? '#6f486d' : '#71493f';
    const roofB = isShop ? '#8b6290' : '#8a5f54';
    const wallA = isShop ? '#c5afbf' : '#d5bd9d';
    const wallB = isShop ? '#b093ac' : '#bea283';
    const trim = '#4d3528';

    rect(ctx, wallA, 0, 0, TILE_SIZE, TILE_SIZE);
    for (let y = 0; y < TILE_SIZE; y += 4) {
      for (let x = 0; x < TILE_SIZE; x += 4) {
        rect(ctx, (x + y) % 8 === 0 ? wallA : wallB, x, y, 4, 4);
      }
    }

    rect(ctx, roofA, 0, 0, TILE_SIZE, 11);
    for (let x = 0; x < TILE_SIZE; x += 4) {
      rect(ctx, x % 8 === 0 ? roofA : roofB, x, 0, 4, 11);
    }

    rect(ctx, trim, 0, 11, TILE_SIZE, 2);
    rect(ctx, '#6d89a6', 5, 16, 7, 6);
    rect(ctx, '#6d89a6', 20, 16, 7, 6);
    rect(ctx, '#2d425a', 5, 16, 7, 1);
    rect(ctx, '#2d425a', 20, 16, 7, 1);

    rect(ctx, '#734628', 12, 21, 8, 11);
    rect(ctx, '#4d301b', 12, 21, 1, 11);
    px(ctx, '#d9c58f', 18, 26);

    if (isShop) {
      rect(ctx, '#e3d68d', 11, 13, 10, 2);
      rect(ctx, '#6e4f1f', 11, 15, 10, 1);
    }

    rect(ctx, 'rgba(0,0,0,0.16)', 0, TILE_SIZE - 3, TILE_SIZE, 3);
  });
}

function drawBinTile(scene, key) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    rect(ctx, '#6c944f', 0, 0, TILE_SIZE, TILE_SIZE);
    rect(ctx, '#5d3a22', 7, 8, 18, 18);
    rect(ctx, '#7b4e2f', 8, 9, 16, 16);
    rect(ctx, '#9a6a43', 7, 6, 18, 4);
    rect(ctx, '#4f311c', 12, 13, 8, 12);
    rect(ctx, '#b58450', 12, 6, 8, 2);
    rect(ctx, 'rgba(0,0,0,0.2)', 7, 24, 18, 2);
    shadeTileEdges(ctx);
  });
}

function drawSoil(scene, key, wet) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    const base = wet ? '#523f34' : '#7c5634';
    const mid = wet ? '#5f4a3d' : '#8b6340';
    const furrow = wet ? '#3f3028' : '#65442a';
    const edge = wet ? '#2f2621' : '#4f3723';

    rect(ctx, base, 0, 0, TILE_SIZE, TILE_SIZE);
    rect(ctx, edge, 0, 0, TILE_SIZE, 2);
    rect(ctx, edge, 0, TILE_SIZE - 2, TILE_SIZE, 2);
    rect(ctx, edge, 0, 0, 2, TILE_SIZE);
    rect(ctx, edge, TILE_SIZE - 2, 0, 2, TILE_SIZE);

    for (let y = 2; y < TILE_SIZE - 2; y += 1) {
      for (let x = 2; x < TILE_SIZE - 2; x += 1) {
        const n = coordNoise(x, y, wet ? 131 : 127);
        if (n > 0.75) {
          px(ctx, mid, x, y);
        }
      }
    }

    for (let x = 4; x < TILE_SIZE - 3; x += 6) {
      rect(ctx, furrow, x, 3, 2, TILE_SIZE - 6);
      rect(ctx, wet ? '#7d6654' : '#a27a55', x + 1, 3, 1, TILE_SIZE - 6);
    }
  });
}

function drawCrop(scene, key, stage, alt) {
  createTexture(scene, key, TILE_SIZE, TILE_SIZE, (ctx) => {
    const stem = '#4c7834';
    const leafDark = ['#4a8a3d', '#3f7e35', '#356f2f'][stage - 1];
    const leafMid = ['#62ab4e', '#579946', '#4f8a40'][stage - 1];
    const fruit = ['#f0b84f', '#dfa34b', '#e6c15a'][stage - 1];

    const sway = alt ? 1 : 0;
    const baseY = 28;

    rect(ctx, stem, 15 + sway, baseY - (5 + stage * 3), 2, 6 + stage * 3);
    rect(ctx, leafDark, 10 + sway, baseY - (4 + stage * 2), 5, 2);
    rect(ctx, leafMid, 11 + sway, baseY - (3 + stage * 2), 4, 2);
    rect(ctx, leafDark, 17 + sway, baseY - (2 + stage * 2), 5, 2);
    rect(ctx, leafMid, 17 + sway, baseY - (1 + stage * 2), 4, 2);

    if (stage === 1) {
      rect(ctx, fruit, 14 + sway, baseY - 10, 4, 4);
      rect(ctx, '#f9d680', 15 + sway, baseY - 9, 2, 1);
      return;
    }

    if (stage === 2) {
      rect(ctx, fruit, 12 + sway, baseY - 14, 8, 6);
      rect(ctx, '#f7d279', 14 + sway, baseY - 13, 3, 2);
      rect(ctx, '#b78334', 18 + sway, baseY - 10, 1, 2);
      return;
    }

    rect(ctx, fruit, 11 + sway, baseY - 17, 10, 8);
    rect(ctx, '#f8da8e', 13 + sway, baseY - 15, 4, 2);
    rect(ctx, '#b67f35', 19 + sway, baseY - 11, 1, 2);
    rect(ctx, '#e0af4f', 12 + sway, baseY - 11, 7, 2);
  });
}

function drawCharacterFrame(scene, key, colors, direction, step) {
  createTexture(scene, key, 24, 28, (ctx) => {
    const boots = '#3f2c1d';
    const outline = '#25170f';

    rect(ctx, outline, 7, 2, 10, 10);
    rect(ctx, colors.skin, 8, 3, 8, 8);

    if (direction === 'up') {
      rect(ctx, colors.hair, 8, 3, 8, 4);
      rect(ctx, colors.hair, 8, 8, 8, 2);
    } else if (direction === 'side') {
      rect(ctx, colors.hair, 8, 2, 8, 4);
      rect(ctx, colors.hair, 8, 6, 6, 2);
      rect(ctx, '#ffffff', 14, 8, 1, 1);
      rect(ctx, '#2a1b13', 15, 8, 1, 1);
    } else {
      rect(ctx, colors.hair, 8, 2, 8, 4);
      rect(ctx, '#ffffff', 10, 8, 1, 1);
      rect(ctx, '#ffffff', 13, 8, 1, 1);
      rect(ctx, '#2a1b13', 10, 8, 1, 1);
      rect(ctx, '#2a1b13', 13, 8, 1, 1);
      rect(ctx, '#cd8566', 11, 10, 2, 1);
    }

    rect(ctx, outline, 6, 11, 12, 10);
    rect(ctx, colors.shirt, 7, 12, 10, 7);
    rect(ctx, colors.accent, 11, 12, 2, 7);

    const armOffset = step === 0 ? 0 : 1;
    rect(ctx, colors.skin, 5, 12 + armOffset, 2, 5);
    rect(ctx, colors.skin, 17, 13 - armOffset, 2, 5);

    rect(ctx, colors.pants, 8, 19, 8, 5);

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
    rect(ctx, '#f7c39b', 4, 4, 2, 2);
    rect(ctx, '#f7c39b', 8, 4, 2, 2);
    rect(ctx, '#d17bb5', 5, 2, 4, 3);
    rect(ctx, '#fff3d8', 6, 4, 2, 2);
  });

  createTexture(scene, 'deco-flower-1', 14, 14, (ctx) => {
    rect(ctx, '#5a964f', 6, 7, 2, 6);
    rect(ctx, '#f6d093', 4, 4, 2, 2);
    rect(ctx, '#f6d093', 8, 4, 2, 2);
    rect(ctx, '#8d8aea', 5, 2, 4, 3);
    rect(ctx, '#fff3d8', 6, 4, 2, 2);
  });

  createTexture(scene, 'deco-bush-0', 26, 20, (ctx) => {
    rect(ctx, '#436637', 3, 10, 20, 8);
    rect(ctx, '#5d824a', 1, 8, 24, 7);
    rect(ctx, '#769d5f', 4, 6, 17, 5);
    rect(ctx, '#90b47a', 7, 5, 9, 3);
    rect(ctx, '#d17c3a', 4, 11, 2, 2);
    rect(ctx, '#c0682f', 9, 13, 2, 2);
  });

  createTexture(scene, 'deco-bush-1', 26, 20, (ctx) => {
    rect(ctx, '#3f6233', 3, 10, 20, 8);
    rect(ctx, '#567a44', 1, 8, 24, 7);
    rect(ctx, '#6d9257', 4, 6, 17, 5);
    rect(ctx, '#88ad72', 7, 5, 9, 3);
    rect(ctx, '#e19543', 6, 11, 2, 2);
    rect(ctx, '#c87534', 13, 12, 2, 2);
  });

  createTexture(scene, 'deco-rock-0', 14, 10, (ctx) => {
    rect(ctx, '#70757d', 2, 4, 10, 5);
    rect(ctx, '#9ba0a8', 4, 3, 6, 3);
    rect(ctx, '#595f68', 2, 8, 10, 1);
  });

  createTexture(scene, 'deco-barrel-0', 16, 20, (ctx) => {
    rect(ctx, '#71482a', 3, 4, 10, 14);
    rect(ctx, '#8d5f37', 4, 5, 8, 12);
    rect(ctx, '#4e311c', 3, 8, 10, 2);
    rect(ctx, '#4e311c', 3, 13, 10, 2);
    rect(ctx, '#b98654', 5, 6, 2, 10);
  });

  createTexture(scene, 'deco-crate-0', 18, 14, (ctx) => {
    rect(ctx, '#6a4125', 1, 2, 16, 10);
    rect(ctx, '#8b5b34', 2, 3, 14, 8);
    rect(ctx, '#4c2d1a', 2, 6, 14, 1);
    rect(ctx, '#4c2d1a', 8, 3, 1, 8);
  });

  createTexture(scene, 'deco-lantern-0', 12, 20, (ctx) => {
    rect(ctx, '#3a2b1d', 5, 0, 2, 3);
    rect(ctx, '#4c3725', 3, 3, 6, 10);
    rect(ctx, '#f6c36f', 4, 5, 4, 5);
    rect(ctx, '#ffdca3', 5, 6, 2, 2);
    rect(ctx, '#2a1c11', 4, 13, 4, 5);
  });

  createTexture(scene, 'deco-tree-0', 44, 52, (ctx) => {
    rect(ctx, '#5c3721', 19, 30, 6, 20);
    rect(ctx, '#7a4a2d', 20, 30, 4, 20);
    rect(ctx, '#5a7a36', 8, 8, 28, 26);
    rect(ctx, '#6a8f3f', 5, 12, 34, 20);
    rect(ctx, '#84a84f', 10, 6, 24, 16);
    rect(ctx, '#a8bf65', 14, 4, 16, 10);
    rect(ctx, '#d1853a', 12, 18, 2, 2);
    rect(ctx, '#d1853a', 24, 15, 2, 2);
    rect(ctx, '#c06f30', 31, 20, 2, 2);
  });

  createTexture(scene, 'deco-tree-1', 44, 52, (ctx) => {
    rect(ctx, '#57331f', 19, 30, 6, 20);
    rect(ctx, '#72462b', 20, 30, 4, 20);
    rect(ctx, '#486a2f', 8, 8, 28, 26);
    rect(ctx, '#557a38', 5, 12, 34, 20);
    rect(ctx, '#6f9246', 10, 6, 24, 16);
    rect(ctx, '#8ead58', 14, 4, 16, 10);
    rect(ctx, '#e09944', 10, 19, 2, 2);
    rect(ctx, '#cb7636', 23, 16, 2, 2);
    rect(ctx, '#bf682f', 29, 21, 2, 2);
  });
}

function drawUiTextures(scene) {
  createTexture(scene, 'ui-panel', 460, 136, (ctx, width, height) => {
    rect(ctx, 'rgba(24,23,31,0.83)', 0, 0, width, height);
    rect(ctx, 'rgba(49,40,57,0.7)', 2, 2, width - 4, height - 4);
    rect(ctx, 'rgba(22,20,27,0.92)', 5, 5, width - 10, height - 10);

    rect(ctx, '#d9b475', 0, 0, width, 1);
    rect(ctx, '#d9b475', 0, height - 1, width, 1);
    rect(ctx, '#d9b475', 0, 0, 1, height);
    rect(ctx, '#d9b475', width - 1, 0, 1, height);

    for (let x = 10; x < width - 10; x += 5) {
      rect(ctx, x % 15 === 0 ? 'rgba(209,133,72,0.26)' : 'rgba(162,110,66,0.16)', x, 9, 2, 2);
    }
  });

  createTexture(scene, 'ui-vignette', 512, 512, (ctx, width, height) => {
    const g = ctx.createRadialGradient(width / 2, height / 2, 90, width / 2, height / 2, 280);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(19,13,10,0.07)');
    g.addColorStop(1, 'rgba(12,8,7,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  });

  createTexture(scene, 'light-glow', 120, 120, (ctx, width, height) => {
    const g = ctx.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, 56);
    g.addColorStop(0, 'rgba(255,224,150,0.58)');
    g.addColorStop(0.4, 'rgba(236,175,93,0.27)');
    g.addColorStop(1, 'rgba(236,175,93,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  });

  createTexture(scene, 'shadow-player', 24, 10, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(12, 5, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  createTexture(scene, 'shadow-npc', 24, 10, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.27)';
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
        skin: '#e8bf96',
        hair: '#5d3f2d',
        shirt: '#4f78bb',
        accent: '#86b4ec',
        pants: '#4f5c75',
      },
    },
    {
      prefix: 'npc',
      colors: {
        skin: '#e2b89c',
        hair: '#4b3959',
        shirt: '#6a964e',
        accent: '#98c779',
        pants: '#4e576d',
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
  for (let i = 0; i < 5; i += 1) {
    drawGrassTile(scene, `tile-grass-${i}`, i);
  }

  for (let i = 0; i < 4; i += 1) {
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
