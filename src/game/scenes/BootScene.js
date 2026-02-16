import Phaser from 'phaser';
import { TILE_SIZE } from '../constants';

function makeTile(scene, key, fill, stroke = 0x000000, alpha = 0.2) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(fill, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.lineStyle(2, stroke, alpha);
  g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.generateTexture(key, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    const pixel = this.make.graphics({ x: 0, y: 0, add: false });
    pixel.fillStyle(0xffffff, 1);
    pixel.fillRect(0, 0, 1, 1);
    pixel.generateTexture('pixel', 1, 1);
    pixel.destroy();

    makeTile(this, 'tile-grass', 0x5c9c56, 0x1c2e1f);
    makeTile(this, 'tile-path', 0xb58f68, 0x3a2a1a);
    makeTile(this, 'tile-water', 0x4b7be0, 0x1d3260);
    makeTile(this, 'tile-fence', 0x8d6b43, 0x2c1d0f);
    makeTile(this, 'tile-house', 0x705947, 0x2e231b);
    makeTile(this, 'tile-shop', 0x8f6a86, 0x2d1f2a);
    makeTile(this, 'tile-bin', 0x6f4f2b, 0x25190b);
    makeTile(this, 'tile-soil-dry', 0x6f4b2a, 0x2b1c0f);
    makeTile(this, 'tile-soil-wet', 0x4e3d31, 0x1f1814);

    this.makeCropTexture('crop-1', 0x73d451, 5);
    this.makeCropTexture('crop-2', 0x5fbb45, 9);
    this.makeCropTexture('crop-3', 0xd8c96d, 12);

    this.makeCharacterTexture('player', 0xf1d27f, 0x3b2b16);
    this.makeCharacterTexture('npc', 0x9ad9ff, 0x153040);

    this.scene.start('GameScene');
  }

  makeCharacterTexture(key, bodyColor, accentColor) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(bodyColor, 1);
    g.fillRect(0, 0, 20, 20);
    g.fillStyle(accentColor, 1);
    g.fillRect(3, 3, 14, 5);
    g.generateTexture(key, 20, 20);
    g.destroy();
  }

  makeCropTexture(key, color, stemHeight) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x3f7c3f, 1);
    g.fillRect(14, 30 - stemHeight, 4, stemHeight);
    g.fillStyle(color, 1);
    g.fillCircle(16, 27 - stemHeight, 6);
    g.generateTexture(key, TILE_SIZE, TILE_SIZE);
    g.destroy();
  }
}
