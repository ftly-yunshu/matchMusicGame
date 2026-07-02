export function seeded(index: number, salt: number): number {
  const raw = Math.sin((index + 1) * salt) * 10000;
  return raw - Math.floor(raw);
}

export function seededOffset(index: number, salt: number, range: number): number {
  return Math.round((seeded(index, salt) - 0.5) * range);
}

export function shuffledSlots(count: number, salt: number): number[] {
  return Array.from({ length: count }, (_, index) => index)
    .sort((a, b) => seeded(a, salt) - seeded(b, salt));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
