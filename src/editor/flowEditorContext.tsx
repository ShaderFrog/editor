import { createContext, useContext } from 'react';

export const FlowEditorContext = createContext<{
  openNodeContextMenu: (nodeId: string) => void;
}>({
  openNodeContextMenu: () => {},
});

export const useFlowEditorContext = () => {
  return useContext(FlowEditorContext);
};
