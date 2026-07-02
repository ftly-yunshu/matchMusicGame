import { CARD_HEIGHT, CARD_WIDTH } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';
import { applyTopOnlyClickability } from './aabb.ts';
import { seededOffset, shuffledSlots } from './deterministic.ts';

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
  const rowCounts = count > 24 ? [4, 6, 8, 8, 6, 4] : [3, 5, 6, 4];
  const xStep = 41;
  const yStep = 52;
  const startY = count > 24 ? 166 : 200;
  const order = shuffledSlots(count, 307);
  const positions: Array<{ x: number; y: number; z: number }> = [];
  const centerX = GAME_BOARD_WIDTH / 2;
  const centerY = startY + ((rowCounts.length - 1) * yStep) / 2 + CARD_HEIGHT / 2;

  for (let row = 0; row < rowCounts.length; row++) {
    const rowCount = rowCounts[row];
    const rowWidth = CARD_WIDTH + (rowCount - 1) * xStep;
    const startX = Math.round((GAME_BOARD_WIDTH - rowWidth) / 2);
    for (let col = 0; col < rowCount; col++) {
      const slot = positions.length;
      const randomIndex = order[slot] ?? slot;
      const x = startX + col * xStep + seededOffset(randomIndex, 313, 10);
      const y = startY + row * yStep + seededOffset(randomIndex, 317, 8);
      const dx = Math.abs(x + CARD_WIDTH / 2 - centerX) / xStep;
      const dy = Math.abs(y + CARD_HEIGHT / 2 - centerY) / yStep;
      const z = Math.round(100 - (dx + dy) * 10);
      positions.push({ x, y, z });
      if (positions.length === count) return positions;
    }
  }

  return positions;
}

const GAME_BOARD_WIDTH = 390;
