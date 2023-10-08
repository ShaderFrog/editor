import { createContext, useContext, useEffect, useRef } from 'react';

// WARNING: This file is duplicated in site and editor

// TODO: Try replacing with zustand?
export const HoistedRef = createContext<any>({});
export type HoistedRefGetter = <T extends unknown>(
  key: string,
  setter?: () => T
) => T;

export const useHoisty = () => {
  return useContext(HoistedRef) as {
    getRefData: HoistedRefGetter;
  };
};

export const Hoisty: React.FC = ({ children }) => {
  const refData = useRef<{ [key: string]: any }>({});

  // TODO: I've hard to hard code "three" / "babylon" in the respective places
  // that use this hook, to keep the old context around to destroy it, and to
  // prevent babylon calling this hook and getting a brand new context. Can I
  // instead clear this, or forceUpdate?
  const getRefData: HoistedRefGetter = (key, setter) => {
    if (!refData.current[key] && setter) {
      refData.current[key] = setter();
    }
    return refData.current[key];
  };

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.entries(refData.current || {}).forEach(([key, value]) => {
        if (value?.destroy) {
          console.log(`Hoisted Context calling destroy for ${key}`);
          value.destroy();
        }
      });
    };
  }, []);

  return (
    <HoistedRef.Provider value={{ refData, getRefData }}>
      {children}
    </HoistedRef.Provider>
  );
};
