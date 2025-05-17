import { useRef } from 'react';

// Utility function to preserve specific things against fast-refresh, as
// *all* useMemo and useEffect and useCallbacks rerun during a fast-refresh
// https://nextjs.org/docs/basic-features/fast-refresh
const useOnce = <T extends unknown>(creator: (...args: any) => T): T => {
  const ref = useRef<T | undefined>(undefined);
  if (ref.current) {
    return ref.current;
  }
  ref.current = creator();
  return ref.current;
};

export default useOnce;
