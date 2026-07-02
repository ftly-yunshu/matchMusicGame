import type { GameState, LevelConfig, TapResult } from './types.ts';

export function validateLevel(level: LevelConfig): void {
  if (level.cards.length % 3 !== 0) {
    throw new Error(`item_total must be divisible by 3: ${level.cards.length}`);
  }

  const counts = new Map<string, number>();
  for (const card of level.cards) {
    counts.set(card.matchId, (counts.get(card.matchId) ?? 0) + 1);
  }

  for (const [matchId, count] of counts) {
    if (count % 3 !== 0) {
      throw new Error(`matchId ${matchId} count must be divisible by 3: ${count}`);
    }
  }
}

export function createGameState(level: LevelConfig): GameState {
  validateLevel(level);

  return {
    levelId: level.id,
    title: level.title,
    slotCount: level.slotCount,
    cards: level.cards.map((card) => ({ ...card, status: 'board' })),
    tray: [],
    archivedCount: 0,
    status: 'playing',
    message: '',
    locked: false,
    deadlocked: false
  };
}

export function setLocked(state: GameState, locked: boolean): GameState {
  return { ...state, locked };
}

export function getFinalAutoArchiveIds(state: GameState): string[] {
  if (state.status !== 'playing') return [];

  const unarchived = state.cards.filter((card) => card.status !== 'archived');
  if (unarchived.length !== 3) return [];

  const matchId = unarchived[0]?.matchId;
  if (!matchId || unarchived.some((card) => card.matchId !== matchId)) return [];

  return unarchived.map((card) => card.id);
}

export function tapCard(state: GameState, cardId: string, clickableCardIds: Set<string>): TapResult {
  if (state.status !== 'playing') {
    return { state, archivedCardIds: [], blockedReason: 'not-playing' };
  }
  if (state.locked) {
    return { state, archivedCardIds: [], blockedReason: 'locked' };
  }
  if (!clickableCardIds.has(cardId)) {
    return { state, archivedCardIds: [], blockedReason: 'not-clickable' };
  }

  const card = state.cards.find((item) => item.id === cardId);
  if (!card || card.status !== 'board') {
    return { state, archivedCardIds: [], blockedReason: 'not-on-board' };
  }

  let next: GameState = {
    ...state,
    cards: state.cards.map((item) => (item.id === cardId ? { ...item, status: 'tray' } : item)),
    tray: [...state.tray, cardId],
    message: '',
    deadlocked: false
  };

  const archiveIds = findArchiveIds(next);
  if (archiveIds.length === 3) {
    const archiveSet = new Set(archiveIds);
    next = {
      ...next,
      cards: next.cards.map((item) => (archiveSet.has(item.id) ? { ...item, status: 'archived' } : item)),
      tray: next.tray.filter((id) => !archiveSet.has(id)),
      archivedCount: next.archivedCount + 3,
      message: '已归档'
    };
  }

  const boardRemaining = next.cards.some((item) => item.status === 'board');
  if (!boardRemaining) {
    next = { ...next, status: 'won', message: '刷新完成' };
  } else if (next.tray.length >= next.slotCount) {
    next = { ...next, status: 'failed', message: '槽位已满' };
  }

  return { state: next, movedCardId: cardId, archivedCardIds: archiveIds };
}

export function withDeadlockCheck(state: GameState, clickableCardIds: Set<string>): GameState {
  if (state.status !== 'playing') return state;
  const deadlocked = isDeadlocked(state, clickableCardIds);
  return {
    ...state,
    deadlocked,
    message: deadlocked ? '无可归档，请重排' : state.message
  };
}

export function getHintIds(state: GameState, clickableCardIds: Set<string>): string[] {
  const candidates = state.cards.filter((card) => card.status === 'board' && clickableCardIds.has(card.id));
  const trayCounts = getTrayMatchCounts(state);

  for (const candidate of candidates) {
    if ((trayCounts.get(candidate.matchId) ?? 0) >= 2) return [candidate.id];
  }

  const byMatch = new Map<string, string[]>();
  for (const candidate of candidates) {
    const list = byMatch.get(candidate.matchId) ?? [];
    list.push(candidate.id);
    byMatch.set(candidate.matchId, list);
  }

  return [...byMatch.values()].find((ids) => ids.length >= 3)?.slice(0, 3) ?? candidates.slice(0, 1).map((card) => card.id);
}

export function shuffleBoardCards(state: GameState): GameState {
  const boardCards = state.cards.filter((card) => card.status === 'board');
  const reversed = [...boardCards].reverse();
  let index = 0;
  return {
    ...state,
    cards: state.cards.map((card) => (card.status === 'board' ? reversed[index++] : card)),
    message: '已重排',
    deadlocked: false
  };
}

export function restartUnarchivedCards(state: GameState): GameState {
  const unarchived = state.cards.filter((card) => card.status !== 'archived');
  const shuffled = scatterUnarchivedCards(unarchived);
  let index = 0;

  return {
    ...state,
    cards: state.cards.map((card) => {
      if (card.status === 'archived') return card;
      const next = shuffled[index++];
      return { ...next, status: 'board' };
    }),
    tray: [],
    status: 'playing',
    message: '已重新整理',
    locked: false,
    deadlocked: false
  };
}

