import Phaser from 'phaser';
import { ANIMATION, ARCHIVE_PANEL, GAME_HEIGHT, GAME_WIDTH, LAYOUT_LABELS, NEON_LAYOUT, PALETTE, UI_ASSETS, UI_FRAME } from '../config/constants';
import { createGameState, getFinalAutoArchiveIds, getHintIds, restartUnarchivedCards, returnTrayCardToBoard, setLocked, shuffleBoardCards, shuffleBoardCardsForClickables, tapCard, validateLevel, withDeadlockCheck } from '../game/rules';
import type { GameState, LayoutCard, LayoutKind, LevelConfig } from '../game/types';
import { buildLayout } from '../layouts';
import { GRID_CARD_SIZE, GRID_GAP_Y, GRID_ROWS, GRID_START_X, GRID_START_Y, GRID_WIDTH } from '../layouts/grid';
import { SHELF_CARD_SIZE, SHELF_GAP_Y, SHELF_LAYER_ROWS, SHELF_START_X, SHELF_START_Y, SHELF_VISIBLE_SLOTS, SHELF_WIDTH } from '../layouts/shelf';

const LEVEL_KEY = 'test-level';
const LAYOUTS: LayoutKind[] = ['grid', 'stack', 'shelf', 'overlap', 'neon9'];
type ToolIcon = 'hint' | 'shuffle' | 'restart';
const TOOL_ICON_ASSETS: Record<ToolIcon, string> = {
  hint: UI_ASSETS.toolHint,
  shuffle: UI_ASSETS.toolShuffle,
  restart: UI_ASSETS.toolRestart
};
const NEON_TOOL_ICON_ASSETS: Record<ToolIcon, string> = {
  hint: UI_ASSETS.neonToolHint,
  shuffle: UI_ASSETS.neonToolShuffle,
  restart: UI_ASSETS.neonToolRestart
};

