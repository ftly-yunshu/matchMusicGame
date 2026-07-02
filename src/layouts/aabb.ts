import type { LayoutCard } from '../game/types.ts';

export function applyAabbClickability(cards: LayoutCard[], threshold: number): LayoutCard[] {
  return cards.map((card) => {
    const covered = cards
      .filter((other) => other.z > card.z)
      .reduce((total, other) => total + intersectionArea(card, other), 0);
    const area = card.width * card.height;
    const visibleRatio = Math.max(0, Math.min(1, 1 - covered / area));
    return { ...card, visibleRatio, clickable: visibleRatio >= threshold };
  });
}

export function applyTopOnlyClickability(cards: LayoutCard[]): LayoutCard[] {
  return cards.map((card) => {
    const hasUpperOverlap = cards
      .filter((other) => other.z > card.z)
      .some((other) => intersectionArea(card, other) > 0);
    return { ...card, visibleRatio: hasUpperOverlap ? 0.5 : 1, clickable: !hasUpperOverlap };
  });
}

export function intersectionArea(a: LayoutCard, b: LayoutCard): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}
