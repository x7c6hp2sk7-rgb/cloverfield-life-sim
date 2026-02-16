import Phaser from 'phaser';
import { bootstrapArt } from '../art';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    bootstrapArt(this);
    this.scene.start('GameScene');
  }
}
