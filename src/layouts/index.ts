import type { CardState, LayoutCard, LayoutKind } from '../game/types.ts';
import { buildGridLayout } from './grid.ts';
import { buildNeon9Layout } from './neon9.ts';
import { buildOverlapLayout } from './overlap.ts';
import { buildShelfLayout } from './shelf.ts';
import { buildStackLayout } from './stack.ts';

export function buildLayout(kind: LayoutKind, cards: CardState[]): LayoutCard[] {
  const layout = kind === 'stack'
    ? buildStackLayout(cards)
    : kind === 'shelf'
      ? buildShelfLayout(cards)
      : kind === 'neon9'
        ? buildNeon9Layout(cards)
        : kind === 'overlap'
          ? buildOverlapLayout(cards)
          : buildGridLayout(cards);
  return kind === 'stack' ? layout : unlockFinalTriples(layout, cards);
}

function unlockFinalTriples(layout: LayoutCard[], cards: CardState[]): LayoutCard[] {
  const boardCards = cards.filter((card) => card.status === 'board');
  if (boardCards.length !== 3) return layout;

  const boardCounts = new Map<string, number>();
  for (const card of boardCards) {
    boardCounts.set(card.matchId, (boardCounts.get(card.matchId) ?? 0) + 1);
  }

  const finalMatchIds = new Set(
    [...boardCounts.entries()]
      .filter(([, count]) => count === 3)
      .map(([matchId]) => matchId)
  );
  if (finalMatchIds.size === 0) return layout;

  const matchByCardId = new Map(cards.map((card) => [card.id, card.matchId]));
  return layout.map((card) => (
    finalMatchIds.has(matchByCardId.get(card.cardId) ?? '')
      ? { ...card, clickable: true, visibleRatio: Math.max(card.visibleRatio, 0.6) }
      : card
  ));
}
