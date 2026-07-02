import { readFileSync } from 'node:fs';
import { createGameState, setLocked, shuffleBoardCardsForClickables, tapCard, validateLevel } from './rules.ts';
import type { LevelConfig } from './types.ts';
import { buildLayout } from '../layouts/index.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const level: LevelConfig = {
  id: 'selfcheck',
  title: 'selfcheck',
  slotCount: 7,
  cards: [
    { id: 'a1', matchId: 'a', title: 'A', asset: '' },
    { id: 'a2', matchId: 'a', title: 'A', asset: '' },
    { id: 'a3', matchId: 'a', title: 'A', asset: '' },
    { id: 'b1', matchId: 'b', title: 'B', asset: '' },
    { id: 'b2', matchId: 'b', title: 'B', asset: '' },
    { id: 'b3', matchId: 'b', title: 'B', asset: '' }
  ]
};
validateLevel(level);

let state = createGameState(level);
const allClickable = new Set(state.cards.map((card) => card.id));

state = setLocked(state, true);
const lockedTap = tapCard(state, level.cards[0].id, allClickable);
assert(lockedTap.blockedReason === 'locked', 'locked state must reject taps');

state = setLocked(state, false);
const matchId = level.cards[0].matchId;
const ids = level.cards.filter((card) => card.matchId === matchId).map((card) => card.id);
for (const id of ids) {
  state = tapCard(state, id, allClickable).state;
}

assert(state.tray.length === 0, 'three matching cards should archive and clear tray');
assert(state.archivedCount === 3, 'archived count should increase by 3');

for (const kind of ['grid', 'stack', 'shelf', 'overlap'] as const) {
  const layoutState = createGameState(level);
  const layout = buildLayout(kind, layoutState.cards);
  assert(layout.length === level.cards.length, `${kind} should place every board card`);
  assert(layout.some((card) => card.clickable), `${kind} should expose at least one clickable card`);

  const stableTap = tapCard(layoutState, level.cards[0].id, new Set(layout.map((card) => card.cardId))).state;
  const afterTapLayout = buildLayout(kind, stableTap.cards);
  const beforeById = new Map(layout.map((card) => [card.cardId, card]));
  for (const card of afterTapLayout) {
    const before = beforeById.get(card.cardId);
    assert(Boolean(before), `${kind} should only remove the tapped card from layout`);
    assert(before?.x === card.x && before.y === card.y, `${kind} should not shift untouched cards after tap`);
  }
}

let finalState = createGameState(level);
const allIds = new Set(finalState.cards.map((card) => card.id));
for (const id of level.cards.filter((card) => card.matchId !== 'b').map((card) => card.id)) {
  finalState = tapCard(finalState, id, allIds).state;
}
for (const kind of ['grid', 'stack', 'shelf', 'overlap'] as const) {
  const finalLayout = buildLayout(kind, finalState.cards);
  assert(finalLayout.length === 3, `${kind} final triple should have three board cards`);
  if (kind === 'stack') {
    assert(finalLayout.some((card) => card.clickable), 'stack final triple should expose at least one top card');
  } else {
    assert(finalLayout.every((card) => card.clickable), `${kind} final triple should never be stuck unclickable`);
  }
}

let stackShuffleState = createGameState(level);
stackShuffleState = tapCard(stackShuffleState, 'a1', allIds).state;
stackShuffleState = tapCard(stackShuffleState, 'a2', allIds).state;
let stackClickable = new Set(buildLayout('stack', stackShuffleState.cards).filter((card) => card.clickable).map((card) => card.cardId));
stackShuffleState = shuffleBoardCardsForClickables(stackShuffleState, stackClickable);
const shuffledStackLayout = buildLayout('stack', stackShuffleState.cards);
stackClickable = new Set(shuffledStackLayout.filter((card) => card.clickable).map((card) => card.cardId));
const exposedArchiveCard = stackShuffleState.cards.find((card) => card.status === 'board' && card.matchId === 'a' && stackClickable.has(card.id));
assert(Boolean(exposedArchiveCard), 'stack shuffle should expose a card that completes the tray triple');
stackShuffleState = tapCard(stackShuffleState, exposedArchiveCard?.id ?? '', stackClickable).state;
assert(stackShuffleState.archivedCount === 3, 'stack shuffle exposed card should archive the tray triple');

