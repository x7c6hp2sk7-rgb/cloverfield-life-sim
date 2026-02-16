import Phaser from 'phaser';
import {
  NPC_NAME,
  TILE_SIZE,
  TILE_TEXTURES,
  TOOL_LABELS,
  TOOL_ORDER,
  WEATHER_TYPES,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../constants';
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
      friendship: 0,
      lastTalkDay: 0,
      targetIndex: 0,
    };

    this.drawWorld();
    this.createPlayer();
    this.createNpc();
    this.createInput();
    this.createUI();
    this.loadFromStorage();
    this.applyRainIfNeeded();

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH * TILE_SIZE, WORLD_HEIGHT * TILE_SIZE);
    this.cameras.main.setZoom(1.2);

    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => this.persist(),
    });

    this.showMessage('Welcome to Cloverfield. Grow crops, meet neighbors, and build your farm.');
    this.refreshUI();
  }

  drawWorld() {
    this.baseLayer = [];
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      const row = [];
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const texture = TILE_TEXTURES[this.world.tiles[y][x]];
        const tile = this.add.image(toWorldX(x), toWorldY(y), texture).setDepth(0);
        row.push(tile);
      }
      this.baseLayer.push(row);
    }
  }

  createPlayer() {
    const spawn = this.world.spawnTile;
    this.player = this.add.sprite(toWorldX(spawn.x), toWorldY(spawn.y), 'player').setDepth(8);
  }

  createNpc() {
    const start = this.world.npcSchedule[0];
    this.npc.sprite = this.add.sprite(toWorldX(start.x), toWorldY(start.y), 'npc').setDepth(8);
    this.npc.label = this.add
      .text(this.npc.sprite.x, this.npc.sprite.y - 18, NPC_NAME, {
        fontSize: '12px',
        color: '#d7f0ff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9);
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
    this.uiPanel = this.add
      .rectangle(10, 10, 430, 132, 0x0a0f14, 0.78)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(50);

    this.uiText = this.add
      .text(20, 16, '', {
        fontSize: '16px',
        color: '#f5efe2',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(52);

    this.helpText = this.add
      .text(
        20,
        110,
        'Move WASD/Arrows | Space = Tool | E = Context | N = Sleep | K/L = Save/Load | 1-5 = Tool',
        {
          fontSize: '12px',
          color: '#b9d7d5',
        }
      )
      .setScrollFactor(0)
      .setDepth(52);

    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height - 20, '', {
        fontSize: '14px',
        color: '#ffec9e',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(60);

    this.scale.on('resize', (size) => {
      this.messageText.setPosition(size.width / 2, size.height - 20);
    });
  }

  update(_time, delta) {
    const seconds = delta / 1000;
    this.handleMovement(seconds);
    this.handleToolSelection();
    this.handleActions();
    this.updateClock(delta);
    this.updateNpc(seconds);
    this.refreshUI();
  }

  handleMovement(seconds) {
    const moveX =
      (this.keys.left.isDown || this.keys.leftArrow.isDown ? -1 : 0) +
      (this.keys.right.isDown || this.keys.rightArrow.isDown ? 1 : 0);
    const moveY =
      (this.keys.up.isDown || this.keys.upArrow.isDown ? -1 : 0) +
      (this.keys.down.isDown || this.keys.downArrow.isDown ? 1 : 0);

    const vec = new Phaser.Math.Vector2(moveX, moveY);
    if (vec.lengthSq() > 0) {
      vec.normalize();
      this.facing.x = Math.round(vec.x);
      this.facing.y = Math.round(vec.y);
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
    if (dist > 1) {
      const speed = 55;
      const move = Math.min(dist, speed * seconds);
      this.npc.sprite.x += (dx / dist) * move;
      this.npc.sprite.y += (dy / dist) * move;
    }

    this.npc.label.setPosition(this.npc.sprite.x, this.npc.sprite.y - 18);
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

  canWalk(x, y) {
    const radius = 8;
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
        soil: this.add.image(toWorldX(x), toWorldY(y), 'tile-soil-dry').setDepth(1).setVisible(false),
        crop: this.add.image(toWorldX(x), toWorldY(y), 'crop-1').setDepth(2).setVisible(false),
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
      visual.crop.setTexture('crop-3');
      return;
    }

    if (plot.growth <= 0) {
      visual.crop.setTexture('crop-1');
    } else if (plot.growth === 1) {
      visual.crop.setTexture('crop-2');
    } else {
      visual.crop.setTexture('crop-3');
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
        `Day ${this.day} | Time ${this.formatTime()} | Weather ${this.weather}`,
        `Gold ${this.money}g | Stamina ${this.stamina}/${STAMINA_MAX} (${staminaPct}%)`,
        `Seeds ${this.inventory.parsnipSeeds} | Parsnips ${this.inventory.parsnip}`,
        `Tool ${this.selectedTool + 1}: ${TOOL_LABELS[selected]} | ${NPC_NAME} Friendship ${this.npc.friendship}`,
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
    if (typeof data.npc?.x === 'number') {
      this.npc.sprite.x = data.npc.x;
    }
    if (typeof data.npc?.y === 'number') {
      this.npc.sprite.y = data.npc.y;
    }

    if (typeof data.player?.x === 'number' && typeof data.player?.y === 'number') {
      this.player.x = data.player.x;
      this.player.y = data.player.y;
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
