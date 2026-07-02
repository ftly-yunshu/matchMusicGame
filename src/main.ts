import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/constants';
import { GameScene } from './scenes/GameScene';

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'app',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#d9f2ff',
  render: {
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: false
  }
});
