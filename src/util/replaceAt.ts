export const replaceAt = (array: any[], index: number, value: any) => [
  ...array.slice(0, index),
  value,
  ...array.slice(index + 1),
];
