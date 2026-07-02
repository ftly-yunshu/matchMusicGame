import { VISIBLE_RATIO_THRESHOLD } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';
import { applyAabbClickability } from './aabb.ts';

export function buildOverlapLayout(cards: CardState[]): LayoutCard[] {
  const size = 50;
  const xStep = 48;
  const yStep = 54;
  const jitter = [
    [0, 8], [10, -4], [-8, 5], [6, 0], [-4, -7], [8, 6],
    [-10, -3], [4, 9], [12, 2], [-6, 8], [7, -6], [-12, 4]
  ];

  const layout: LayoutCard[] = cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const col = index % 6;
    const row = Math.floor(index / 6);
    const [jx, jy] = jitter[index % jitter.length];
    return [{
      cardId: card.id,
      x: 30 + col * xStep + jx,
      y: 130 + row * yStep + jy,
      width: size,
      height: size,
      z: index,
      clickable: true,
      visibleRatio: 1
    }];
  });

  return applyAabbClickability(layout, VISIBLE_RATIO_THRESHOLD);
}
