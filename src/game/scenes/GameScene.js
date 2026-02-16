import Phaser from 'phaser';
import {
  NPC_NAME,
  TILE_SIZE,
  TILE_TYPES,
  TOOL_LABELS,
  TOOL_ORDER,
  WEATHER_TYPES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../constants';
import { coordNoise, getTileTextureKey } from '../art';
import { createWorldData } from '../world';
import { loadGameState, saveGameState } from '../save';

const STAMINA_MAX = 100;
const MINUTES_PER_SECOND = 8;
const SEED_COST = 20;
const CROP_VALUE = 35;

function tileKey(x, y) {
  return `${x},${y}`;
}

function toWorldX(tileX) {
  return tileX * TILE_SIZE + TILE_SIZE / 2;
}

function toWorldY(tileY) {
  return tileY * TILE_SIZE + TILE_SIZE / 2;
}

function toTile(value) {
  return Math.floor(value / TILE_SIZE);
}

function chooseNextWeather(rng) {
  const roll = rng.frac();
  if (roll < 0.18) {
    return WEATHER_TYPES[2];
  }
  if (roll < 0.48) {
    return WEATHER_TYPES[1];
  }
  return WEATHER_TYPES[0];
}

function directionFromFacing(facing) {
  if (Math.abs(facing.x) > Math.abs(facing.y)) {
    return 'side';
  }

  return facing.y < 0 ? 'up' : 'down';
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.messageTimer = null;
  }

  create() {
    this.world = createWorldData();
    this.rng = new Phaser.Math.RandomDataGenerator(['life-sim']);

    this.day = 1;
    this.totalMinutes = 6 * 60;
    this.minuteAccumulator = 0;
    this.weather = 'Sunny';

    this.stamina = STAMINA_MAX;
    this.money = 120;
    this.inventory = {
      parsnipSeeds: 8,
      parsnip: 0,
    };

    this.facing = { x: 0, y: 1 };
    this.selectedTool = 0;
    this.plots = {};
    this.plotVisuals = {};

    this.npc = {
      sprite: null,
      shadow: null,
      label: null,
      friendship: 0,
      lastTalkDay: 0,
      targetIndex: 0,
      facing: { x: 0, y: 1 },
      moving: false,
      animClock: 0,
    };

    this.playerMoving = false;
    this.playerAnimClock = 0;
    this.waterAnimClock = 0;
    this.waterFrame = 0;
    this.windClock = 0;

    this.waterTiles = [];
    this.decorSprites = [];
    this.props = [];
    this.lanternGlows = [];

    this.drawWorld();
    this.createDecorations();
    this.createSetPieces();
    this.createPlayer();
    this.createNpc();
    this.createAtmosphere();
    this.createInput();
    this.createUI();

    const loaded = this.loadFromStorage();
    if (!loaded) {
      this.seedStarterPlots();
    }

    this.applyRainIfNeeded();

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(1.35);

    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.persist(),
    });

    this.showMessage('Welcome to Cloverfield. Grow crops, meet neighbors, and build your farm.');
    this.refreshUI();
    this.updateAtmosphere();
    this.updateCharacterVisual(this.player, 'player', this.facing, false, 0);
    this.updateCharacterVisual(this.npc.sprite, 'npc', this.npc.facing, false, 0);
  }

  drawWorld() {
    this.baseLayer = [];
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      const row = [];
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const type = this.world.tiles[y][x];
        const texture = getTileTextureKey(type, x, y, this.waterFrame);
        const tile = this.add.image(toWorldX(x), toWorldY(y), texture).setDepth(0);
        row.push(tile);

        if (type === TILE_TYPES.WATER) {
          this.waterTiles.push({ image: tile, x, y });
        }
      }
      this.baseLayer.push(row);
    }
  }

  addProp(config) {
    const image = this.add
      .image(toWorldX(config.x) + (config.offsetX ?? 0), toWorldY(config.y) + (config.yLift ?? 6), config.texture)
      .setOrigin(0.5, 1)
      .setDepth((config.depth ?? 4) + config.y * 0.01);

    this.props.push({
      image,
      sway: Boolean(config.sway),
      swayAmount: config.swayAmount ?? 0.5,
      phase: config.phase ?? 0,
      baseX: image.x,
    });

    if (config.lit) {
      const glow = this.add
        .image(image.x, image.y - (config.lightYOffset ?? 7), 'light-glow')
        .setDepth(28)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);

      this.lanternGlows.push({
        glow,
        phase: config.phase ?? 0,
      });
    }
  }

  createDecorations() {
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        if (this.world.tiles[y][x] !== TILE_TYPES.GRASS) {
          continue;
        }

        if (this.world.blocked[y][x] || this.isInFarmPlot(x, y)) {
          continue;
        }

        const roll = coordNoise(x, y, 211);

        if (roll > 0.995) {
          const texture = coordNoise(x, y, 219) > 0.5 ? 'deco-tree-0' : 'deco-tree-1';
          this.addProp({
            x,
            y,
            texture,
            yLift: 18,
            depth: 5,
            sway: true,
            swayAmount: 0.8,
            phase: coordNoise(x, y, 233) * Math.PI * 2,
          });
          continue;
        }

        if (roll > 0.983) {
          const texture = coordNoise(x, y, 223) > 0.5 ? 'deco-bush-0' : 'deco-bush-1';
          this.addProp({
            x,
            y,
            texture,
            yLift: 8,
            depth: 4.5,
          });
          continue;
        }

        if (roll > 0.964) {
          const texture = coordNoise(x, y, 227) > 0.5 ? 'deco-flower-0' : 'deco-flower-1';
          this.addProp({
            x,
            y,
            texture,
            yLift: 6,
            depth: 4.2,
            sway: true,
            swayAmount: 0.6,
            phase: coordNoise(x, y, 241) * Math.PI * 2,
          });
          continue;
        }

        if (roll > 0.953) {
          this.addProp({
            x,
            y,
            texture: 'deco-rock-0',
            yLift: 4,
            depth: 4.1,
          });
        }
      }
    }
  }

  createSetPieces() {
    const props = [
      { x: 9, y: 10, texture: 'deco-barrel-0', yLift: 8 },
      { x: 10, y: 10, texture: 'deco-barrel-0', yLift: 8 },
      { x: 12, y: 10, texture: 'deco-crate-0', yLift: 8 },
      { x: 14, y: 10, texture: 'deco-crate-0', yLift: 8 },
      { x: 6, y: 12, texture: 'deco-lantern-0', yLift: 8, lit: true },
      { x: 7, y: 12, texture: 'deco-lantern-0', yLift: 8, lit: true, phase: 1.2 },
      { x: 48, y: 15, texture: 'deco-lantern-0', yLift: 8, lit: true, phase: 2.1 },
      { x: 50, y: 15, texture: 'deco-lantern-0', yLift: 8, lit: true, phase: 0.4 },
      { x: 56, y: 25, texture: 'deco-crate-0', yLift: 8 },
      { x: 57, y: 25, texture: 'deco-barrel-0', yLift: 8 },
      { x: 58, y: 25, texture: 'deco-barrel-0', yLift: 8 },
    ];

    for (const prop of props) {
      this.addProp(prop);
    }
  }

  seedStarterPlots() {
    for (let y = 12; y <= 18; y += 1) {
      for (let x = 6; x <= 23; x += 1) {
        if ((x + y) % 4 === 0) {
          continue;
        }

        const plot = this.getOrCreatePlot(x, y);
        plot.tilled = true;
        plot.crop = 'parsnip';
        const roll = coordNoise(x, y, 307);
        if (roll > 0.7) {
          plot.growth = 2;
          plot.ready = true;
        } else if (roll > 0.36) {
          plot.growth = 1;
          plot.ready = false;
        } else {
          plot.growth = 0;
          plot.ready = false;
        }
        plot.watered = roll > 0.45;

        this.updatePlotVisual(x, y);
      }
    }
  }

  createPlayer() {
    const spawn = this.world.spawnTile;
    this.playerShadow = this.add
      .image(toWorldX(spawn.x), toWorldY(spawn.y) + 9, 'shadow-player')
      .setDepth(6);

    this.player = this.add
      .sprite(toWorldX(spawn.x), toWorldY(spawn.y), 'player-down-0')
      .setDepth(8)
      .setOrigin(0.5, 0.8);
  }

  createNpc() {
    const start = this.world.npcSchedule[0];
    this.npc.shadow = this.add
      .image(toWorldX(start.x), toWorldY(start.y) + 9, 'shadow-npc')
      .setDepth(6);

    this.npc.sprite = this.add
      .sprite(toWorldX(start.x), toWorldY(start.y), 'npc-down-0')
      .setDepth(8)
      .setOrigin(0.5, 0.8);

    this.npc.label = this.add
      .text(this.npc.sprite.x, this.npc.sprite.y - 24, NPC_NAME, {
        fontSize: '12px',
        color: '#f2e0ce',
        stroke: '#22160f',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(12);
  }

  createAtmosphere() {
    this.atmosphere = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x1f2e44, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(30);

    this.vignette = this.add
      .image(this.scale.width / 2, this.scale.height / 2, 'ui-vignette')
      .setScrollFactor(0)
      .setDepth(31)
      .setDisplaySize(this.scale.width, this.scale.height)
      .setAlpha(0.15);

    this.scale.on('resize', (size) => {
      this.atmosphere.setSize(size.width, size.height);
      this.vignette.setPosition(size.width / 2, size.height / 2);
      this.vignette.setDisplaySize(size.width, size.height);
    });
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
      upArrow: 'UP',
      downArrow: 'DOWN',
      leftArrow: 'LEFT',
      rightArrow: 'RIGHT',
      action: 'SPACE',
      interact: 'E',
      sleep: 'N',
      save: 'K',
      load: 'L',
      tool1: 'ONE',
      tool2: 'TWO',
      tool3: 'THREE',
      tool4: 'FOUR',
      tool5: 'FIVE',
    });
  }

  createUI() {
    this.uiPanel = this.add.image(10, 10, 'ui-panel').setOrigin(0).setScrollFactor(0).setDepth(50);

    this.uiText = this.add
      .text(22, 18, '', {
        fontSize: '15px',
        color: '#f9ecdc',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.helpText = this.add
      .text(
        22,
        111,
        'Move WASD/Arrows | Space Tool | E Interact | N Sleep | K/L Save/Load | 1-5 Tools',
        {
          fontSize: '12px',
          color: '#d6ba95',
        }
      )
      .setScrollFactor(0)
      .setDepth(52);

    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height - 18, '', {
        fontSize: '14px',
        color: '#ffe2aa',
        stroke: '#1a1208',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(60);

    this.scale.on('resize', (size) => {
      this.messageText.setPosition(size.width / 2, size.height - 18);
    });
  }

  update(_time, delta) {
    const seconds = delta / 1000;
    this.handleMovement(seconds);
    this.handleToolSelection();
    this.handleActions();
    this.updateClock(delta);
    this.updateNpc(seconds);
    this.updateAmbientVisuals(delta);
    this.updateCharacterAnimations(seconds);
    this.refreshUI();
  }

  handleMovement(seconds) {
    const rawX =
      (this.keys.left.isDown || this.keys.leftArrow.isDown ? -1 : 0) +
      (this.keys.right.isDown || this.keys.rightArrow.isDown ? 1 : 0);
    const rawY =
      (this.keys.up.isDown || this.keys.upArrow.isDown ? -1 : 0) +
      (this.keys.down.isDown || this.keys.downArrow.isDown ? 1 : 0);

    this.playerMoving = rawX !== 0 || rawY !== 0;

    if (this.playerMoving) {
      if (Math.abs(rawX) > Math.abs(rawY)) {
        this.facing = { x: Math.sign(rawX), y: 0 };
      } else {
        this.facing = { x: 0, y: Math.sign(rawY) };
      }
    }

    const vec = new Phaser.Math.Vector2(rawX, rawY);
    if (vec.lengthSq() > 0) {
      vec.normalize();
    }

    const speed = 120;
    const stepX = vec.x * speed * seconds;
    const stepY = vec.y * speed * seconds;

    const nextX = this.player.x + stepX;
    if (this.canWalk(nextX, this.player.y)) {
      this.player.x = nextX;
    }

    const nextY = this.player.y + stepY;
    if (this.canWalk(this.player.x, nextY)) {
      this.player.y = nextY;
    }

    this.playerShadow.setPosition(this.player.x, this.player.y + 9);
    this.player.setDepth(8 + this.player.y * 0.01);
    this.playerShadow.setDepth(7 + this.player.y * 0.01);
  }

  handleToolSelection() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.tool1)) {
      this.selectedTool = 0;
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.tool2)) {
      this.selectedTool = 1;
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.tool3)) {
      this.selectedTool = 2;
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.tool4)) {
      this.selectedTool = 3;
    } else if (Phaser.Input.Keyboard.JustDown(this.keys.tool5)) {
      this.selectedTool = 4;
    }
  }

  handleActions() {
    if (Phaser.Input.Keyboard.JustDown(this.keys.action)) {
      const selected = TOOL_ORDER[this.selectedTool];
      this.useSelectedTool(selected);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      this.contextInteract();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.sleep)) {
      this.trySleep();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.save)) {
      this.persist();
      this.showMessage('Manual save complete.');
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.load)) {
      const loaded = this.loadFromStorage();
      if (loaded) {
        this.showMessage('Save loaded.');
      } else {
        this.showMessage('No save found yet.');
      }
    }
  }

  updateClock(delta) {
    this.minuteAccumulator += (delta / 1000) * MINUTES_PER_SECOND;
    while (this.minuteAccumulator >= 1) {
      this.minuteAccumulator -= 1;
      this.totalMinutes += 1;

      if (this.totalMinutes >= 24 * 60) {
        this.nextDay(false);
      }
    }
  }

  useSelectedTool(tool) {
    if (tool === 'talk') {
      this.tryTalk();
      return;
    }

    const tile = this.getFacingTile();
    if (!tile) {
      return;
    }

    if (!this.isInFarmPlot(tile.x, tile.y)) {
      this.showMessage('You can only farm inside your field.');
      return;
    }

    const plot = this.getOrCreatePlot(tile.x, tile.y);

    if (tool === 'hoe') {
      if (!this.consumeStamina(2)) {
        return;
      }

      if (!plot.tilled) {
        plot.tilled = true;
        this.updatePlotVisual(tile.x, tile.y);
        this.showMessage('Soil tilled.');
      } else {
        this.showMessage('This tile is already tilled.');
      }
      return;
    }

    if (tool === 'water') {
      if (!plot.tilled) {
        this.showMessage('Till soil first.');
        return;
      }

      if (!this.consumeStamina(2)) {
        return;
      }

      plot.watered = true;
      this.updatePlotVisual(tile.x, tile.y);
      this.showMessage('Watered.');
      return;
    }

    if (tool === 'seed') {
      if (!plot.tilled) {
        this.showMessage('Till soil first.');
        return;
      }
      if (plot.crop) {
        this.showMessage('Something is already growing here.');
        return;
      }
      if (this.inventory.parsnipSeeds <= 0) {
        this.showMessage('No parsnip seeds left. Visit the shop.');
        return;
      }

      if (!this.consumeStamina(1)) {
        return;
      }

      this.inventory.parsnipSeeds -= 1;
      plot.crop = 'parsnip';
      plot.growth = 0;
      plot.ready = false;
      this.updatePlotVisual(tile.x, tile.y);
      this.showMessage('Parsnip planted.');
      return;
    }

    if (tool === 'harvest') {
      if (!plot.crop || !plot.ready) {
        this.showMessage('Nothing ready to harvest.');
        return;
      }

      if (!this.consumeStamina(1)) {
        return;
      }

      this.inventory.parsnip += 1;
      plot.crop = null;
      plot.growth = 0;
      plot.ready = false;
      plot.watered = false;
      this.updatePlotVisual(tile.x, tile.y);
      this.showMessage('Harvested 1 Parsnip.');
    }
  }

  contextInteract() {
    if (this.tryTalk()) {
      return;
    }

    const tile = this.getCurrentTile();
    const nearShop = this.isNearTile(tile, this.world.shopTile, 1);
    const nearBin = this.isNearTile(tile, this.world.shippingBinTile, 1);

    if (nearShop) {
      if (this.money >= SEED_COST) {
        this.money -= SEED_COST;
        this.inventory.parsnipSeeds += 1;
        this.showMessage(`Bought 1 parsnip seed for ${SEED_COST}g.`);
      } else {
        this.showMessage('Not enough gold.');
      }
      return;
    }

    if (nearBin) {
      if (this.inventory.parsnip > 0) {
        const qty = this.inventory.parsnip;
        const earned = qty * CROP_VALUE;
        this.inventory.parsnip = 0;
        this.money += earned;
        this.showMessage(`Shipped ${qty} parsnip for ${earned}g.`);
      } else {
        this.showMessage('Shipping bin is empty.');
      }
      return;
    }

    this.trySleep();
  }

  trySleep() {
    const tile = this.getCurrentTile();
    if (!this.isNearTile(tile, this.world.sleepTile, 1)) {
      return;
    }

    if (this.totalMinutes < 18 * 60) {
      this.showMessage('Too early to sleep. Try again after 6:00 PM.');
      return;
    }

    this.nextDay(true);
  }

  tryTalk() {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.npc.sprite.x,
      this.npc.sprite.y
    );

    if (distance > 44) {
      return false;
    }

    if (this.npc.lastTalkDay === this.day) {
      this.showMessage(`${NPC_NAME}: We already talked today.`);
      return true;
    }

    this.npc.lastTalkDay = this.day;
    this.npc.friendship += 1;

    const hour = Math.floor(this.totalMinutes / 60);
    if (hour < 10) {
      this.showMessage(`${NPC_NAME}: Morning. Your crops look promising.`);
    } else if (hour < 17) {
      this.showMessage(`${NPC_NAME}: The town square is lively today.`);
    } else {
      this.showMessage(`${NPC_NAME}: Long day. Don't forget to rest.`);
    }

    return true;
  }

  updateNpc(seconds) {
    const scheduleIndex = this.getScheduleIndexForTime(this.totalMinutes);
    this.npc.targetIndex = scheduleIndex;

    const target = this.world.npcSchedule[scheduleIndex];
    const targetX = toWorldX(target.x);
    const targetY = toWorldY(target.y);

    const dx = targetX - this.npc.sprite.x;
    const dy = targetY - this.npc.sprite.y;
    const dist = Math.hypot(dx, dy);

    this.npc.moving = dist > 1;

    if (this.npc.moving) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.npc.facing = { x: Math.sign(dx), y: 0 };
      } else {
        this.npc.facing = { x: 0, y: Math.sign(dy) };
      }

      const speed = 55;
      const move = Math.min(dist, speed * seconds);
      this.npc.sprite.x += (dx / dist) * move;
      this.npc.sprite.y += (dy / dist) * move;
    }

    this.npc.shadow.setPosition(this.npc.sprite.x, this.npc.sprite.y + 9);
    this.npc.label.setPosition(this.npc.sprite.x, this.npc.sprite.y - 24);
    this.npc.sprite.setDepth(8 + this.npc.sprite.y * 0.01);
    this.npc.shadow.setDepth(7 + this.npc.sprite.y * 0.01);
  }

  getScheduleIndexForTime(minutes) {
    const schedule = this.world.npcSchedule;
    let index = 0;
    for (let i = 0; i < schedule.length; i += 1) {
      if (minutes >= schedule[i].minute) {
        index = i;
      }
    }
    return index;
  }

  updateAmbientVisuals(delta) {
    this.waterAnimClock += delta;
    this.windClock += delta * 0.0033;

    if (this.waterAnimClock >= 220) {
      this.waterAnimClock = 0;
      this.waterFrame = (this.waterFrame + 1) % 4;

      for (const water of this.waterTiles) {
        water.image.setTexture(getTileTextureKey(TILE_TYPES.WATER, water.x, water.y, this.waterFrame));
      }
    }

    for (const deco of this.decorSprites) {
      if (!deco.sway) {
        continue;
      }
      deco.image.x = deco.baseX + Math.sin(this.windClock + deco.phase) * deco.swayAmount;
    }

    for (const prop of this.props) {
      if (!prop.sway) {
        continue;
      }
      prop.image.x = prop.baseX + Math.sin(this.windClock + prop.phase) * prop.swayAmount;
    }

    for (const visual of Object.values(this.plotVisuals)) {
      if (!visual.crop.visible) {
        continue;
      }

      const sway = Math.sin(this.windClock + visual.phase);
      const suffix = sway > 0 ? 'b' : 'a';
      visual.crop.x = visual.baseX + sway * 0.45;
      visual.crop.setTexture(`crop-${visual.stage}-${suffix}`);
    }

    const nightFactor = this.getNightFactor();
    for (const lantern of this.lanternGlows) {
      const pulse = 0.82 + Math.sin(this.windClock * 1.7 + lantern.phase * 2) * 0.18;
      lantern.glow.setAlpha(nightFactor * 0.52 * pulse);
    }

    this.updateAtmosphere();
  }

  getNightFactor() {
    const hour = this.totalMinutes / 60;

    if (hour >= 22 || hour < 5) {
      return 1;
    }

    if (hour >= 18 && hour < 22) {
      return (hour - 18) / 4;
    }

    if (hour >= 5 && hour < 8) {
      return 1 - (hour - 5) / 3;
    }

    return 0;
  }

  updateAtmosphere() {
    const hour = this.totalMinutes / 60;
    let alpha = 0.05;
    let color = 0x8a4e2d;

    if (hour < 5) {
      color = 0x1b2342;
      alpha = 0.34;
    } else if (hour < 8) {
      const t = (hour - 5) / 3;
      color = 0x7c5132;
      alpha = Phaser.Math.Linear(0.28, 0.06, t);
    } else if (hour < 16) {
      color = 0x8a4e2d;
      alpha = 0.03;
    } else if (hour < 19.5) {
      const t = (hour - 16) / 3.5;
      color = 0x6d3522;
      alpha = Phaser.Math.Linear(0.06, 0.21, t);
    } else if (hour < 22) {
      const t = (hour - 19.5) / 2.5;
      color = 0x24294a;
      alpha = Phaser.Math.Linear(0.21, 0.33, t);
    } else {
      color = 0x1b2342;
      alpha = 0.34;
    }

    if (this.weather === 'Cloudy') {
      alpha += 0.03;
      color = 0x3d3f4f;
    } else if (this.weather === 'Rainy') {
      alpha += 0.08;
      color = 0x344661;
    }

    this.atmosphere.fillColor = color;
    this.atmosphere.fillAlpha = Phaser.Math.Clamp(alpha, 0, 0.48);
    this.vignette.setAlpha(0.12 + this.atmosphere.fillAlpha * 1.1);
  }

  updateCharacterAnimations(seconds) {
    this.playerAnimClock += this.playerMoving ? seconds * 8 : 0;
    const playerFrame = this.playerMoving ? Math.floor(this.playerAnimClock) % 2 : 0;
    this.updateCharacterVisual(this.player, 'player', this.facing, this.playerMoving, playerFrame);

    this.npc.animClock += this.npc.moving ? seconds * 6.8 : 0;
    const npcFrame = this.npc.moving ? Math.floor(this.npc.animClock) % 2 : 0;
    this.updateCharacterVisual(this.npc.sprite, 'npc', this.npc.facing, this.npc.moving, npcFrame);
  }

  updateCharacterVisual(sprite, prefix, facing, _moving, frame) {
    const direction = directionFromFacing(facing);
    sprite.setTexture(`${prefix}-${direction}-${frame}`);

    if (direction === 'side') {
      sprite.setFlipX(facing.x < 0);
    } else {
      sprite.setFlipX(false);
    }
  }

  canWalk(x, y) {
    const radius = 7;
    const points = [
      { x: x - radius, y: y - radius },
      { x: x + radius, y: y - radius },
      { x: x - radius, y: y + radius },
      { x: x + radius, y: y + radius },
    ];

    for (const point of points) {
      const tx = toTile(point.x);
      const ty = toTile(point.y);

      if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) {
        return false;
      }

      if (this.world.blocked[ty][tx]) {
        return false;
      }
    }

    return true;
  }

  getCurrentTile() {
    return {
      x: toTile(this.player.x),
      y: toTile(this.player.y),
    };
  }

  getFacingTile() {
    const tile = this.getCurrentTile();
    const tx = tile.x + this.facing.x;
    const ty = tile.y + this.facing.y;
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) {
      return null;
    }

    return { x: tx, y: ty };
  }

  isInFarmPlot(x, y) {
    const field = this.world.farmPlotRect;
    return x >= field.x1 && x <= field.x2 && y >= field.y1 && y <= field.y2;
  }

  getOrCreatePlot(x, y) {
    const key = tileKey(x, y);
    if (!this.plots[key]) {
      this.plots[key] = {
        tilled: false,
        watered: false,
        crop: null,
        growth: 0,
        ready: false,
      };
    }

    return this.plots[key];
  }

  updatePlotVisual(x, y) {
    const key = tileKey(x, y);
    const plot = this.getOrCreatePlot(x, y);

    if (!this.plotVisuals[key]) {
      this.plotVisuals[key] = {
        soil: this.add.image(toWorldX(x), toWorldY(y), 'tile-soil-dry').setDepth(1.1).setVisible(false),
        crop: this.add.image(toWorldX(x), toWorldY(y), 'crop-1-a').setDepth(3.3).setVisible(false),
        baseX: toWorldX(x),
        phase: coordNoise(x, y, 271) * Math.PI * 2,
        stage: 1,
      };
    }

    const visual = this.plotVisuals[key];
    if (!plot.tilled) {
      visual.soil.setVisible(false);
      visual.crop.setVisible(false);
      return;
    }

    visual.soil.setVisible(true);
    visual.soil.setTexture(plot.watered ? 'tile-soil-wet' : 'tile-soil-dry');

    if (!plot.crop) {
      visual.crop.setVisible(false);
      return;
    }

    visual.crop.setVisible(true);

    if (plot.ready) {
      visual.stage = 3;
      visual.crop.setTexture('crop-3-a');
      return;
    }

    if (plot.growth <= 0) {
      visual.stage = 1;
      visual.crop.setTexture('crop-1-a');
    } else if (plot.growth === 1) {
      visual.stage = 2;
      visual.crop.setTexture('crop-2-a');
    } else {
      visual.stage = 3;
      visual.crop.setTexture('crop-3-a');
    }
  }

  nextDay(fromSleep) {
    this.day += 1;

    for (const [key, plot] of Object.entries(this.plots)) {
      if (plot.crop && plot.watered) {
        plot.growth += 1;
        if (plot.growth >= 3) {
          plot.ready = true;
        }
      }

      plot.watered = false;

      const [xStr, yStr] = key.split(',');
      this.updatePlotVisual(Number(xStr), Number(yStr));
    }

    this.totalMinutes = 6 * 60;
    this.stamina = STAMINA_MAX;
    this.weather = chooseNextWeather(this.rng);
    this.applyRainIfNeeded();
    this.persist();

    if (fromSleep) {
      this.showMessage(`Day ${this.day}. You wake up feeling refreshed.`);
    } else {
      this.showMessage(`You passed out. Day ${this.day} begins.`);
    }
  }

  applyRainIfNeeded() {
    if (this.weather !== 'Rainy') {
      return;
    }

    for (const [key, plot] of Object.entries(this.plots)) {
      if (plot.tilled) {
        plot.watered = true;
        const [xStr, yStr] = key.split(',');
        this.updatePlotVisual(Number(xStr), Number(yStr));
      }
    }

    this.showMessage('Rainy day: your tilled soil has been watered for free.');
  }

  isNearTile(tileA, tileB, distance) {
    const dx = Math.abs(tileA.x - tileB.x);
    const dy = Math.abs(tileA.y - tileB.y);
    return dx <= distance && dy <= distance;
  }

  consumeStamina(cost) {
    if (this.stamina < cost) {
      this.showMessage('Too exhausted. Sleep to recover stamina.');
      return false;
    }

    this.stamina -= cost;
    return true;
  }

  formatTime() {
    const hour = Math.floor(this.totalMinutes / 60);
    const minute = this.totalMinutes % 60;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    const mm = String(minute).padStart(2, '0');
    return `${twelve}:${mm} ${suffix}`;
  }

  refreshUI() {
    const selected = TOOL_ORDER[this.selectedTool];
    const staminaPct = Math.round((this.stamina / STAMINA_MAX) * 100);

    this.uiText.setText(
      [
        `Day ${this.day}  |  ${this.formatTime()}  |  ${this.weather}`,
        `Gold ${this.money}g  |  Stamina ${this.stamina}/${STAMINA_MAX} (${staminaPct}%)`,
        `Seeds ${this.inventory.parsnipSeeds}  |  Parsnips ${this.inventory.parsnip}`,
        `Tool ${this.selectedTool + 1}: ${TOOL_LABELS[selected]}  |  ${NPC_NAME} Bond ${this.npc.friendship}`,
      ].join('\n')
    );
  }

  showMessage(text) {
    this.messageText.setText(text);

    if (this.messageTimer) {
      this.messageTimer.remove();
    }

    this.messageTimer = this.time.delayedCall(3000, () => {
      this.messageText.setText('');
      this.messageTimer = null;
    });
  }

  serializeState() {
    return {
      day: this.day,
      totalMinutes: this.totalMinutes,
      weather: this.weather,
      stamina: this.stamina,
      money: this.money,
      inventory: this.inventory,
      plots: this.plots,
      npc: {
        friendship: this.npc.friendship,
        lastTalkDay: this.npc.lastTalkDay,
        x: this.npc.sprite.x,
        y: this.npc.sprite.y,
        facing: this.npc.facing,
      },
      player: {
        x: this.player.x,
        y: this.player.y,
        facing: this.facing,
        selectedTool: this.selectedTool,
      },
    };
  }

  applyState(data) {
    this.day = data.day ?? 1;
    this.totalMinutes = data.totalMinutes ?? 6 * 60;
    this.weather = data.weather ?? 'Sunny';
    this.stamina = Phaser.Math.Clamp(data.stamina ?? STAMINA_MAX, 0, STAMINA_MAX);
    this.money = data.money ?? 120;

    this.inventory = {
      parsnipSeeds: data.inventory?.parsnipSeeds ?? 8,
      parsnip: data.inventory?.parsnip ?? 0,
    };

    this.plots = data.plots ?? {};

    for (const [key, plot] of Object.entries(this.plots)) {
      if (!plot || typeof plot !== 'object') {
        continue;
      }
      const [xStr, yStr] = key.split(',');
      this.updatePlotVisual(Number(xStr), Number(yStr));
    }

    this.npc.friendship = data.npc?.friendship ?? 0;
    this.npc.lastTalkDay = data.npc?.lastTalkDay ?? 0;
    this.npc.facing = {
      x: data.npc?.facing?.x ?? 0,
      y: data.npc?.facing?.y ?? 1,
    };

    if (typeof data.npc?.x === 'number') {
      this.npc.sprite.x = data.npc.x;
      this.npc.shadow.x = data.npc.x;
    }
    if (typeof data.npc?.y === 'number') {
      this.npc.sprite.y = data.npc.y;
      this.npc.shadow.y = data.npc.y + 9;
    }

    if (typeof data.player?.x === 'number' && typeof data.player?.y === 'number') {
      this.player.x = data.player.x;
      this.player.y = data.player.y;
      this.playerShadow.x = data.player.x;
      this.playerShadow.y = data.player.y + 9;
    }

    this.facing = {
      x: data.player?.facing?.x ?? 0,
      y: data.player?.facing?.y ?? 1,
    };

    this.selectedTool = Phaser.Math.Clamp(data.player?.selectedTool ?? 0, 0, TOOL_ORDER.length - 1);
  }

  persist() {
    saveGameState(this.serializeState());
  }

  loadFromStorage() {
    const data = loadGameState();
    if (!data) {
      return false;
    }

    this.applyState(data);
    return true;
  }
}
