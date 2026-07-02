# Web Music Match-3 Development Rules

## Project Goal

This project is a vertical web mini game for testing 4 layout variants of a music-album themed click-to-slot match-3 game.

Primary goal now: prove whether the 4 layouts are playable.

This is not a swap/cascade/refill match-3 game. Do not build Candy Crush-style logic.

Core loop:

```text
tap selectable card -> card moves to tray -> 3 same cards archive -> clear board to win
```

## Minimal Project Structure

```text
docs/
  Notes, rules, brief summaries, playtest findings.

src/game/
  Pure TypeScript game logic: cards, tray, archive matching, win/fail, deadlock, animation lock.

src/layouts/
  The 4 layout functions only: grid, stack, shelf, overlap.

src/scenes/
  Phaser scenes. Keep this thin; scenes render state and forward input.

src/config/
  Small constants only. Do not add broad config unless a value is already changing.

public/assets/covers/
  Temporary local cover images for prototype validation.

public/assets/ui/
  Minimal UI images/icons needed by the prototype.

public/levels/
  Local JSON level data for the prototype.
```

## Where New Things Go

- Gameplay scripts: `src/game/`
- Layout scripts: `src/layouts/`
- Scene scripts: `src/scenes/`
- Config constants: `src/config/`
- Prototype cover images: `public/assets/covers/`
- Prototype UI images: `public/assets/ui/`
- Prototype level JSON: `public/levels/`
- Notes and planning docs: `docs/`

Do not add prefab, audio, platform, CDN, asset-pipeline, analytics, or E2E folders until the 4 layouts are playable and MVP work is explicitly approved.

## Hard Rules

1. Keep the first playable version small.
2. Do not modify global config or core game logic unless the user explicitly asks.
3. Before every code change, explain the target, files, approach, verification, and risk.
4. After every code change, summarize changed files, behavior implemented, verification result, and remaining risk.
5. The 4 layouts must share one game core. Layouts may only decide position, z-index, overlap, and clickability.
6. Game state drives UI. Do not store core rules on Phaser sprites or DOM nodes.
7. `item_total` and each `matchId` count must be divisible by 3.
8. Add deadlock detection in `src/game/` before treating the prototype as playable.
9. Add an animation/input lock before allowing fast repeated taps.
10. For overlap layout, use z-index + AABB visible-ratio estimation. No pixel collision.

## Prototype Success Criteria

The first milestone is done only when:

- One page can switch between 4 layouts.
- Cards can be tapped into a 7-slot tray.
- 3 same cards archive automatically.
- Clearing the board wins.
- Full tray with no archive fails.
- Stack and overlap layouts show blocked cards that cannot be tapped.

## Deferred Until MVP

Add these only after the 4 layouts are playable and the user chooses to continue:

- Playwright tests
- sharp/WebP asset pipeline
- QQ Music or CoverBox data import
- remote CDN loading
- success/fail/progress page polish
- audio system
- analytics
- platform adapter
- full asset directories
- 4 complete UI skins

## Default Tech Direction

Use Vite + TypeScript + Phaser 3 when implementation starts.

Use the smallest useful check for non-trivial logic. Avoid large test scaffolds until the prototype proves the layout direction.
