import type { CardState, LayoutCard } from '../game/types.ts';
import { SHELF_CARD_SIZE, SHELF_GAP_X, SHELF_GAP_Y, SHELF_PER_ROW, SHELF_START_X, SHELF_START_Y } from './shelf.ts';

export function buildGridLayout(cards: CardState[]): LayoutCard[] {
  return cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const col = index % SHELF_PER_ROW;
    const row = Math.floor(index / SHELF_PER_ROW);
    return [{
      cardId: card.id,
      x: SHELF_START_X + col * (SHELF_CARD_SIZE + SHELF_GAP_X),
      y: SHELF_START_Y + row * SHELF_GAP_Y,
      width: SHELF_CARD_SIZE,
      height: SHELF_CARD_SIZE,
      z: index,
      clickable: true,
      visibleRatio: 1
    }];
  });
}
