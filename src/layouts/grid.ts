import type { CardState, LayoutCard } from '../game/types.ts';

export const GRID_START_X = 26;
export const GRID_START_Y = 124;
export const GRID_CARD_SIZE = 52;
export const GRID_GAP_X = 5;
export const GRID_GAP_Y = 68;
export const GRID_PER_ROW = 6;
export const GRID_ROWS = 6;
export const GRID_WIDTH = 342;

export function buildGridLayout(cards: CardState[]): LayoutCard[] {
  return cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const col = index % GRID_PER_ROW;
    const row = Math.floor(index / GRID_PER_ROW);
    return [{
      cardId: card.id,
      x: GRID_START_X + col * (GRID_CARD_SIZE + GRID_GAP_X),
      y: GRID_START_Y + row * GRID_GAP_Y,
      width: GRID_CARD_SIZE,
      height: GRID_CARD_SIZE,
      z: index,
      clickable: true,
      visibleRatio: 1
    }];
  });
}