export class GameScene extends Phaser.Scene {
  private level!: LevelConfig;
  private baseLevel!: LevelConfig;
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
  private countdownSeconds = 0;
  private countdownEvent?: Phaser.Time.TimerEvent;
  private overlayRoot?: HTMLDivElement;
  private titleEl?: HTMLDivElement;
  private subtitleEl?: HTMLDivElement;
  private timerEl?: HTMLDivElement;
  private toastEl?: HTMLDivElement;
  private dropdownEl?: HTMLDivElement;
  private toastTimer?: number;
  private autoFinishing = false;

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
    this.baseLevel = this.cache.json.get(LEVEL_KEY) as LevelConfig;
    this.level = this.baseLevel;
    validateLevel(this.baseLevel);
    this.backgroundLayer = this.add.container(0, 0);
    this.cardsLayer = this.add.container(0, 0);
    this.uiLayer = this.add.container(0, 0);
    this.dropdownLayer = this.add.container(0, 0).setDepth(20);
    this.setupDomOverlay();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleBoardPointer(pointer));

    for (const card of this.baseLevel.cards) {
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
    if (this.toastTimer !== undefined) window.clearTimeout(this.toastTimer);
    this.toastEl?.classList.remove('is-visible', 'is-final');
    this.autoFinishing = false;
    this.playBoardEntrance = true;
    this.level = this.layoutKind === 'neon9' ? createNeonLevel(this.baseLevel) : this.baseLevel;
    validateLevel(this.level);
    this.countdownSeconds = this.layoutKind === 'neon9' ? NEON_LAYOUT.durationSeconds : 0;
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
    this.hideDropdown();
    this.syncDomOverlay();

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
    if (this.layoutKind === 'neon9') {
      this.addCoverBackground(UI_ASSETS.neonBackground);
      return;
    }

    this.backgroundLayer.add(this.add.image(0, 0, UI_ASSETS.studioBackground).setOrigin(0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
    this.backgroundLayer.add(this.add.image(332, 200, UI_ASSETS.tempoMeter).setOrigin(0).setDisplaySize(32, 72).setAlpha(0.58));
  }

  private addCoverBackground(asset: string): void {
    const texture = this.textures.get(asset).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const scale = Math.max(GAME_WIDTH / texture.width, GAME_HEIGHT / texture.height);
    const width = texture.width * scale;
    const height = texture.height * scale;
    this.backgroundLayer.add(
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, asset)
        .setOrigin(0.5)
        .setDisplaySize(width, height)
    );
  }

  private drawHud(): void {
    if (this.layoutKind !== 'neon9') {
      this.uiLayer.add(this.add.image(UI_FRAME.x, UI_FRAME.headerY, UI_ASSETS.headerConsole).setOrigin(0).setDisplaySize(UI_FRAME.width, UI_FRAME.headerHeight));
    }
    if (this.titleEl) this.titleEl.textContent = this.layoutKind === 'neon9' ? '' : '今日推荐榜';
    if (this.subtitleEl) this.subtitleEl.textContent = this.layoutKind === 'neon9' ? '' : this.level.title;
    if (this.timerEl) this.timerEl.textContent = formatCountdown(this.countdownSeconds);

    if (this.layoutKind === 'neon9') this.drawNeonModeDots();

    const modeButton = this.add.rectangle(
      this.layoutKind === 'neon9' ? NEON_LAYOUT.menuX : UI_FRAME.x + UI_FRAME.width - 42,
      this.layoutKind === 'neon9' ? NEON_LAYOUT.menuY : UI_FRAME.headerY + 8,
      34,
      48,
      0xffffff,
      0.001
    )
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    modeButton.on('pointerdown', () => {
      if (this.state.locked) return;
      this.toggleDropdown();
    });
    this.uiLayer.add(modeButton);
  }

  private drawNeonModeDots(): void {
    const x = NEON_LAYOUT.menuX + 11;
    const y = NEON_LAYOUT.menuY + 17;
    for (let index = 0; index < 2; index++) {
      const dotX = x + index * 15;
      this.uiLayer.add(this.add.circle(dotX, y, 5, 0x66f6ff, 0.28).setStrokeStyle(2, 0x66f6ff, 0.95));
      this.uiLayer.add(this.add.circle(dotX, y, 2, 0xffffff, 0.72));
    }
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
    const isNeon = this.layoutKind === 'neon9';
    const frameColor = hinted ? PALETTE.archive : blocked ? 0x5f88a2 : isNeon ? 0x22e7ff : 0x75bff0;
    const image = this.add.image(0, 0, asset).setOrigin(0).setDisplaySize(layoutCard.width, layoutCard.height);
    if (blocked) {
      image.setTint(0x647784);
    }

    if (isNeon) {
      if (hinted) {
        const hintFrame = this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, 0xffffff, 0).setOrigin(0).setStrokeStyle(5, 0xffe65a, 1);
        container.add([image, hintFrame]);
      } else {
        container.add([image]);
      }
    } else {
      const shadow = this.add.rectangle(4, 5, layoutCard.width, layoutCard.height, PALETTE.cardShadow, 0.24).setOrigin(0);
      const outline = this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, 0xffffff, 0).setOrigin(0).setStrokeStyle(hinted ? 4 : 2, frameColor);
      container.add([shadow, image, outline]);
    }

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
    if (this.autoFinishing) return;
    if (this.state.status !== 'playing') return;
    if (this.isDropdownOpen() && pointInRect(pointer.x, pointer.y, getDropdownBounds())) return;
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
    this.flyCardToTray(card.asset, layoutCard, cardId, visualTray, () => {
      this.recordShelfRevealForTap(cardId, result.state);
      if (result.archivedCardIds.length === 3) {
        this.playArchiveMerge(result.archivedCardIds, visualTray, () => {
          this.toastMessage = `已归档 ${result.state.archivedCount / 3}/${this.level.cards.length / 3}`;
          this.state = setLocked(result.state, false);
          this.render();
          this.continueAutoFinishOrStart();
        });
        return;
      }

      this.state = setLocked(result.state, false);
      this.render();
      this.continueAutoFinishOrStart();
    });
  }

  private continueAutoFinishOrStart(): void {
    if (this.autoFinishing) {
      if (this.state.status !== 'playing') {
        this.autoFinishing = false;
        return;
      }
      this.time.delayedCall(120, () => this.autoTapNextFinalCard());
      return;
    }

    if (getFinalAutoArchiveIds(this.state).length === 3) {
      this.autoFinishing = true;
      this.time.delayedCall(220, () => this.autoTapNextFinalCard());
    }
  }

  private autoTapNextFinalCard(): void {
    if (!this.autoFinishing || this.state.status !== 'playing') {
      this.autoFinishing = false;
      return;
    }

    const finalIds = new Set(getFinalAutoArchiveIds(this.state));
    if (finalIds.size !== 3) {
      this.autoFinishing = false;
      return;
    }

    const layout = buildLayout(this.layoutKind, this.state.cards);
    const target = layout
      .filter((card) => finalIds.has(card.cardId) && card.clickable)
      .sort((a, b) => b.z - a.z)[0];
    if (!target) {
      this.autoFinishing = false;
      this.toastMessage = '剩余专辑被遮挡';
      this.render();
      return;
    }

    const node = this.cardNodes.get(target.cardId);
    if (!node) {
      this.time.delayedCall(120, () => this.autoTapNextFinalCard());
      return;
    }

    this.handleCardTap(target.cardId, target, node);
  }

  private recordShelfRevealForTap(cardId: string, nextState: GameState): void {
    if (this.layoutKind === 'neon9') {
      const tappedIndex = nextState.cards.findIndex((card) => card.id === cardId);
      if (tappedIndex < 0) return;
      const slot = tappedIndex % NEON_LAYOUT.visibleSlots;
      const nextCard = nextState.cards.find((card, index) => card.status === 'board' && index % NEON_LAYOUT.visibleSlots === slot);
      if (nextCard) this.revealingCardIds.add(nextCard.id);
      return;
    }

    if (this.layoutKind !== 'shelf') return;

    const frontIndex = this.level.cards.findIndex((card) => card.id === cardId);
    if (frontIndex < 0 || frontIndex >= SHELF_VISIBLE_SLOTS) return;
    const backCard = nextState.cards[frontIndex + SHELF_VISIBLE_SLOTS];
    if (backCard?.status === 'board') this.revealingCardIds.add(backCard.id);
  }

  private flyCardToTray(asset: string, layoutCard: LayoutCard, cardId: string, visualTray: string[], onComplete: () => void): void {
    const startX = layoutCard.x;
    const startY = layoutCard.y;
    const target = getTrayCardPose(cardId, visualTray, this.state.cards, this.layoutKind);
    const slotSize = getTraySlotSize(this.layoutKind);

    const flyer = this.add.container(startX, startY).setDepth(9999);
    flyer.add(this.add.rectangle(4, 5, layoutCard.width, layoutCard.height, PALETTE.cardShadow, 0.22).setOrigin(0));
    flyer.add(this.add.image(0, 0, asset).setOrigin(0).setDisplaySize(layoutCard.width, layoutCard.height));
    flyer.add(this.add.rectangle(0, 0, layoutCard.width, layoutCard.height, 0xffffff, 0).setOrigin(0).setStrokeStyle(3, PALETTE.archive));

    this.tweens.add({
      targets: flyer,
      x: target.x - slotSize / 2,
      y: target.y - slotSize / 2,
      scale: target.scale,
      angle: target.angle,
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

    const target = getTrayCardPose(slots[1].id, visualTray, this.state.cards, this.layoutKind);
    const archiveNodes = slots.map(({ id }) => {
      const card = this.state.cards.find((item) => item.id === id);
      const position = getTrayCardPose(id, visualTray, this.state.cards, this.layoutKind);
      const node = this.add.container(position.x, position.y).setDepth(10000);
      if (card) {
        this.addTrayAlbumArt(node, card.asset);
        node.setAngle(position.angle);
        node.setScale(position.scale);
      }
      return node;
    });

    let completed = false;
    let safetyTimer: Phaser.Time.TimerEvent | undefined;
    const finish = () => {
      if (completed) return;
      completed = true;
      safetyTimer?.remove(false);
      for (const node of archiveNodes) node.destroy();
      onComplete();
    };
    safetyTimer = this.time.delayedCall(ANIMATION.mergeMs + ANIMATION.mergeFadeMs + 500, finish);

    this.tweens.add({
      targets: archiveNodes,
      x: target.x,
      y: target.y,
      angle: target.angle,
      scale: 1.14,
      duration: ANIMATION.mergeMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.playArchiveBurst(target.x, target.y);
        this.tweens.add({
          targets: archiveNodes,
          alpha: 0,
          scale: 0.35,
          duration: ANIMATION.mergeFadeMs,
          ease: 'Cubic.easeIn',
          onComplete: finish
        });
      }
    });
  }

  private bumpBlocked(node: Phaser.GameObjects.Container): void {
    const originX = node.x;
    this.state = setLocked(this.state, true);
    node.disableInteractive();
    this.tweens.add({
      targets: node,
      x: originX + 6,
      yoyo: true,
      repeat: 3,
      duration: ANIMATION.blockedShakeMs,
      onComplete: () => {
        node.x = originX;
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
  }

  private triggerHapticFeedback(): void {
    const vibrate = navigator.vibrate;
    if (typeof vibrate !== 'function') return;

    try {
      vibrate.call(navigator, [35]);
    } catch {
      // iOS WebKit may expose a non-callable vibration shim through Phaser.
    }
  }

  private drawTray(): void {
    this.drawArchivePlate();
    const trayCards = this.state.tray
      .map((cardId) => {
        const card = this.state.cards.find((item) => item.id === cardId);
        return card ? { card, pose: getTrayCardPose(cardId, this.state.tray, this.state.cards, this.layoutKind) } : undefined;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => left.pose.depth - right.pose.depth);

    for (const { card, pose } of trayCards) {
      const node = this.add.container(pose.x, pose.y).setDepth(40 + pose.depth);
      this.addTrayAlbumArt(node, card.asset);
      node.setAngle(pose.angle);
      node.setScale(pose.scale);
      if (this.layoutKind === 'neon9') {
        const slotSize = getTraySlotSize(this.layoutKind);
        node.setSize(slotSize, slotSize);
        node.setInteractive(new Phaser.Geom.Rectangle(-slotSize / 2, -slotSize / 2, slotSize, slotSize), Phaser.Geom.Rectangle.Contains);
        node.on('pointerdown', () => this.handleTrayCardReturn(card.id, card.asset, pose));
      }
      this.uiLayer.add(node);
    }
  }

  private handleTrayCardReturn(cardId: string, asset: string, pose: { x: number; y: number; angle: number; scale: number; depth: number }): void {
    if (this.layoutKind !== 'neon9' || this.state.status !== 'playing' || this.state.locked || this.autoFinishing) return;

    const nextState = returnTrayCardToBoard(this.state, cardId);
    if (nextState === this.state) return;

    const target = buildLayout('neon9', nextState.cards).find((card) => card.cardId === cardId);
    if (!target) {
      this.state = nextState;
      this.render();
      return;
    }

    this.state = setLocked(this.state, true);
    const slotSize = getTraySlotSize(this.layoutKind);
    const flyer = this.add.container(pose.x, pose.y).setDepth(10001);
    this.addTrayAlbumArt(flyer, asset);
    flyer.setAngle(pose.angle);
    flyer.setScale(pose.scale);

    this.tweens.add({
      targets: flyer,
      x: target.x + target.width / 2,
      y: target.y + target.height / 2,
      angle: 0,
      scale: target.width / slotSize,
      duration: ANIMATION.flyToTrayMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        flyer.destroy();
        this.state = setLocked(nextState, false);
        this.render();
      }
    });
  }

  private drawArchivePlate(): void {
    if (this.layoutKind === 'neon9') {
      this.uiLayer.add(this.add.image(NEON_LAYOUT.trayX, NEON_LAYOUT.trayY, UI_ASSETS.neonArchiveBar).setOrigin(0).setDisplaySize(NEON_LAYOUT.trayWidth, NEON_LAYOUT.trayHeight));
      return;
    }

    this.uiLayer.add(this.add.rectangle(ARCHIVE_PANEL.x + 5, ARCHIVE_PANEL.y + 7, ARCHIVE_PANEL.width, ARCHIVE_PANEL.height, 0x5c9ece, 0.14).setOrigin(0));
    this.uiLayer.add(this.add.rectangle(ARCHIVE_PANEL.x, ARCHIVE_PANEL.y, ARCHIVE_PANEL.width, ARCHIVE_PANEL.height, 0xffffff, 0.92).setOrigin(0));
  }

  private addTrayAlbumArt(node: Phaser.GameObjects.Container, asset: string): void {
    const width = getTraySlotSize(this.layoutKind);
    const height = width;
    const isNeon = this.layoutKind === 'neon9';
    if (!isNeon) {
      node.add(this.add.rectangle(4, 5, width, height, 0x4d86b2, 0.18).setOrigin(0.5));
      node.add(this.add.rectangle(1, 2, width, height, 0x5f9fd0, 0.1).setOrigin(0.5));
    }

    const image = this.add.image(0, 0, asset).setOrigin(0.5).setDisplaySize(width, height);
    node.add(image);

    if (isNeon) return;

    node.add(this.add.rectangle(0, 0, width, height, 0xffffff, 0).setOrigin(0.5).setStrokeStyle(2, PALETTE.archive));
  }

  private drawTools(clickableIds: Set<string>): void {
    if (this.layoutKind === 'neon9') {
      this.addNeonToolButton(NEON_LAYOUT.toolX, NEON_LAYOUT.toolY, 'hint', () => {
        if (this.state.status !== 'playing' || this.state.locked) return;
        this.hintIds = new Set(getHintIds(this.state, clickableIds));
        this.render();
      });
      this.addNeonToolButton(NEON_LAYOUT.toolX + NEON_LAYOUT.toolSize + NEON_LAYOUT.toolGap, NEON_LAYOUT.toolY, 'shuffle', () => {
        if (this.state.status !== 'playing' || this.state.locked) return;
        this.state = shuffleBoardCards(this.state);
        this.render();
      });
      this.addNeonToolButton(NEON_LAYOUT.toolX + (NEON_LAYOUT.toolSize + NEON_LAYOUT.toolGap) * 2, NEON_LAYOUT.toolY, 'restart', () => {
        if (this.state.status !== 'playing' || this.state.locked) return;
        this.state = restartUnarchivedCards(this.state);
        this.render();
      });
      return;
    }

    this.addToolButton(UI_FRAME.x, UI_FRAME.toolY, 'hint', 0x4aa9e8, () => {
      if (this.state.locked) return;
      this.hintIds = new Set(getHintIds(this.state, clickableIds));
      this.render();
    });
    this.addToolButton(UI_FRAME.x + UI_FRAME.toolWidth + UI_FRAME.toolGap, UI_FRAME.toolY, 'shuffle', 0x2aa8a2, () => {
      if (this.state.locked) return;
      this.state = this.layoutKind === 'stack'
        ? shuffleBoardCardsForClickables(this.state, clickableIds)
        : shuffleBoardCards(this.state);
      this.render();
    });
    this.addToolButton(UI_FRAME.x + (UI_FRAME.toolWidth + UI_FRAME.toolGap) * 2, UI_FRAME.toolY, 'restart', 0x8b84e8, () => {
      if (this.state.locked) return;
      this.state = restartUnarchivedCards(this.state);
      this.render();
    });
  }

  private addToolButton(x: number, y: number, icon: ToolIcon, accent: number, onClick: () => void): void {
    const width = UI_FRAME.toolWidth;
    const height = UI_FRAME.toolHeight;
    const group = this.add.container(x, y);
    const button = this.add.rectangle(0, 0, width, height, 0xf8fcff, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, 0x8fcaf1)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    const stripe = this.add.rectangle(0, 0, width, 4, accent, 1).setOrigin(0);
    const iconNode = this.add.image(width / 2, height / 2 + 3, TOOL_ICON_ASSETS[icon]).setDisplaySize(34, 34);
    button.on('pointerdown', onClick);
    group.add([button, stripe, iconNode]);
    this.uiLayer.add(group);
  }

  private addNeonToolButton(x: number, y: number, icon: ToolIcon, onClick: () => void): void {
    const size = NEON_LAYOUT.toolSize;
    const group = this.add.container(x, y);
    const button = this.add.rectangle(0, 0, size, size, 0xffffff, 0.001)
      .setOrigin(0)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, size, size), Phaser.Geom.Rectangle.Contains);
    const iconNode = this.add.image(size / 2, size / 2, NEON_TOOL_ICON_ASSETS[icon]).setDisplaySize(size, size);
    button.on('pointerdown', onClick);
    group.add([iconNode, button]);
    this.uiLayer.add(group);
  }

  private drawStatus(): void {
    const text = this.toastMessage || (this.state.status === 'playing' ? this.state.message : this.state.message || this.state.status);
    if (!text) return;
    this.showToast(text);
  }

  private tickCountdown(): void {
    if (this.layoutKind === 'neon9') {
      this.countdownSeconds = Math.max(0, this.countdownSeconds - 1);
      if (this.timerEl) this.timerEl.textContent = formatCountdown(this.countdownSeconds);
      if (this.countdownSeconds === 0 && this.state.status === 'playing') {
        this.countdownEvent?.remove(false);
        this.state = { ...this.state, locked: false, status: 'won', message: `时间到！已归档 ${this.state.archivedCount / 3} 组` };
        this.toastMessage = this.state.message;
        this.render();
      }
      return;
    }

    this.countdownSeconds += 1;
    if (this.timerEl) this.timerEl.textContent = formatCountdown(this.countdownSeconds);
  }

  private toggleDropdown(): void {
    if (this.state.locked) return;

    if (this.isDropdownOpen()) {
      this.hideDropdown();
      return;
    }

    this.showDropdown();
  }

  private setupDomOverlay(): void {
    const app = document.getElementById('app');
    if (!app) return;

    document.getElementById('game-ui-overlay')?.remove();
    const root = document.createElement('div');
    root.id = 'game-ui-overlay';
    root.innerHTML = `
      <div class="hud-title"></div>
      <div class="hud-subtitle"></div>
      <div class="hud-timer"></div>
      <div class="game-toast"></div>
      <div class="layout-menu"></div>
    `;
    app.appendChild(root);

    this.overlayRoot = root;
    this.titleEl = root.querySelector('.hud-title') as HTMLDivElement;
    this.subtitleEl = root.querySelector('.hud-subtitle') as HTMLDivElement;
    this.timerEl = root.querySelector('.hud-timer') as HTMLDivElement;
    this.toastEl = root.querySelector('.game-toast') as HTMLDivElement;
    this.dropdownEl = root.querySelector('.layout-menu') as HTMLDivElement;
    this.dropdownEl.innerHTML = LAYOUTS.map((kind) => `<button type="button" data-layout="${kind}">${LAYOUT_LABELS[kind]}</button>`).join('');
    this.dropdownEl.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.addEventListener('click', () => {
        const kind = button.dataset.layout as LayoutKind | undefined;
        if (!kind) return;
        this.layoutKind = kind;
        this.resetLevel();
      });
    });
    window.addEventListener('resize', () => this.syncDomOverlay());
    this.syncDomOverlay();
  }

  private syncDomOverlay(): void {
    if (!this.overlayRoot) return;
    const app = document.getElementById('app');
    const canvas = this.game.canvas;
    if (!app || !canvas) return;

    const appRect = app.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scale = canvasRect.width / GAME_WIDTH;
    this.overlayRoot.style.left = `${canvasRect.left - appRect.left}px`;
    this.overlayRoot.style.top = `${canvasRect.top - appRect.top}px`;
    this.overlayRoot.style.width = `${canvasRect.width}px`;
    this.overlayRoot.style.height = `${canvasRect.height}px`;
    this.overlayRoot.style.setProperty('--ui-scale', `${scale}`);
    this.overlayRoot.classList.toggle('is-neon', this.layoutKind === 'neon9');
    document.body.classList.toggle('is-neon-page', this.layoutKind === 'neon9');
  }

  private showToast(text: string): void {
    if (!this.toastEl) return;
    if (this.toastTimer !== undefined) window.clearTimeout(this.toastTimer);
    const isPersistentFinal = this.layoutKind === 'neon9' && this.state.status !== 'playing';
    this.toastEl.textContent = text;
    this.toastEl.classList.toggle('is-final', isPersistentFinal);
    this.toastEl.classList.remove('is-visible');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('is-visible');
    if (isPersistentFinal) return;

    this.toastTimer = window.setTimeout(() => {
      this.toastEl?.classList.remove('is-visible');
      this.toastEl?.classList.remove('is-final');
      if (this.toastMessage === text) this.toastMessage = '';
    }, 1200);
  }

  private showDropdown(): void {
    if (!this.dropdownEl) return;
    this.dropdownEl.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.layout === this.layoutKind);
    });
    this.dropdownEl.classList.add('is-open');
  }

  private hideDropdown(): void {
    this.dropdownEl?.classList.remove('is-open');
  }

  private isDropdownOpen(): boolean {
    return this.dropdownEl?.classList.contains('is-open') ?? false;
  }
}

