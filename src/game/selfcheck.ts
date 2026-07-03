import { readFileSync } from 'node:fs';
import { createGameState, getFinalAutoArchiveIds, getHintIds, restartUnarchivedCards, returnTrayCardToBoard, setLocked, shuffleBoardCardsForClickables, tapCard, validateLevel } from './rules.ts';
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
assert(
  getFinalAutoArchiveIds(state).sort().join(',') === ['b1', 'b2', 'b3'].join(','),
  'auto finish should detect the last remaining triple'
);

for (const kind of ['grid', 'stack', 'shelf', 'overlap', 'neon9'] as const) {
  const layoutState = createGameState(level);
  const layout = buildLayout(kind, layoutState.cards);
  assert(layout.length === (kind === 'neon9' ? Math.min(9, level.cards.length) : level.cards.length), `${kind} should place expected board cards`);
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

const neonLevel = createNeonFlowLevel();
validateLevel(neonLevel);
let neonState = createGameState(neonLevel);
let neonLayout = buildLayout('neon9', neonState.cards);
assert(neonLayout.length === 9, 'neon9 should initially expose exactly nine covers');
assert(neonLayout.every((card) => card.clickable), 'neon9 visible covers should all be clickable');
assert(neonLayout.some((card) => card.cardId === 'n00-a'), 'neon9 should expose the first card in slot 0');
assert(!neonLayout.some((card) => card.cardId === 'n09-a'), 'neon9 should hide the next queued card in slot 0');

const neonBefore = new Map(neonLayout.map((card) => [card.cardId, card]));
neonState = tapCard(neonState, 'n00-a', new Set(neonLayout.map((card) => card.cardId))).state;
neonLayout = buildLayout('neon9', neonState.cards);
assert(neonLayout.length === 9, 'neon9 should keep nine visible covers after one tap');
assert(neonLayout.some((card) => card.cardId === 'n09-a'), 'neon9 should reveal the next cover in the tapped slot');
for (const card of neonLayout.filter((item) => item.cardId !== 'n09-a')) {
  const before = neonBefore.get(card.cardId);
  assert(Boolean(before), 'neon9 should not replace untouched visible slots after one tap');
  assert(before?.x === card.x && before.y === card.y, 'neon9 should keep untouched visible slots fixed');
}

neonState = returnTrayCardToBoard(neonState, 'n00-a');
neonLayout = buildLayout('neon9', neonState.cards);
assert(neonState.tray.length === 0, 'neon9 tray undo should remove the card from tray');
assert(neonLayout.some((card) => card.cardId === 'n00-a'), 'neon9 tray undo should restore the card to its original slot');
assert(!neonLayout.some((card) => card.cardId === 'n09-a'), 'neon9 tray undo should cover the next queued card again');

let neonFailState = createGameState(createNeonFailureLevel());
let neonFailLayout = buildLayout('neon9', neonFailState.cards);
for (const id of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) {
  neonFailState = tapCard(neonFailState, id, new Set(neonFailLayout.map((card) => card.cardId))).state;
  neonFailLayout = buildLayout('neon9', neonFailState.cards);
}
assert(neonFailState.status === 'failed', 'neon9 six-slot tray should fail when full without an archive');

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
assert(shelfLayerLayout.some((card) => card.cardId === 'layer-07-a'), 'shelf should reveal corresponding back slot after front card enters tray');
assert(shelfLayerLayout.length === 18, 'shelf should keep 18 visible slots after a single front card enters tray');

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
const prototypeStackState = createGameState(prototypeLevel);
const prototypeStack = buildLayout('stack', prototypeStackState.cards);
const prototypeStackClickable = new Set(prototypeStack.filter((card) => card.clickable).map((card) => card.cardId));
assert(prototypeStackClickable.size >= 10, 'prototype stack should expose at least ten clickable covers');
assert(getHintIds(prototypeStackState, prototypeStackClickable).length >= 3, 'prototype stack should expose a playable triple path');
const prototypeOverlap = buildLayout('overlap', createGameState(prototypeLevel).cards);
assert(prototypeOverlap.some((card) => card.clickable), 'prototype overlap should expose some clickable covers');
assert(prototypeOverlap.some((card) => !card.clickable), 'prototype overlap should include blocked covers for challenge');

const neonPrototypeLevel = createNeonPrototypeLevel(prototypeLevel);
validateLevel(neonPrototypeLevel);
assert(neonPrototypeLevel.cards.length === 90, 'neon prototype should last longer with ninety cards');
assert(buildLayout('neon9', createGameState(neonPrototypeLevel).cards).length === 9, 'neon prototype should still expose nine cards');
assert(hasVisibleTriple(neonPrototypeLevel.cards.slice(0, 9)), 'neon prototype first layer should expose an easy triple');
assert(hasVisibleTriple(neonPrototypeLevel.cards.slice(9, 18)), 'neon prototype second layer should expose an easy triple');

let restartState = createGameState(level);
for (const id of ids) {
  restartState = tapCard(restartState, id, allClickable).state;
}
restartState = tapCard(restartState, 'b1', allClickable).state;
restartState = restartUnarchivedCards(restartState);
assert(restartState.archivedCount === 3, 'restart should preserve archived progress');
assert(restartState.tray.length === 0, 'restart should clear tray');
assert(restartState.status === 'playing', 'restart should restore playing status');
assert(restartState.cards.filter((card) => card.matchId === 'b').every((card) => card.status === 'board'), 'restart should return unarchived tray cards to board');

const diverseRestartLevel = createDiverseRestartLevel();
let diverseRestartState = createGameState(diverseRestartLevel);
diverseRestartState = tapCard(diverseRestartState, 'ra1', new Set(diverseRestartState.cards.map((card) => card.id))).state;
const beforeRestartIds = diverseRestartState.cards.map((card) => card.id);
const beforeRestartMatchIds = diverseRestartState.cards.map((card) => card.matchId);
diverseRestartState = restartUnarchivedCards(diverseRestartState);
assert(diverseRestartState.tray.length === 0, 'restart scatter should clear tray');
assert(diverseRestartState.cards.every((card) => card.status === 'board'), 'restart scatter should return every unarchived card to board');
assert(
  diverseRestartState.cards.every((card, index) => card.id !== beforeRestartIds[index]),
  'restart scatter should move every unarchived card away from its original slot'
);
assert(
  diverseRestartState.cards.every((card, index) => card.matchId !== beforeRestartMatchIds[index]),
  'restart scatter should avoid leaving the same cover type in its original slot when possible'
);

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

function createDiverseRestartLevel(): LevelConfig {
  return {
    id: 'restart-scatter',
    title: 'restart scatter',
    slotCount: 7,
    cards: [
      { id: 'ra1', matchId: 'ra', title: 'A', asset: '' },
      { id: 'ra2', matchId: 'ra', title: 'A', asset: '' },
      { id: 'ra3', matchId: 'ra', title: 'A', asset: '' },
      { id: 'rb1', matchId: 'rb', title: 'B', asset: '' },
      { id: 'rb2', matchId: 'rb', title: 'B', asset: '' },
      { id: 'rb3', matchId: 'rb', title: 'B', asset: '' },
      { id: 'rc1', matchId: 'rc', title: 'C', asset: '' },
      { id: 'rc2', matchId: 'rc', title: 'C', asset: '' },
      { id: 'rc3', matchId: 'rc', title: 'C', asset: '' }
    ]
  };
}

function createNeonFlowLevel(): LevelConfig {
  const cards: LevelConfig['cards'] = [];
  for (let index = 0; index < 18; index++) {
    cards.push({
      id: `n${index.toString().padStart(2, '0')}-a`,
      matchId: `neon-${Math.floor(index / 3).toString().padStart(2, '0')}`,
      title: `Neon ${index}`,
      asset: ''
    });
  }

  return {
    id: 'neon-flow',
    title: 'neon flow',
    slotCount: 6,
    cards
  };
}

function createNeonFailureLevel(): LevelConfig {
  return {
    id: 'neon-failure',
    title: 'neon failure',
    slotCount: 6,
    cards: [
      { id: 'f1', matchId: 'fa', title: 'A', asset: '' },
      { id: 'f2', matchId: 'fb', title: 'B', asset: '' },
      { id: 'f3', matchId: 'fc', title: 'C', asset: '' },
      { id: 'f4', matchId: 'fd', title: 'D', asset: '' },
      { id: 'f5', matchId: 'fe', title: 'E', asset: '' },
      { id: 'f6', matchId: 'ff', title: 'F', asset: '' },
      { id: 'f7', matchId: 'fa', title: 'A', asset: '' },
      { id: 'f8', matchId: 'fb', title: 'B', asset: '' },
      { id: 'f9', matchId: 'fc', title: 'C', asset: '' },
      { id: 'f10', matchId: 'fd', title: 'D', asset: '' },
      { id: 'f11', matchId: 'fe', title: 'E', asset: '' },
      { id: 'f12', matchId: 'ff', title: 'F', asset: '' },
      { id: 'f13', matchId: 'fa', title: 'A', asset: '' },
      { id: 'f14', matchId: 'fb', title: 'B', asset: '' },
      { id: 'f15', matchId: 'fc', title: 'C', asset: '' },
      { id: 'f16', matchId: 'fd', title: 'D', asset: '' },
      { id: 'f17', matchId: 'fe', title: 'E', asset: '' },
      { id: 'f18', matchId: 'ff', title: 'F', asset: '' }
    ]
  };
}

function createNeonPrototypeLevel(baseLevel: LevelConfig): LevelConfig {
  const albumMap = new Map<string, LevelConfig['cards'][number]>();
  for (const card of baseLevel.cards) {
    if (!albumMap.has(card.matchId)) albumMap.set(card.matchId, card);
  }

  const albums = [...albumMap.values()].slice(0, 10);
  const layerKinds = [
    [0, 1, 2, 3, 0, 4, 5, 6, 0],
    [7, 1, 8, 7, 2, 9, 7, 3, 4],
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
    [2, 3, 4, 5, 6, 7, 8, 9, 1],
    [0, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, 1, 3, 4, 5, 6, 7, 8, 9],
    [0, 1, 2, 4, 5, 6, 7, 8, 9],
    [0, 1, 2, 3, 5, 6, 7, 8, 9],
    [0, 1, 2, 3, 4, 5, 6, 8, 9],
    [0, 1, 2, 3, 4, 5, 6, 8, 9]
  ];
  const cards: LevelConfig['cards'] = [];
  for (const layer of layerKinds) {
    for (const kind of layer) {
      const album = albums[kind % albums.length];
      cards.push({
        id: `neon-test-${cards.length}`,
        matchId: album.matchId,
        title: album.title,
        asset: album.asset
      });
    }
  }

  return {
    id: 'neon-prototype',
    title: 'neon prototype',
    slotCount: 6,
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

function hasVisibleTriple(cards: LevelConfig['cards']): boolean {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card.matchId, (counts.get(card.matchId) ?? 0) + 1);
  return [...counts.values()].some((count) => count >= 3);
}
