import { OVERLAP_LAYOUT, VISIBLE_RATIO_THRESHOLD } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';
import { applyAabbClickability } from './aabb.ts';

export function buildOverlapLayout(cards: CardState[]): LayoutCard[] {
  const layout: LayoutCard[] = cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const col = index % OVERLAP_LAYOUT.cols;
    const row = Math.floor(index / OVERLAP_LAYOUT.cols);
    const jitterX = seededOffset(index, 17, 18);
    const jitterY = seededOffset(index, 29, 14);
    const stagger = row % 2 === 0 ? 0 : OVERLAP_LAYOUT.rowStagger;
    return [{
      cardId: card.id,
      x: OVERLAP_LAYOUT.startX + col * OVERLAP_LAYOUT.xStep + stagger + jitterX,
      y: OVERLAP_LAYOUT.startY + row * OVERLAP_LAYOUT.yStep + jitterY,
      width: OVERLAP_LAYOUT.size,
      height: OVERLAP_LAYOUT.size,
      z: index,
      clickable: true,
      visibleRatio: 1
    }];
  });

  return applyAabbClickability(layout, VISIBLE_RATIO_THRESHOLD);
}

function seededOffset(index: number, salt: number, range: number): number {
  const raw = Math.sin((index + 1) * salt) * 10000;
  return Math.round((raw - Math.floor(raw) - 0.5) * range);
}
