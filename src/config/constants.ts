export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;
export const TRAY_SIZE = 7;
export const CARD_WIDTH = 58;
export const CARD_HEIGHT = 58;
export const VISIBLE_RATIO_THRESHOLD = 0.6;

export const PALETTE = {
  page: 0xf4eadb,
  pageShadow: 0xd2bda2,
  board: 0xfff7e8,
  boardLine: 0xdfc7a7,
  ink: '#24170f',
  mutedInk: '#765f47',
  shelfTop: 0xa97d51,
  shelfFront: 0x6b4a30,
  cardFace: 0xfffbf4,
  cardShadow: 0x6f5136,
  accent: 0x2f6fed,
  archive: 0xffc857,
  danger: 0xd94a45,
  tray: 0x554a40,
  traySlot: 0x82786e
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
  headerConsole: 'assets/ui/header-console.svg',
  modeTicket: 'assets/ui/mode-ticket.svg',
  tempoMeter: 'assets/ui/tempo-meter.svg'
} as const;

export const ARCHIVE_PANEL = {
  x: 24,
  y: 636,
  width: 342,
  height: 104,
  slotWidth: 42,
  slotHeight: 68,
  slotGap: 5,
  slotY: 660
} as const;

export const OVERLAP_LAYOUT = {
  size: 58,
  cols: 6,
  startX: 27,
  startY: 160,
  xStep: 47,
  yStep: 54,
  rowStagger: 14
} as const;

export const LAYOUT_LABELS = {
  grid: '01 传统三消',
  stack: '02 多层堆叠',
  shelf: '03 唱片架',
  overlap: '04 交错覆盖'
} as const;
