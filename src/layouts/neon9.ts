import { NEON_LAYOUT } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';

export function buildNeon9Layout(cards: CardState[]): LayoutCard[] {
  const layout: LayoutCard[] = [];

  for (let slot = 0; slot < NEON_LAYOUT.visibleSlots; slot++) {
    const card = cards.find((item, index) => item.status === 'board' && index % NEON_LAYOUT.visibleSlots === slot);
    if (!card) continue;

    const col = slot % 3;
    const row = Math.floor(slot / 3);
    layout.push({
      cardId: card.id,
      x: NEON_LAYOUT.boardX + col * (NEON_LAYOUT.cellSize + NEON_LAYOUT.cellGap),
      y: NEON_LAYOUT.boardY + row * (NEON_LAYOUT.cellSize + NEON_LAYOUT.cellGap),
      width: NEON_LAYOUT.cellSize,
      height: NEON_LAYOUT.cellSize,
      z: slot,
      clickable: true,
      visibleRatio: 1
    });
  }

  return layout;
}
