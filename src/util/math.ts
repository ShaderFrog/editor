export const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

export const range = (start: number, end: number) =>
  Array.from({ length: end - start }, (_, i) => i + start);
