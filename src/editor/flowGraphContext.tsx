import { createContext, useContext } from 'react';

export const FlowGraphContext = createContext<{
  onInputBakedToggle: (id: string, name: string, baked: boolean) => void;
}>({
  onInputBakedToggle: () => {},
});

export const useFlowGraphContext = () => {
  return useContext(FlowGraphContext);
};