const shelfLayerLevel = createLayeredShelfLevel();
validateLevel(shelfLayerLevel);
let shelfLayerState = createGameState(shelfLayerLevel);
let shelfLayerLayout = buildLayout('shelf', shelfLayerState.cards);
assert(shelfLayerLayout.length === 18, 'shelf should initially expose only front-layer cards');
assert(
  shelfLayerLayout.every((card) => shelfLayerLevel.cards.findIndex((item) => item.id === card.cardId) < 18),
  'shelf initial layout should hide all back-layer cards'
);

let shelfLayerClickable = new Set(shelfLayerLayout.filter((card) => card.clickable).map((card) => card.cardId));
shelfLayerState = tapCard(shelfLayerState, 'layer-01-a', shelfLayerClickable).state;
shelfLayerLayout = buildLayout('shelf', shelfLayerState.cards);
assert(!shelfLayerLayout.some((card) => card.cardId === 'layer-07-a'), 'shelf should not reveal back layer before front card archives');

shelfLayerClickable = new Set(shelfLayerLayout.filter((card) => card.clickable).map((card) => card.cardId));
shelfLayerState = tapCard(shelfLayerState, 'layer-01-b', shelfLayerClickable).state;
shelfLayerLayout = buildLayout('shelf', shelfLayerState.cards);
shelfLayerClickable = new Set(shelfLayerLayout.filter((card) => card.clickable).map((card) => card.cardId));
shelfLayerState = tapCard(shelfLayerState, 'layer-01-c', shelfLayerClickable).state;
shelfLayerLayout = buildLayout('shelf', shelfLayerState.cards);
const revealedBackIds = new Set(shelfLayerLayout.map((card) => card.cardId));
assert(
  ['layer-07-a', 'layer-07-b', 'layer-07-c'].every((id) => revealedBackIds.has(id)),
  'shelf should reveal corresponding back-layer slots after front-layer cards archive'
);
assert(shelfLayerLayout.length === 18, 'shelf should keep 18 occupied visible slots after revealing back layer');

const prototypeLevel = JSON.parse(readFileSync('public/levels/test-level.json', 'utf8')) as LevelConfig;
validateLevel(prototypeLevel);
assertNoHorizontalTriples(prototypeLevel.cards.slice(0, 18), 6, 'prototype front layer');
assertNoHorizontalTriples(prototypeLevel.cards.slice(18, 36), 6, 'prototype back layer');
assertNoHorizontalTriples(prototypeLevel.cards, 6, 'prototype grid');
const prototypeOverlap = buildLayout('overlap', createGameState(prototypeLevel).cards);
assert(prototypeOverlap.some((card) => card.clickable), 'prototype overlap should expose some clickable covers');
assert(prototypeOverlap.some((card) => !card.clickable), 'prototype overlap should include blocked covers for challenge');

console.log('logic self-check passed');

function createLayeredShelfLevel(): LevelConfig {
  const cards: LevelConfig['cards'] = [];
  for (let group = 1; group <= 12; group++) {
    for (const suffix of ['a', 'b', 'c']) {
      cards.push({
        id: `layer-${group.toString().padStart(2, '0')}-${suffix}`,
        matchId: `layer-${group.toString().padStart(2, '0')}`,
        title: `Layer ${group}`,
        asset: ''
      });
    }
  }

  return {
    id: 'shelf-layer',
    title: 'shelf layer',
    slotCount: 7,
    cards
  };
}

function assertNoHorizontalTriples(cards: LevelConfig['cards'], perRow: number, label: string): void {
  for (let index = 0; index < cards.length; index += perRow) {
    const row = cards.slice(index, index + perRow);
    for (let col = 0; col <= row.length - 3; col++) {
      const matchIds = row.slice(col, col + 3).map((card) => card.matchId);
      assert(new Set(matchIds).size > 1, `${label} should not place three matching covers consecutively`);
    }
  }
}
