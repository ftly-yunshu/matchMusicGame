export type LayoutKind = 'grid' | 'stack' | 'shelf' | 'overlap' | 'neon9';

export type CardStatus = 'board' | 'tray' | 'archived';

export interface LevelCard {
  id: string;
  matchId: string;
  title: string;
  asset: string;
}

export interface LevelConfig {
  id: string;
  title: string;
  slotCount: number;
  cards: LevelCard[];
}

export interface CardState extends LevelCard {
  status: CardStatus;
}

export type GameStatus = 'playing' | 'won' | 'failed';

export interface GameState {
  levelId: string;
  title: string;
  slotCount: number;
  cards: CardState[];
  tray: string[];
  archivedCount: number;
  status: GameStatus;
  message: string;
  locked: boolean;
  deadlocked: boolean;
}

export interface LayoutCard {
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  clickable: boolean;
  visibleRatio: number;
}

export interface TapResult {
  state: GameState;
  movedCardId?: string;
  archivedCardIds: string[];
  blockedReason?: 'locked' | 'not-clickable' | 'not-playing' | 'not-on-board';
}