function getTrayCardPose(cardId: string, visualTray: string[], cards: GameState['cards'], layoutKind: LayoutKind): { x: number; y: number; angle: number; scale: number; depth: number } {
  const index = Math.max(0, visualTray.indexOf(cardId));
  const card = cards.find((item) => item.id === cardId);
  const sameTypeCount = card ? visualTray.filter((id) => cards.find((item) => item.id === id)?.matchId === card.matchId).length : 0;

  if (layoutKind === 'neon9') {
    const baseX = NEON_LAYOUT.traySlotStartX + index * (NEON_LAYOUT.traySlotSize + NEON_LAYOUT.traySlotGap) + NEON_LAYOUT.traySlotSize / 2;
    const baseY = NEON_LAYOUT.traySlotY + NEON_LAYOUT.traySlotSize / 2;
    return {
      x: baseX,
      y: baseY,
      angle: 0,
      scale: 1,
      depth: sameTypeCount >= 2 ? 20 + index : index
    };
  }

  const baseX = ARCHIVE_PANEL.x + 40 + index * (ARCHIVE_PANEL.slotWidth + ARCHIVE_PANEL.slotGap);
  const baseY = ARCHIVE_PANEL.y + ARCHIVE_PANEL.height / 2 + 2 + trayYOffset(index);

  return {
    x: baseX,
    y: baseY,
    angle: trayAngle(index),
    scale: 1,
    depth: sameTypeCount >= 2 ? 20 + index : index
  };
}

