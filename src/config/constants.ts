export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;
export const TRAY_SIZE = 7;
export const CARD_WIDTH = 58;
export const CARD_HEIGHT = 58;
export const VISIBLE_RATIO_THRESHOLD = 0.6;

export const PALETTE = {
  page: 0xdaf2ff,
  pageShadow: 0x8fc6e8,
  board: 0xf6fbff,
  boardLine: 0xaed9f4,
  ink: '#2a5f91',
  mutedInk: '#6ca6cf',
  shelfTop: 0xaedcff,
  shelfFront: 0x6aaee0,
  cardFace: 0xfffbf4,
  cardShadow: 0x6aaee0,
  accent: 0x66bdf2,
  archive: 0x8ed8ff,
  danger: 0xd94a7f,
  tray: 0xc9ebff,
  traySlot: 0xe8f7ff
} as const;

export const ANIMATION = {
  cardEnterMs: 260,
  flyToTrayMs: 300,
  mergeMs: 200,
  mergeFadeMs: 150,
  revealMs: 240,
  blockedShakeMs: 42,
  burstParticleCount: 10
} as const;

export const UI_ASSETS = {
  studioBackground: 'assets/ui/studio-background.svg',
  neonBackground: 'assets/ui/neon-background.png',
  neonArchiveBar: 'assets/ui/neon-archive-bar.png',
  neonToolHint: 'assets/ui/neon-tool-hint.png',
  neonToolShuffle: 'assets/ui/neon-tool-shuffle.png',
  neonToolRestart: 'assets/ui/neon-tool-restart.png',
  headerConsole: 'assets/ui/header-console.svg',
  tempoMeter: 'assets/ui/tempo-meter.svg',
  toolHint: 'assets/ui/tool-hint.svg',
  toolShuffle: 'assets/ui/tool-shuffle.svg',
  toolRestart: 'assets/ui/tool-restart.svg'
} as const;

export const UI_FRAME = {
  x: 24,
  width: 342,
  headerY: 16,
  headerHeight: 64,
  boardX: 16,
  boardY: 104,
  boardWidth: 358,
  boardHeight: 496,
  toastY: 628,
  toolY: 756,
  toolWidth: 94,
  toolHeight: 56,
  toolGap: 30
} as const;

export const ARCHIVE_PANEL = {
  x: 32,
  y: 640,
  width: 326,
  height: 74,
  slotWidth: 52,
  slotHeight: 52,
  slotGap: -7,
  slotY: 651
} as const;

export const OVERLAP_LAYOUT = {
  size: 64,
  cols: 6,
  rows: 6,
  minX: 24,
  maxX: 318,
  minY: 120,
  maxY: 536,
  jitterX: 46,
  jitterY: 48,
  overlapPull: 16
} as const;

export const LAYOUT_LABELS = {
  grid: '01 传统三消',
  stack: '02 多层堆叠',
  shelf: '03 唱片架',
  overlap: '04 交错覆盖',
  neon9: '05 霓虹九宫格'
} as const;

export const NEON_LAYOUT = {
  boardX: 45,
  boardY: 198,
  boardSize: 300,
  cellSize: 96,
  cellGap: 4,
  visibleSlots: 9,
  durationSeconds: 300,
  itemTotal: 90,
  albumKinds: 10,
  trayX: 22,
  trayY: 606,
  trayWidth: 349,
  trayHeight: 94,
  traySlotSize: 43,
  traySlotGap: 10.5,
  traySlotStartX: 42,
  traySlotY: 623,
  toolX: 100,
  toolY: 532,
  toolSize: 54,
  toolGap: 18,
  menuX: 326,
  menuY: 84
} as const;
