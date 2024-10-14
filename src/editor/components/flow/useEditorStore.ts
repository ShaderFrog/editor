import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { XYPosition } from 'reactflow';
import { ValueOf } from '@/editor/util/types';
import { Draft, produce as immerProduce, enableMapSet } from 'immer';
import { makeId } from '@/core/util/id';
import { NodeErrors } from '@/core';

enableMapSet();

/**
 * Hoisted state in the editor, including the graph editor and GLSL editor.
 */

// Immer's produce does not infer the zustand state type! Thanks
// https://github.com/pmndrs/zustand/issues/83#issuecomment-2228437266
export function produce<T>(cb: (value: Draft<T>) => void): (value: T) => T {
  return immerProduce(cb);
}

export type CodePane = {
  type: 'code';
  nodeId: string;
};
export type ConfigPane = {
  type: 'config';
  nodeId: string;
};

export type PaneState = {
  type: 'pane';
  id: string;
  contents: CodePane | ConfigPane;
};

// I also realize that right now this does not support vscode's concept where
// each split can itself have its own tabs. This assumes that the top level
// of everything is tabs.
export type SplitPaneState = {
  type: 'split';
  id: string;
  split: 'vertical' | 'horizontal';
  sizes: number[];
  startSplit: PaneState;
  endSplit: PaneState;
};

/**
 * Global editor state, including graph and GLSL editor.
 */
interface EditorState {
  // UI state
  menu: ContextMenu | undefined;
  bottomPanelType: EDITOR_BOTTOM_PANEL | undefined;
  setMenu: (menu: ContextMenuType, position: XYPosition) => void;
  hideMenu: () => void;
  openEditorBottomPanel: (bottomPanelType: EDITOR_BOTTOM_PANEL) => void;
  closeEditorBottomPanel: () => void;

  // The "primary" selected node, in the graph this is used for replacing. In
  // the editor this is used for the active tab. It's overloaded and the name is
  // not obvious. I do want the graph node and the editor node to stay in sync
  // and right now there's no other use cases, so keeping as one id for now.
  primarySelectedNodeId: string | undefined;
  setPrimarySelectedNodeId: (nodeId: string | undefined) => void;

  // The tabs in the GLSL editor
  glslEditorActiveNodeId: string | undefined;
  setGlslEditorActiveNodeId: (
    glslEditorActiveNodeId: string | undefined
  ) => void;

  glslEditorTabs: (PaneState | SplitPaneState)[];
  glslEditorNodeIds: Set<string>;
  addEditorTab: (nodeId: string, type: 'code' | 'config') => void;
  removeEditorTabPaneId: (paneId: string) => void;
  removeEditorTabByNodeId: (nodeId: string) => void;

  // Node errors state
  nodeErrors: Record<string, NodeErrors>;
  setNodeErrors: (nodeId: string, errors: NodeErrors) => void;
  clearNodeErrors: () => void;
}

export enum ContextMenuType {
  CONTEXT,
  NODE_CONTEXT,
}

export type ContextMenu = { menu: ContextMenuType; position: XYPosition };

export const EDITOR_BOTTOM_PANEL = {
  TEXTURE_BROWSER: 'texture-browser',
  NODE_CONFIG_EDITOR: 'node-config-editor',
} as const;
export type EDITOR_BOTTOM_PANEL = ValueOf<typeof EDITOR_BOTTOM_PANEL>;

export const useEditorStore = create<EditorState>((set) => ({
  menu: undefined,
  bottomPanelType: undefined,

  // The tabs in the editor
  glslEditorActiveNodeId: undefined,
  glslEditorTabs: [],
  glslEditorNodeIds: new Set(),
  primarySelectedNodeId: undefined,
  setGlslEditorActiveNodeId: (glslEditorActiveNodeId) =>
    set(() => ({ glslEditorActiveNodeId })),

  addEditorTab: (nodeId, type) =>
    set(
      produce((state) => {
        if (!state.glslEditorNodeIds.has(nodeId)) {
          state.glslEditorNodeIds.add(nodeId);
          state.glslEditorTabs.push({
            type: 'pane',
            id: makeId(),
            contents: { type, nodeId },
          });
        }
      })
    ),
  removeEditorTabPaneId: (paneId) =>
    set(
      produce((state) => {
        const pane = state.glslEditorTabs.find((tab) => tab.id === paneId)!;
        if (pane.type === 'pane') {
          state.glslEditorNodeIds.delete(pane.contents.nodeId);
        }
        state.glslEditorTabs = state.glslEditorTabs.filter(
          ({ id }) => id !== paneId
        );
      })
    ),

  removeEditorTabByNodeId: (nodeId: string) =>
    set(
      produce((state) => {
        const pane = state.glslEditorTabs.find(
          (tab) => (tab as PaneState).contents.nodeId === nodeId
        );
        if (pane) {
          if (pane?.type === 'pane') {
            // console.log('deleting node id', nodeId);
            state.glslEditorNodeIds.delete(pane.contents.nodeId);
          }
          // console.log('old tabs', state.glslEditorTabs);
          state.glslEditorTabs = (state.glslEditorTabs as PaneState[]).filter(
            (pane) => {
              // console.log('comparing', { pane: pane.nodeId, nodeId });
              return (pane as PaneState).contents.nodeId !== nodeId;
            }
            // ({ nodeId }) => nodeId !== nodeId
          );
          // console.log('new tabs', state.glslEditorTabs);
        } else {
          console.warn('Could not find tab to remove for node', nodeId);
        }
      })
    ),
  setPrimarySelectedNodeId: (primarySelectedNodeId) =>
    set(() => ({ primarySelectedNodeId })),
  setMenu: (menu, position) => set(() => ({ menu: { menu, position } })),
  hideMenu: () => set(() => ({ menu: undefined })),
  openEditorBottomPanel: (bottomPanelType: EDITOR_BOTTOM_PANEL) =>
    set(() => ({ bottomPanelType })),

  nodeErrors: {},
  setNodeErrors: (nodeId, errors) =>
    set((state) => ({ nodeErrors: { ...state.nodeErrors, [nodeId]: errors } })),
  clearNodeErrors: () => set(() => ({ nodeErrors: {} })),

  closeEditorBottomPanel: () => set(() => ({ bottomPanelType: undefined })),
}));

// Will need to look into this again once I include tabs that can contain node
// configuration and/or split panes!
export const useGlslEditorTabIndex = () => {
  const { glslEditorTabs, glslEditorActiveNodeId } = useEditorStore(
    useShallow(({ glslEditorTabs, glslEditorActiveNodeId }) => ({
      glslEditorTabs,
      glslEditorActiveNodeId,
    }))
  );

  // Does not work with nesting yet
  return Math.max(
    glslEditorTabs.findIndex(
      (pane) =>
        pane.type === 'pane' && pane.contents.nodeId === glslEditorActiveNodeId
    ),
    0
  );
};
