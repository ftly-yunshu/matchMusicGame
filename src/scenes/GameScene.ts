import Phaser from 'phaser';
import { ANIMATION, ARCHIVE_PANEL, GAME_HEIGHT, GAME_WIDTH, LAYOUT_LABELS, PALETTE, UI_ASSETS } from '../config/constants';
import { autoArchiveOne, createGameState, getHintIds, setLocked, shuffleBoardCards, shuffleBoardCardsForClickables, tapCard, validateLevel, withDeadlockCheck } from '../game/rules';
import type { GameState, LayoutCard, LayoutKind, LevelConfig } from '../game/types';
import { buildLayout } from '../layouts';
import { GRID_CARD_SIZE, GRID_GAP_Y, GRID_ROWS, GRID_START_X, GRID_START_Y, GRID_WIDTH } from '../layouts/grid';
import { SHELF_CARD_SIZE, SHELF_GAP_Y, SHELF_LAYER_ROWS, SHELF_START_X, SHELF_START_Y, SHELF_VISIBLE_SLOTS, SHELF_WIDTH } from '../layouts/shelf';

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
  private playBoardEntrance = true;
  private toastMessage = '';
  private countdownSeconds = 10;
  private countdownText?: Phaser.GameObjects.Text;
  private countdownEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.json(LEVEL_KEY, assetUrl('levels/test-level.json'));
    for (const asset of Object.values(UI_ASSETS)) {
      this.load.image(asset, assetUrl(asset));
    }
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
    this.toastMessage = '';
    this.playBoardEntrance = true;
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
    this.backgroundLayer.add(this.add.image(0, 0, UI_ASSETS.studioBackground).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
    this.backgroundLayer.add(this.add.rectangle(14, 92, GAME_WIDTH - 28, 512, PALETTE.pageShadow, 0.18).setOrigin(0));
    this.backgroundLayer.add(this.add.rectangle(16, 94, GAME_WIDTH - 32, 506, PALETTE.board, 0.72).setOrigin(0).setStrokeStyle(2, PALETTE.boardLine));
    this.backgroundLayer.add(this.add.image(330, 206, UI_ASSETS.tempoMeter).setOrigin(0).setDisplaySize(42, 88).setAlpha(0.78));
  }

  private drawHud(): void {
    this.uiLayer.add(this.add.image(19, 9, UI_ASSETS.headerConsole).setOrigin(0).setDisplaySize(352, 72));
    this.uiLayer.add(this.add.text(34, 21, '今日推荐榜', { fontSize: '22px', color: PALETTE.ink, fontStyle: 'bold' }));
    this.uiLayer.add(this.add.text(34, 52, this.level.title, { fontSize: '13px', color: PALETTE.mutedInk }));
    this.countdownText = this.add.text(222, 25, formatCountdown(this.countdownSeconds), { fontSize: '25px', color: PALETTE.ink, fontStyle: 'bold' });
    this.uiLayer.add(this.countdownText);

    const button = this.add.image(22, 606, UI_ASSETS.modeTicket).setOrigin(0).setDisplaySize(154, 42).setInteractive({ useHandCursor: true });
    const label = this.add.text(38, 618, LAYOUT_LABELS[this.layoutKind], { fontSize: '14px', color: '#fff8ed', fontStyle: 'bold' });
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

    if (this.layoutKind === 'grid') this.drawShelves(GRID_ROWS, GRID_START_X, GRID_START_Y, GRID_GAP_Y, GRID_CARD_SIZE, GRID_WIDTH);
    if (this.layoutKind === 'shelf') this.drawShelves(SHELF_LAYER_ROWS, SHELF_START_X, SHELF_START_Y, SHELF_GAP_Y, SHELF_CARD_SIZE, SHELF_WIDTH);

    for (const card of boardCards) {
      const layoutCard = byId.get(card.id);
      if (!layoutCard) continue;
      const node = this.createCardNode(card.id, card.asset, layoutCard);
      this.cardNodes.set(card.id, node);
      this.cardsLayer.add(node);
      if (this.playBoardEntrance) this.playCardEntrance(node, layoutCard.z);
    }
    this.revealingCardIds.clear();
    this.playBoardEntrance = false;
  }

  private drawShelves(rows: number, startX: number, startY: number, gapY: number, cardSize: number, width: number): void {
    for (let row = 0; row < rows; row++) {
      const y = startY + row * gapY + cardSize - 2;
      this.cardsLayer.add(this.add.rectangle(startX - 8, y + 10, width, 4, 0x3e2c1f, 0.18).setOrigin(0));
      this.cardsLayer.add(this.add.rectangle(startX - 8, y, width, 8, PALETTE.shelfTop, 1).setOrigin(0));
      this.cardsLayer.add(this.add.rectangle(startX - 8, y + 8, width, 4, PALETTE.shelfFront, 1).setOrigin(0));
    }
  }

  private createCardNode(cardId: string, asset: string, layoutCard: LayoutCard): Phaser.GameObjects.Container {
    const container = this.add.container(layoutCard.x, layoutCard.y);
    container.setSize(layoutCard.width, layoutCard.height);
    container.setDepth(layoutCard.z);
    container.setInteractive(new Phaser.Geom.Rectangle(0, 0, layoutCard.width, layoutCard.height), Phaser.Geom.Rectangle.Contains);

    const blocked = !layoutCard.clickable;
    const hinted = this.hintIds.has(cardId);
    const frameColor = hinted ? PALETTE.archive : 0xe7dac8;
    const shadow = this.add.rectangle(4, 5, layoutCard.width, layoutCard.height, PALETTE.cardShadow, 0.24).setOrigin(0);
    const bg = this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, blocked ? 0x8e867c : PALETTE.cardFace, 1).setOrigin(0).setStrokeStyle(hinted ? 4 : 2, frameColor);
    const image = this.add.image(5, 5, asset).setOrigin(0).setDisplaySize(layoutCard.width - 10, layoutCard.width - 10);
    const tag = this.add.text(5, 4, blocked ? 'LOCK' : 'HOT', { fontSize: '8px', color: '#ffffff', backgroundColor: blocked ? '#555555' : '#d94a45', padding: { x: 3, y: 1 } });

    if (blocked) {
      container.setAlpha(0.72);
      image.setTint(0x777777);
    }
    container.add([shadow, bg, image, tag]);

    if (this.revealingCardIds.has(cardId)) {
      const targetAlpha = container.alpha;
      container.setAlpha(0);
      container.setScale(0.9);
      this.tweens.add({
        targets: container,
        alpha: targetAlpha,
        scale: 1,
        duration: ANIMATION.revealMs,
        ease: 'Back.easeOut'
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
    this.playTapSpark(layoutCard.x + layoutCard.width / 2, layoutCard.y + layoutCard.height / 2, 0x8bd3ff);
    this.flyCardToTray(card.asset, layoutCard, this.state.tray.length, () => {
      if (result.archivedCardIds.length === 3) {
        this.playArchiveMerge(result.archivedCardIds, visualTray, () => {
          this.recordShelfReveals(result.archivedCardIds, result.state);
          this.toastMessage = `归档完成 ${result.state.archivedCount / 3}/${this.level.cards.length / 3}`;
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
    const target = getTrayImagePosition(Math.min(trayIndex, this.state.slotCount - 1));
    const targetX = target.x;
    const targetY = target.y;

    const flyer = this.add.container(startX, startY).setDepth(9999);
    flyer.add(this.add.rectangle(4, 5, layoutCard.width, layoutCard.height, PALETTE.cardShadow, 0.22).setOrigin(0));
    flyer.add(this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, 0xffffff, 1).setOrigin(0).setStrokeStyle(3, PALETTE.archive));
    flyer.add(this.add.image(5, 5, asset).setOrigin(0).setDisplaySize(layoutCard.width - 10, layoutCard.width - 10));

    this.tweens.add({
      targets: flyer,
      x: targetX,
      y: targetY,
      scale: 0.78,
      angle: 3,
      duration: ANIMATION.flyToTrayMs,
      ease: 'Sine.easeInOut',
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
        node.add(this.add.rectangle(0, 0, 38, 34, 0xffffff, 1).setOrigin(0).setStrokeStyle(2, PALETTE.archive));
        node.add(this.add.image(2, 2, card.asset).setOrigin(0).setDisplaySize(34, 30));
      }
      return node;
    });

    this.tweens.add({
      targets: archiveNodes,
      x: target.x,
      y: target.y,
      scale: 1.14,
      duration: ANIMATION.mergeMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.playArchiveBurst(target.x + 19, target.y + 17);
        this.tweens.add({
          targets: archiveNodes,
          alpha: 0,
          scale: 0.35,
          duration: ANIMATION.mergeFadeMs,
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
      duration: ANIMATION.blockedShakeMs,
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

  private playCardEntrance(node: Phaser.GameObjects.Container, z: number): void {
    const targetY = node.y;
    node.setAlpha(0);
    node.setY(targetY + 10);
    node.setScale(0.94);
    this.tweens.add({
      targets: node,
      alpha: 1,
      y: targetY,
      scale: 1,
      duration: ANIMATION.cardEnterMs,
      delay: Math.min(180, Math.max(0, z) * 8),
      ease: 'Back.easeOut'
    });
  }

  private playTapSpark(x: number, y: number, color: number): void {
    for (let index = 0; index < 5; index++) {
      const angle = (Math.PI * 2 * index) / 5;
      const dot = this.add.circle(x, y, 2, color, 0.72).setDepth(9500);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 16,
        y: y + Math.sin(angle) * 12,
        alpha: 0,
        scale: 0.2,
        duration: 180,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy()
      });
    }
  }

  private playArchiveBurst(x: number, y: number): void {
    this.triggerHapticFeedback();
    for (let index = 0; index < ANIMATION.burstParticleCount; index++) {
      const angle = (Math.PI * 2 * index) / ANIMATION.burstParticleCount;
      const radius = 18 + (index % 3) * 6;
      const dot = this.add.circle(x, y, index % 2 === 0 ? 3 : 2, PALETTE.archive, 0.9).setDepth(10020);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        alpha: 0,
        scale: 0.3,
        duration: 260,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy()
      });
    }

    const text = this.add.text(x, y - 22, '归档!', {
      fontSize: '16px',
      color: '#fff5d8',
      stroke: '#6b4a30',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(10030);
    this.tweens.add({
      targets: text,
      y: y - 44,
      alpha: 0,
      scale: 1.18,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private triggerHapticFeedback(): void {
    if ('vibrate' in navigator) navigator.vibrate(35);
  }

  private drawTray(): void {
    this.uiLayer.add(this.add.rectangle(ARCHIVE_PANEL.x - 6, ARCHIVE_PANEL.y + 8, ARCHIVE_PANEL.width + 12, ARCHIVE_PANEL.height, 0x8f806d, 0.18).setOrigin(0));
    this.uiLayer.add(this.add.rectangle(ARCHIVE_PANEL.x, ARCHIVE_PANEL.y, ARCHIVE_PANEL.width, ARCHIVE_PANEL.height, 0xf8f1e7, 0.96).setOrigin(0).setStrokeStyle(2, 0xd4c5b2));
    this.uiLayer.add(this.add.text(ARCHIVE_PANEL.x + 10, ARCHIVE_PANEL.y + 9, '待归档区', { fontSize: '14px', color: '#4b4036', fontStyle: 'bold' }));

    for (let index = 0; index < this.state.slotCount; index++) {
      const x = ARCHIVE_PANEL.x + 10 + index * (ARCHIVE_PANEL.slotWidth + ARCHIVE_PANEL.slotGap);
      const y = ARCHIVE_PANEL.slotY;
      this.uiLayer.add(this.add.rectangle(x, y, ARCHIVE_PANEL.slotWidth, ARCHIVE_PANEL.slotHeight, 0xe8dccb, 1).setOrigin(0).setStrokeStyle(2, 0xbdae99));
      this.uiLayer.add(this.add.circle(x + ARCHIVE_PANEL.slotWidth / 2, y + 8, 8, 0xc8b9a6, 0.6));
      const cardId = this.state.tray[index];
      const card = this.state.cards.find((item) => item.id === cardId);
      if (card) {
        this.uiLayer.add(this.add.rectangle(x + 4, y + 4, ARCHIVE_PANEL.slotWidth - 8, ARCHIVE_PANEL.slotWidth - 8, 0xffffff, 1).setOrigin(0).setStrokeStyle(1, 0xd0c1ad));
        this.uiLayer.add(this.add.image(x + 6, y + 6, card.asset).setOrigin(0).setDisplaySize(ARCHIVE_PANEL.slotWidth - 12, ARCHIVE_PANEL.slotWidth - 12));
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
    const button = this.add.rectangle(x, y, 86, 48, 0xfffbf3, 1).setOrigin(0).setStrokeStyle(2, 0xd1bfa8).setInteractive({ useHandCursor: true });
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
    x: ARCHIVE_PANEL.x + 10 + index * (ARCHIVE_PANEL.slotWidth + ARCHIVE_PANEL.slotGap) + 6,
    y: ARCHIVE_PANEL.slotY + 6
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
