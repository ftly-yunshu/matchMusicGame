import { CARD_HEIGHT, CARD_WIDTH, GAME_WIDTH } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';
import { applyTopOnlyClickability } from './aabb.ts';
import { seededOffset } from './deterministic.ts';

export function buildStackLayout(cards: CardState[]): LayoutCard[] {
  const positions = buildPyramidPositions(cards.length);

  const layout: LayoutCard[] = cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const position = positions[index] ?? { x: 164, y: 248, z: 0 };
    return [{
      cardId: card.id,
      x: position.x,
      y: position.y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      z: position.z,
      clickable: true,
      visibleRatio: 1
    }];
  });

  return applyTopOnlyClickability(layout);
}

function buildPyramidPositions(count: number): Array<{ x: number; y: number; z: number }> {
  const layers = count > 24
    ? [
      { rows: [4, 5, 5], startY: 214, xStep: 66, yStep: 68, zBase: 10, offsetX: 0 },
      { rows: [4, 4, 4], startY: 188, xStep: 66, yStep: 68, zBase: 50, offsetX: 4 },
      { rows: [3, 4, 3], startY: 150, xStep: 68, yStep: 70, zBase: 100, offsetX: 0 }
    ]
    : [
      { rows: [3, 4], startY: 220, xStep: 66, yStep: 68, zBase: 10, offsetX: 0 },
      { rows: [3, 3], startY: 190, xStep: 68, yStep: 70, zBase: 70, offsetX: 0 }
    ];
  const positions: Array<{ x: number; y: number; z: number }> = [];

  for (const layer of layers) {
    for (let row = 0; row < layer.rows.length; row++) {
      const rowCount = layer.rows[row];
      const rowWidth = CARD_WIDTH + (rowCount - 1) * layer.xStep;
      const startX = Math.round((GAME_WIDTH - rowWidth) / 2) + layer.offsetX;
      for (let col = 0; col < rowCount; col++) {
        const slot = positions.length;
        const x = startX + col * layer.xStep + seededOffset(slot, 313, 6);
        const y = layer.startY + row * layer.yStep + seededOffset(slot, 317, 5);
        const centerBias = Math.abs(col - (rowCount - 1) / 2);
        const z = layer.zBase + row * 4 + Math.round((rowCount - centerBias) * 2);
        positions.push({ x, y, z });
        if (positions.length === count) return positions;
      }
    }
  }

  return positions;
}