function scatterUnarchivedCards<T extends { id: string; matchId: string }>(cards: T[]): T[] {
  if (cards.length <= 1) return cards;

  let best = [...cards].reverse();
  let bestScore = scoreScatter(cards, best);
  const steps = [7, 5, 11, 13, 3, 2, 1].filter((step) => gcd(step, cards.length) === 1);

  for (let offset = 1; offset < cards.length; offset++) {
    for (const step of steps) {
      const candidate: T[] = [];
      let cursor = offset;
      for (let index = 0; index < cards.length; index++) {
        candidate.push(cards[cursor]);
        cursor = (cursor + step) % cards.length;
      }

      const score = scoreScatter(cards, candidate);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
      if (bestScore === 0) return best;
    }
  }

  return best;
}

function scoreScatter<T extends { id: string; matchId: string }>(original: T[], candidate: T[]): number {
  let sameId = 0;
  let sameMatch = 0;
  for (let index = 0; index < original.length; index++) {
    if (original[index].id === candidate[index].id) sameId++;
    if (original[index].matchId === candidate[index].matchId) sameMatch++;
  }
  return sameId * 100 + sameMatch;
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left;
}

export function shuffleBoardCardsForClickables(state: GameState, clickableCardIds: Set<string>): GameState {
  const boardCards = state.cards.filter((card) => card.status === 'board');
  const clickablePositions = state.cards
    .map((card, index) => (card.status === 'board' && clickableCardIds.has(card.id) ? index : -1))
    .filter((index) => index >= 0);
  const target = findShuffleTarget(state, clickablePositions.length);

  if (!target) {
    return {
      ...state,
      message: '暂无可重排组合',
      deadlocked: false
    };
  }

  const pickedIds = new Set<string>();
  const picked = boardCards.filter((card) => {
    if (card.matchId !== target.matchId || pickedIds.size >= target.need) return false;
    pickedIds.add(card.id);
    return true;
  });
  const rest = boardCards.filter((card) => !pickedIds.has(card.id));
  const targetPositions = new Set(clickablePositions.slice(0, target.need));
  let pickedIndex = 0;
  let restIndex = 0;

  return {
    ...state,
    cards: state.cards.map((card, index) => {
      if (card.status !== 'board') return card;
      return targetPositions.has(index) ? picked[pickedIndex++] : rest[restIndex++];
    }),
    message: '已重排，可归档',
    deadlocked: false
  };
}

function findArchiveIds(state: GameState): string[] {
  const idsByMatch = new Map<string, string[]>();
  for (const id of state.tray) {
    const card = state.cards.find((item) => item.id === id);
    if (!card) continue;
    const ids = idsByMatch.get(card.matchId) ?? [];
    ids.push(id);
    idsByMatch.set(card.matchId, ids);
  }

  return [...idsByMatch.values()].find((ids) => ids.length >= 3)?.slice(0, 3) ?? [];
}

function isDeadlocked(state: GameState, clickableCardIds: Set<string>): boolean {
  if (state.tray.length >= state.slotCount) return false;
  const boardCards = state.cards.filter((card) => card.status === 'board');
  if (boardCards.length === 0) return false;

  const trayCounts = getTrayMatchCounts(state);
  const clickableCounts = new Map<string, number>();
  for (const card of boardCards) {
    if (!clickableCardIds.has(card.id)) continue;
    clickableCounts.set(card.matchId, (clickableCounts.get(card.matchId) ?? 0) + 1);
  }

  for (const [matchId, clickCount] of clickableCounts) {
    const trayCount = trayCounts.get(matchId) ?? 0;
    if (trayCount + Math.min(clickCount, state.slotCount - state.tray.length) >= 3) {
      return false;
    }
    if (clickCount >= 3) return false;
  }

  return true;
}

function getTrayMatchCounts(state: GameState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of state.tray) {
    const card = state.cards.find((item) => item.id === id);
    if (!card) continue;
    counts.set(card.matchId, (counts.get(card.matchId) ?? 0) + 1);
  }
  return counts;
}

function findShuffleTarget(state: GameState, clickableCount: number): { matchId: string; need: number } | undefined {
  const trayCounts = getTrayMatchCounts(state);
  const boardCounts = new Map<string, number>();
  for (const card of state.cards) {
    if (card.status !== 'board') continue;
    boardCounts.set(card.matchId, (boardCounts.get(card.matchId) ?? 0) + 1);
  }

  const trayTargets = [...trayCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [matchId, count] of trayTargets) {
    const need = 3 - count;
    if (need > 0 && need <= clickableCount && (boardCounts.get(matchId) ?? 0) >= need) {
      return { matchId, need };
    }
  }

  if (clickableCount < 3) return undefined;
  for (const [matchId, count] of boardCounts) {
    if (count >= 3) return { matchId, need: 3 };
  }

  return undefined;
}
