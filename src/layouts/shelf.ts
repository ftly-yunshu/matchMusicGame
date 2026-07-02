import type { CardState, LayoutCard } from '../game/types.ts';
import { shuffledSlots } from './deterministic.ts';

export const SHELF_START_X = 17;
export const SHELF_START_Y = 188;
export const SHELF_CARD_SIZE = 56;
export const SHELF_GAP_X = 4;
export const SHELF_GAP_Y = 128;
export const SHELF_PER_ROW = 6;
export const SHELF_WIDTH = 370;
export const SHELF_LAYER_ROWS = 3;
export const SHELF_GRID_ROWS = 6;
export const SHELF_VISIBLE_SLOTS = SHELF_PER_ROW * SHELF_LAYER_ROWS;

export function buildShelfLayout(cards: CardState[]): LayoutCard[] {
  const slots = shuffledSlots(SHELF_VISIBLE_SLOTS, 211);

  return cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    if (index >= SHELF_VISIBLE_SLOTS) {
      const frontCard = cards[index - SHELF_VISIBLE_SLOTS];
      if (frontCard?.status !== 'archived') return [];
    }

    const slotIndex = slots[index % SHELF_VISIBLE_SLOTS] ?? index % SHELF_VISIBLE_SLOTS;
    const col = slotIndex % SHELF_PER_ROW;
    const row = Math.floor(slotIndex / SHELF_PER_ROW);
    return [{
      cardId: card.id,
      x: SHELF_START_X + col * (SHELF_CARD_SIZE + SHELF_GAP_X),
      y: SHELF_START_Y + row * SHELF_GAP_Y,
      width: SHELF_CARD_SIZE,
      height: SHELF_CARD_SIZE,
      z: index >= SHELF_VISIBLE_SLOTS ? 1 : 0,
      clickable: true,
      visibleRatio: 1
    }];
  });
}
