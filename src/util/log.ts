export const logger = (
  prefix: string
): {
  log: (...args: any[]) => void;
  logOnce: (logKey: any, ...args: any[]) => void;
} => {
  const loggedKeys = new Set<any>();
  // Generate a deterministic escape code color for logging based on the prefix
  const color = `\x1b[3${(prefix.charCodeAt(0) % 6) + 3}m`;
  return {
    log: (...args: any[]) => {
      console.log.call(console, `${color}(${prefix})\x1b[0m`, ...args);
    },
    logOnce: (logKey: any, ...args: any[]) => {
      // Only log once for this unique key
      const key =
        typeof logKey === 'object'
          ? Object.entries(logKey)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')
          : logKey.toString();
      if (loggedKeys.has(key)) {
        return;
      }
      loggedKeys.add(key);
      console.log.call(console, `${color}(${prefix}) (once)\x1b[0m`, ...args);
    },
  };
};
