import { OVERLAP_LAYOUT, VISIBLE_RATIO_THRESHOLD } from '../config/constants.ts';
import type { CardState, LayoutCard } from '../game/types.ts';
import { applyAabbClickability } from './aabb.ts';

export function buildOverlapLayout(cards: CardState[]): LayoutCard[] {
  const boardCards = cards.filter((card) => card.status === 'board');
  const centers = buildClusterCenters(boardCards.length);

  const layout: LayoutCard[] = cards.flatMap((card, index) => {
    if (card.status !== 'board') return [];
    const clusterIndex = Math.floor(index / OVERLAP_LAYOUT.clusterSize);
    const localIndex = index % OVERLAP_LAYOUT.clusterSize;
    const center = centers[clusterIndex] ?? centers[centers.length - 1];
    const angle = seeded(index, 11) * Math.PI * 2;
    const radiusX = 14 + seeded(index, 23) * OVERLAP_LAYOUT.clusterRadiusX;
    const radiusY = 12 + seeded(index, 31) * OVERLAP_LAYOUT.clusterRadiusY;
    const layerOffset = localIndex % 3;
    const x = clamp(
      center.x + Math.cos(angle) * radiusX + seededOffset(index, 43, 24),
      18,
      372 - OVERLAP_LAYOUT.size
    );
    const y = clamp(
      center.y + Math.sin(angle) * radiusY + seededOffset(index, 53, 28),
      112,
      594 - OVERLAP_LAYOUT.size
    );
    return [{
      cardId: card.id,
      x: Math.round(x),
      y: Math.round(y),
      width: OVERLAP_LAYOUT.size,
      height: OVERLAP_LAYOUT.size,
      z: clusterIndex * 10 + layerOffset * 2 + localIndex,
      clickable: true,
      visibleRatio: 1
    }];
  });

  return applyAabbClickability(layout, VISIBLE_RATIO_THRESHOLD);
}

function buildClusterCenters(count: number): Array<{ x: number; y: number }> {
  const clusterCount = Math.max(1, Math.ceil(count / OVERLAP_LAYOUT.clusterSize));
  return Array.from({ length: clusterCount }, (_, index) => {
    const t = clusterCount === 1 ? 0 : index / (clusterCount - 1);
    const x = lerp(OVERLAP_LAYOUT.minX, OVERLAP_LAYOUT.maxX, (index % 3) / 2);
    const y = lerp(OVERLAP_LAYOUT.minY, OVERLAP_LAYOUT.maxY, t);
    return {
      x: x + seededOffset(index, 71, 26),
      y: y + seededOffset(index, 83, 22)
    };
  });
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seeded(index: number, salt: number): number {
  const raw = Math.sin((index + 1) * salt) * 10000;
  return raw - Math.floor(raw);
}

function seededOffset(index: number, salt: number, range: number): number {
  return Math.round((seeded(index, salt) - 0.5) * range);
}
