# Music Match Prototype

Vertical web prototype for testing 4 music-album click-to-slot match-3 layouts.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run check:logic
pnpm run build
```

## What To Verify

1. Open the page in a narrow/mobile viewport.
2. Tap the layout button near the bottom to open the dropdown.
3. Switch between:
   - 01 传统三消
   - 02 多层堆叠
   - 03 唱片架
   - 04 交错覆盖
4. Tap cards into the 7-slot tray.
5. Tap 3 cards with the same cover and confirm they archive.
6. In stack/overlap layouts, tap dimmed blocked cards and confirm they do not enter the tray.
7. Confirm `01 传统三消` uses the shelf visual style while all 36 board cards remain available.
8. Confirm `03 唱片架` starts with 18 visible front-layer cards, then reveals back-layer cards only after matching front-layer cards archive.
9. Confirm untouched cards do not slide into new positions after a card is tapped.
10. Confirm card flight has no path line, and 3 matched tray covers merge before disappearing.

## Prototype Limits

- Uses 36 local cards from `public/assets/covers/`.
- Uses Phaser-drawn UI, not final art.
- Card labels are intentionally hidden; the full cover card is the tap area.
- No audio, analytics, CDN, Playwright, or asset pipeline yet.
