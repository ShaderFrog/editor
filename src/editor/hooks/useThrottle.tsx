import { AnyFn } from '@editor/util/types';
import throttle from 'lodash.throttle';
import { useCallback, useEffect, useRef } from 'react';

function useThrottle(callback: AnyFn, delay: number) {
  const cbRef = useRef<AnyFn>(callback);

  // use mutable ref to make useCallback/throttle not depend on `cb` dep
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    throttle((...args) => cbRef.current(...args), delay),
    [delay]
  );
}

export default useThrottle;
