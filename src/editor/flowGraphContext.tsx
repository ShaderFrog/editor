import { createContext, useContext } from 'react';

export const FlowGraphContext = createContext<{
  onInputBakedToggle: (id: string, name: string, baked: boolean) => void;
  jumpToError: (id: string) => void;
}>({
  onInputBakedToggle: () => {},
  jumpToError: () => {},
});

export const useFlowGraphContext = () => {
  return useContext(FlowGraphContext);
};
