import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, LAYOUT_LABELS } from '../config/constants';
import { autoArchiveOne, createGameState, getHintIds, setLocked, shuffleBoardCards, shuffleBoardCardsForClickables, tapCard, validateLevel, withDeadlockCheck } from '../game/rules';
import type { GameState, LayoutCard, LayoutKind, LevelConfig } from '../game/types';
import { buildLayout } from '../layouts';
import { SHELF_CARD_SIZE, SHELF_GAP_Y, SHELF_GRID_ROWS, SHELF_LAYER_ROWS, SHELF_START_X, SHELF_START_Y, SHELF_VISIBLE_SLOTS, SHELF_WIDTH } from '../layouts/shelf';

const LEVEL_KEY = 'test-level';
const LAYOUTS: LayoutKind[] = ['grid', 'stack', 'shelf', 'overlap'];

export class GameScene extends Phaser.Scene {
  private level!: LevelConfig;
  private state!: GameState;
  private layoutKind: LayoutKind = 'grid';
  private backgroundLayer!: Phaser.GameObjects.Container;
  private cardsLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private dropdownLayer!: Phaser.GameObjects.Container;
  private hintIds = new Set<string>();
  private cardNodes = new Map<string, Phaser.GameObjects.Container>();
  private revealingCardIds = new Set<string>();
  private countdownSeconds = 10;
  private countdownText?: Phaser.GameObjects.Text;
  private countdownEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.json(LEVEL_KEY, assetUrl('levels/test-level.json'));
  }

  create(): void {
    this.level = this.cache.json.get(LEVEL_KEY) as LevelConfig;
    validateLevel(this.level);
    this.backgroundLayer = this.add.container(0, 0);
    this.cardsLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.dropdownLayer = this.add.container(0, 0);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleBoardPointer(pointer));

    for (const card of this.level.cards) {
      if (!this.textures.exists(card.asset)) {
        this.load.image(card.asset, encodeURI(assetUrl(card.asset)));
      }
    }

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.resetLevel();
    });
    this.load.start();
  }

  private resetLevel(): void {
    this.hintIds.clear();
    this.revealingCardIds.clear();
    this.countdownSeconds = 10;
    this.countdownEvent?.remove(false);
    this.state = createGameState(this.level);
    this.render();
    this.countdownEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.tickCountdown()
    });
  }

  private render(): void {
    this.backgroundLayer.removeAll(true);
    this.cardsLayer.removeAll(true);
    this.uiLayer.removeAll(true);
    this.dropdownLayer.removeAll(true);

    const layout = buildLayout(this.layoutKind, this.state.cards);
    const clickableIds = new Set(layout.filter((item) => item.clickable).map((item) => item.cardId));
    this.state = withDeadlockCheck(this.state, clickableIds);

    this.drawBackground();
    this.drawHud();
    this.drawBoard(layout);
    this.drawTray();
    this.drawTools(clickableIds);
    this.drawStatus();
  }

  private drawBackground(): void {
    this.backgroundLayer.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xf5efe6).setOrigin(0));
    this.backgroundLayer.add(this.add.rectangle(16, 94, GAME_WIDTH - 32, 506, 0xfff8ec, 1).setOrigin(0).setStrokeStyle(2, 0xe2d0b8));
  }

  private drawHud(): void {
    this.uiLayer.add(this.add.text(22, 20, '今日推荐榜', { fontSize: '24px', color: '#221811', fontStyle: 'bold' }));
    this.uiLayer.add(this.add.text(22, 52, this.level.title, { fontSize: '14px', color: '#6d5b49' }));
    this.countdownText = this.add.text(214, 28, formatCountdown(this.countdownSeconds), { fontSize: '24px', color: '#241912', fontStyle: 'bold' });
    this.uiLayer.add(this.countdownText);
    this.uiLayer.add(this.add.text(318, 28, `${this.state.archivedCount / 3}/${this.level.cards.length / 3}组`, { fontSize: '16px', color: '#45382d', fontStyle: 'bold' }));

    const button = this.add.rectangle(22, 610, 142, 38, 0xffffff, 1).setOrigin(0).setStrokeStyle(1, 0xd0bda6).setInteractive({ useHandCursor: true });
    const label = this.add.text(34, 620, LAYOUT_LABELS[this.layoutKind], { fontSize: '14px', color: '#34251a', fontStyle: 'bold' });
    button.on('pointerdown', () => {
      if (this.state.locked) return;
      this.toggleDropdown();
    });
    this.uiLayer.add([button, label]);
  }

  private drawBoard(layout: LayoutCard[]): void {
    this.cardNodes.clear();
    const byId = new Map(layout.map((item) => [item.cardId, item]));
    const boardCards = this.state.cards.filter((card) => card.status === 'board');
    boardCards.sort((a, b) => (byId.get(a.id)?.z ?? 0) - (byId.get(b.id)?.z ?? 0));

    if (this.layoutKind === 'grid') this.drawShelves(SHELF_GRID_ROWS);
    if (this.layoutKind === 'shelf') this.drawShelves(SHELF_LAYER_ROWS);

    for (const card of boardCards) {
      const layoutCard = byId.get(card.id);
      if (!layoutCard) continue;
      const node = this.createCardNode(card.id, card.asset, layoutCard);
      this.cardNodes.set(card.id, node);
      this.cardsLayer.add(node);
    }
    this.revealingCardIds.clear();
  }

  private drawShelves(rows: number): void {
    for (let row = 0; row < rows; row++) {
      const y = SHELF_START_Y + row * SHELF_GAP_Y + SHELF_CARD_SIZE - 2;
      this.cardsLayer.add(this.add.rectangle(SHELF_START_X - 8, y, SHELF_WIDTH, 8, 0x9a7147, 1).setOrigin(0));
      this.cardsLayer.add(this.add.rectangle(SHELF_START_X - 8, y + 8, SHELF_WIDTH, 3, 0x6f5136, 1).setOrigin(0));
    }
  }

  private createCardNode(cardId: string, asset: string, layoutCard: LayoutCard): Phaser.GameObjects.Container {
    const container = this.add.container(layoutCard.x, layoutCard.y);
    container.setSize(layoutCard.width, layoutCard.height);
    container.setDepth(layoutCard.z);
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, layoutCard.width, layoutCard.height), Phaser.Geom.Rectangle.Contains);

    const blocked = !layoutCard.clickable;
    const frameColor = this.hintIds.has(cardId) ? 0xffd36a : 0xefe4d1;
    const bg = this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, blocked ? 0x8e867c : 0xffffff, 1).setOrigin(0).setStrokeStyle(3, frameColor);
    const image = this.add.image(5, 5, asset).setOrigin(0).setDisplaySize(layoutCard.width - 10, layoutCard.width - 10);
    const tag = this.add.text(5, 4, blocked ? 'LOCK' : 'HOT', { fontSize: '8px', color: '#ffffff', backgroundColor: blocked ? '#555555' : '#df4b38', padding: { x: 3, y: 1 } });

    if (blocked) {
      container.setAlpha(0.72);
      image.setTint(0x777777);
    }
    container.add([bg, image, tag]);

    if (this.revealingCardIds.has(cardId)) {
      const targetAlpha = container.alpha;
      container.setAlpha(0);
      container.setScale(0.9);
      this.tweens.add({
        targets: container,
        alpha: targetAlpha,
        scale: 1,
        duration: 220,
        ease: 'Cubic.easeOut'
      });
    }

    return container;
  }

  private handleBoardPointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.y < 94 || pointer.y > 600) return;

    const layout = buildLayout(this.layoutKind, this.state.cards);
    const target = layout
      .filter((card) => pointInLayoutCard(pointer.x, pointer.y, card))
      .sort((a, b) => b.z - a.z)[0];
    if (!target) return;

    const node = this.cardNodes.get(target.cardId);
    if (!node) return;
    this.handleCardTap(target.cardId, target, node);
  }

  private handleCardTap(cardId: string, layoutCard: LayoutCard, node: Phaser.GameObjects.Container): void {
    if (this.state.locked) {
      this.bumpBusy(node);
      return;
    }
    if (!layoutCard.clickable) {
      this.bumpBlocked(node);
      return;
    }

    const layout = buildLayout(this.layoutKind, this.state.cards);
    const clickableIds = new Set(layout.filter((item) => item.clickable).map((item) => item.cardId));
    const result = tapCard(this.state, cardId, clickableIds);

    if (result.blockedReason) {
      this.bumpBlocked(node);
      return;
    }

    const card = this.state.cards.find((item) => item.id === cardId);
    if (!card) return;

    this.state = setLocked(this.state, true);
    this.hintIds.clear();
    const visualTray = [...this.state.tray, cardId];
    node.disableInteractive();
    node.setAlpha(0.28);
    this.flyCardToTray(card.asset, layoutCard, this.state.tray.length, () => {
      if (result.archivedCardIds.length === 3) {
        this.playArchiveMerge(result.archivedCardIds, visualTray, () => {
          this.recordShelfReveals(result.archivedCardIds, result.state);
          this.state = setLocked(result.state, false);
          this.render();
        });
        return;
      }

      this.state = setLocked(result.state, false);
      this.render();
    });
  }

  private recordShelfReveals(archivedCardIds: string[], nextState: GameState): void {
    if (this.layoutKind !== 'shelf') return;

    for (const cardId of archivedCardIds) {
      const frontIndex = this.level.cards.findIndex((card) => card.id === cardId);
      if (frontIndex < 0 || frontIndex >= SHELF_VISIBLE_SLOTS) continue;
      const backCard = nextState.cards[frontIndex + SHELF_VISIBLE_SLOTS];
      if (backCard?.status === 'board') this.revealingCardIds.add(backCard.id);
    }
  }

  private flyCardToTray(asset: string, layoutCard: LayoutCard, trayIndex: number, onComplete: () => void): void {
    const startX = layoutCard.x;
    const startY = layoutCard.y;
    const targetX = 26 + Math.min(trayIndex, this.state.slotCount - 1) * 51 + 4;
    const targetY = 694;

    const flyer = this.add.container(startX, startY).setDepth(9999);
    flyer.add(this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, 0xffffff, 1).setOrigin(0).setStrokeStyle(3, 0xffd36a));
    flyer.add(this.add.image(5, 5, asset).setOrigin(0).setDisplaySize(layoutCard.width - 10, layoutCard.width - 10));

    this.tweens.add({
      targets: flyer,
      x: targetX,
      y: targetY,
      scale: 0.78,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        flyer.destroy();
        onComplete();
      }
    });
  }

  private playArchiveMerge(archiveIds: string[], visualTray: string[], onComplete: () => void): void {
    const slots = archiveIds
      .map((id) => ({ id, index: visualTray.indexOf(id) }))
      .filter((item) => item.index >= 0);
    if (slots.length !== 3) {
      onComplete();
      return;
    }

    const targetIndex = slots[1].index;
    const target = getTrayImagePosition(targetIndex);
    const archiveNodes = slots.map(({ id, index }) => {
      const card = this.state.cards.find((item) => item.id === id);
      const position = getTrayImagePosition(index);
      const node = this.add.container(position.x, position.y).setDepth(10000);
      if (card) {
        node.add(this.add.rectangle(0, 0, 38, 34, 0xffffff, 1).setOrigin(0).setStrokeStyle(2, 0xffd36a));
        node.add(this.add.image(2, 2, card.asset).setOrigin(0).setDisplaySize(34, 30));
      }
      return node;
    });

    this.tweens.add({
      targets: archiveNodes,
      x: target.x,
      y: target.y,
      scale: 1.1,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: archiveNodes,
          alpha: 0,
          scale: 0.35,
          duration: 140,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            for (const node of archiveNodes) node.destroy();
            onComplete();
          }
        });
      }
    });
  }

  private bumpBlocked(node: Phaser.GameObjects.Container): void {
    const originX = node.x;
    const originAlpha = node.alpha;
    this.state = setLocked(this.state, true);
    node.disableInteractive();
    node.setAlpha(0.36);
    this.tweens.add({
      targets: node,
      x: originX + 6,
      yoyo: true,
      repeat: 3,
      duration: 42,
      onComplete: () => {
        node.x = originX;
        node.setAlpha(originAlpha);
        node.setInteractive(new Phaser.Geom.Rectangle(0, 0, node.width, node.height), Phaser.Geom.Rectangle.Contains);
        this.state = setLocked(this.state, false);
      }
    });
  }

  private bumpBusy(node: Phaser.GameObjects.Container): void {
    const originScale = node.scale;
    this.tweens.add({
      targets: node,
      scale: originScale * 0.96,
      yoyo: true,
      duration: 55,
      onComplete: () => {
        node.setScale(originScale);
      }
    });
  }

  private drawTray(): void {
    this.uiLayer.add(this.add.rectangle(16, 656, GAME_WIDTH - 32, 84, 0x5d554c, 1).setOrigin(0));
    this.uiLayer.add(this.add.text(26, 664, `待归档区 ${this.state.tray.length}/${this.state.slotCount}`, { fontSize: '15px', color: '#ffffff', fontStyle: 'bold' }));

    for (let index = 0; index < this.state.slotCount; index++) {
      const x = 26 + index * 51;
      const y = 690;
      this.uiLayer.add(this.add.rectangle(x, y, 46, 42, 0x83796e, 1).setOrigin(0).setStrokeStyle(1, 0xd9cbbb));
      const cardId = this.state.tray[index];
      const card = this.state.cards.find((item) => item.id === cardId);
      if (card) {
        this.uiLayer.add(this.add.image(x + 4, y + 4, card.asset).setOrigin(0).setDisplaySize(38, 34));
      }
    }
  }

  private drawTools(clickableIds: Set<string>): void {
    this.addToolButton(32, 758, '数据提示', () => {
      if (this.state.locked) return;
      this.hintIds = new Set(getHintIds(this.state, clickableIds));
      this.render();
    });
    this.addToolButton(152, 758, '一键重排', () => {
      if (this.state.locked) return;
      this.state = this.layoutKind === 'stack'
        ? shuffleBoardCardsForClickables(this.state, clickableIds)
        : shuffleBoardCards(this.state);
      this.render();
    });
    this.addToolButton(272, 758, '系统归档', () => {
      if (this.state.locked) return;
      this.state = autoArchiveOne(this.state, clickableIds);
      this.render();
    });
  }

  private addToolButton(x: number, y: number, text: string, onClick: () => void): void {
    const button = this.add.rectangle(x, y, 86, 48, 0xfffbf3, 1).setOrigin(0).setStrokeStyle(1, 0xd1bfa8).setInteractive({ useHandCursor: true });
    const label = this.add.text(x + 12, y + 16, text, { fontSize: '13px', color: '#0d57d8', fontStyle: 'bold' });
    button.on('pointerdown', onClick);
    this.uiLayer.add([button, label]);
  }

  private drawStatus(): void {
    const text = this.state.status === 'playing' ? this.state.message : this.state.message || this.state.status;
    if (!text) return;
    const color = this.state.status === 'failed' ? '#b42318' : this.state.status === 'won' ? '#087443' : '#624b31';
    this.uiLayer.add(this.add.text(24, 618, text, { fontSize: '13px', color, fixedWidth: 340 }));
  }

  private tickCountdown(): void {
    this.countdownSeconds = Math.max(0, this.countdownSeconds - 1);
    this.countdownText?.setText(formatCountdown(this.countdownSeconds));
    if (this.countdownSeconds === 0) {
      this.countdownEvent?.remove(false);
    }
  }

  private toggleDropdown(): void {
    if (this.state.locked) return;

    if (this.dropdownLayer.list.length > 0) {
      this.dropdownLayer.removeAll(true);
      return;
    }

    this.dropdownLayer.add(this.add.rectangle(22, 650, 190, 148, 0xffffff, 1).setOrigin(0).setStrokeStyle(1, 0xd1bfa8));
    LAYOUTS.forEach((kind, index) => {
      const y = 660 + index * 32;
      const item = this.add.rectangle(30, y, 174, 28, kind === this.layoutKind ? 0xe9f0ff : 0xffffff, 1).setOrigin(0).setInteractive({ useHandCursor: true });
      const text = this.add.text(38, y + 7, LAYOUT_LABELS[kind], { fontSize: '13px', color: '#2b2119' });
      item.on('pointerdown', () => {
        this.layoutKind = kind;
        this.resetLevel();
      });
      this.dropdownLayer.add([item, text]);
    });
  }
}

function getTrayImagePosition(index: number): { x: number; y: number } {
  return {
    x: 26 + index * 51 + 4,
    y: 694
  };
}

function pointInLayoutCard(x: number, y: number, card: LayoutCard): boolean {
  return x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height;
}

function formatCountdown(seconds: number): string {
  return `00:${seconds.toString().padStart(2, '0')}`;
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
