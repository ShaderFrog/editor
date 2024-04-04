export const union = <T extends unknown>(...iterables: Set<T>[]) => {
  const set = new Set<T>();

  for (const iterable of iterables) {
    for (const item of iterable) {
      set.add(item);
    }
  }

  return set;
};