function getTraySlotSize(layoutKind: LayoutKind): number {
  return layoutKind === 'neon9' ? NEON_LAYOUT.traySlotSize : ARCHIVE_PANEL.slotWidth;
}

function trayAngle(index: number): number {
  return [-3, 2, -1, 3, -2, 1, -2][index] ?? 0;
}

function trayYOffset(index: number): number {
  return [0, -2, 1, -1, 2, -2, 0][index] ?? 0;
}

function pointInLayoutCard(x: number, y: number, card: LayoutCard): boolean {
  return x >= card.x && x <= card.x + card.width && y >= card.y && y <= card.y + card.height;
}

function getDropdownBounds(): { x: number; y: number; width: number; height: number } {
  return {
    x: UI_FRAME.x + UI_FRAME.width - 190,
    y: UI_FRAME.headerY + UI_FRAME.headerHeight + 8,
    width: 190,
    height: 148
  };
}

function pointInRect(x: number, y: number, rect: { x: number; y: number; width: number; height: number }): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

function createNeonLevel(baseLevel: LevelConfig): LevelConfig {
  const albumMap = new Map<string, LevelConfig['cards'][number]>();
  for (const card of baseLevel.cards) {
    if (!albumMap.has(card.matchId)) albumMap.set(card.matchId, card);
  }

  const albums = [...albumMap.values()].slice(0, NEON_LAYOUT.albumKinds);
  const cards: LevelConfig['cards'] = [];
  const layerKinds = [
    [0, 1, 2, 3, 0, 4, 5, 6, 0],
    [7, 1, 8, 7, 2, 9, 7, 3, 4],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [2, 3, 4, 5, 6, 7, 8, 9, 1],
    [0, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, 1, 3, 4, 5, 6, 7, 8, 9],
    [0, 1, 2, 4, 5, 6, 7, 8, 9],
    [0, 1, 2, 3, 5, 6, 7, 8, 9],
    [0, 1, 2, 3, 4, 5, 6, 8, 9],
    [0, 1, 2, 3, 4, 5, 6, 8, 9]
  ];

  for (const layer of layerKinds) {
    for (const kind of layer) {
      cards.push(createNeonCard(albums[kind % albums.length], cards.length));
    }
  }

  return {
    id: 'neon9-flow',
    title: '霓虹九宫格',
    slotCount: 6,
    cards
  };
}

function createNeonCard(album: LevelConfig['cards'][number], index: number): LevelConfig['cards'][number] {
  return {
    id: `neon-${index.toString().padStart(2, '0')}-${album.matchId}`,
    matchId: album.matchId,
    title: album.title,
    asset: album.asset
  };
}
