import { OVERLAP_LAYOUT, VISIBLE_RATIO_THRESHOLD } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';
import { applyAabbClickability } from './aabb.ts';
import { clamp, seeded, seededOffset, shuffledSlots } from './deterministic.ts';

export function buildOverlapLayout(cards: CardState[]): LayoutCard[] {
  const slots = shuffledSlots(OVERLAP_LAYOUT.cols * OVERLAP_LAYOUT.rows, 401);
  const cellWidth = (OVERLAP_LAYOUT.maxX - OVERLAP_LAYOUT.minX) / Math.max(1, OVERLAP_LAYOUT.cols - 1);
  const cellHeight = (OVERLAP_LAYOUT.maxY - OVERLAP_LAYOUT.minY) / Math.max(1, OVERLAP_LAYOUT.rows - 1);
  const centerX = (OVERLAP_LAYOUT.minX + OVERLAP_LAYOUT.maxX) / 2;
  const centerY = (OVERLAP_LAYOUT.minY + OVERLAP_LAYOUT.maxY) / 2;

  const layout: LayoutCard[] = cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const slot = slots[index % slots.length] ?? index;
    const col = slot % OVERLAP_LAYOUT.cols;
    const row = Math.floor(slot / OVERLAP_LAYOUT.cols);
    const baseX = OVERLAP_LAYOUT.minX + col * cellWidth;
    const baseY = OVERLAP_LAYOUT.minY + row * cellHeight;
    const pullX = (centerX - baseX) * (seeded(index, 421) * 0.18);
    const pullY = (centerY - baseY) * (seeded(index, 431) * 0.12);
    const x = clamp(
      baseX + pullX + seededOffset(index, 443, OVERLAP_LAYOUT.jitterX),
      18,
      372 - OVERLAP_LAYOUT.size
    );
    const y = clamp(
      baseY + pullY + seededOffset(index, 457, OVERLAP_LAYOUT.jitterY),
      112,
      594 - OVERLAP_LAYOUT.size
    );
    return [{
      cardId: card.id,
      x: Math.round(x),
      y: Math.round(y),
      width: OVERLAP_LAYOUT.size,
      height: OVERLAP_LAYOUT.size,
      z: Math.round(row * 8 + col + seeded(index, 467) * 6),
      clickable: true,
      visibleRatio: 1
    }];
  });

  return applyAabbClickability(layout, VISIBLE_RATIO_THRESHOLD);
}
