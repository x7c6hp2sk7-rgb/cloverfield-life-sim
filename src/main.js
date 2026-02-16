import Phaser from 'phaser';
import './style.css';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  backgroundColor: '#1a1d1f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 640,
      height: 360,
    },
  },
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
