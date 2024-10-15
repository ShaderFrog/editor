import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { XYPosition } from 'reactflow';
import { ValueOf } from '@/editor/util/types';
import { Draft, produce as immerProduce, enableMapSet } from 'immer';
import { makeId } from '@/core/util/id';
import { NodeErrors } from '@/core';

// Required for immer to work with Map and Set
enableMapSet();

/**
 * Hoisted state in the editor, including the graph editor and GLSL editor.
 */

// Immer's produce does not infer the zustand state type! Thanks
// https://github.com/pmndrs/zustand/issues/83#issuecomment-2228437266
export function produce<T>(cb: (value: Draft<T>) => void): (value: T) => T {
  return immerProduce(cb);
}

export type LiveEditPane = {
  type: 'live_edit';
  nodeId: string;
};
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
  contents: LiveEditPane | CodePane | ConfigPane;
};

export type PaneType = PaneState['contents']['type'];

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

export type UiState = {
  sceneWidth: number;
  sceneHeight: number;
};

export type CompileInfo = {
  fragError: string | null;
  vertError: string | null;
  programError: string | null;
  compileMs: number | null;
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
  glslEditorActivePaneId: string | undefined;
  setGlslEditorActivePaneId: (
    glslEditorActivePaneId: string | undefined
  ) => void;

  glslEditorTabs: (PaneState | SplitPaneState)[];
  addEditorTab: (nodeId: string, type: PaneType) => void;
  removeEditorTabPaneId: (paneId: string) => void;

  // Node errors state
  nodeErrors: Record<string, NodeErrors>;
  setNodeErrors: (nodeId: string, errors: NodeErrors) => void;
  clearNodeErrors: () => void;

  setCompileInfo: (compileInfo: Partial<CompileInfo>) => void;
  compileInfo: CompileInfo;

  setUi: (ui: Partial<UiState>) => void;
  ui: UiState;
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
  glslEditorActivePaneId: undefined,
  glslEditorTabs: [],
  primarySelectedNodeId: undefined,
  setGlslEditorActivePaneId: (glslEditorActivePaneId) =>
    set(() => ({ glslEditorActivePaneId })),

  addEditorTab: (nodeId, type) =>
    set(
      produce((state) => {
        console.log('hi');
        const existing = findPaneForNodeId(state.glslEditorTabs, nodeId, type);
        if (existing) {
          state.glslEditorActivePaneId = existing.id;
        } else {
          const id = makeId();
          state.glslEditorTabs.push({
            type: 'pane',
            id,
            contents: { type, nodeId },
          });
          state.glslEditorActivePaneId = id;
        }
      })
    ),
  removeEditorTabPaneId: (paneId) =>
    set(({ glslEditorTabs, glslEditorActivePaneId }) => {
      const filtered = glslEditorTabs.filter(({ id }) => id !== paneId);
      return {
        glslEditorTabs: filtered,
        glslEditorActivePaneId:
          glslEditorActivePaneId === paneId
            ? filtered[0]?.id
            : glslEditorActivePaneId,
      };
    }),

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

  setCompileInfo: (updated) =>
    set(({ compileInfo }) => ({ compileInfo: { ...compileInfo, updated } })),
  compileInfo: {
    fragError: null,
    vertError: null,
    programError: null,
    compileMs: null,
  },

  setUi: (updated) => set(({ ui }) => ({ ui: { ...ui, updated } })),
  ui: {
    sceneWidth: 0,
    sceneHeight: 0,
  },
}));

// Will need to look into this again once I include tabs that can contain node
// configuration and/or split panes!
export const useGlslEditorTabIndex = () => {
  const { glslEditorTabs, glslEditorActivePaneId } = useEditorStore(
    useShallow(({ glslEditorTabs, glslEditorActivePaneId }) => ({
      glslEditorTabs,
      glslEditorActivePaneId,
    }))
  );

  // Does not work with nesting yet
  return Math.max(
    glslEditorTabs.findIndex(({ id }) => id === glslEditorActivePaneId),
    0
  );
};

export const findPaneForNodeId = (
  glslEditorTabs: (PaneState | SplitPaneState)[],
  nodeId: string,
  type: PaneType
) => {
  return glslEditorTabs.find(
    (pane) =>
      pane.type === 'pane' &&
      pane.contents.nodeId === nodeId &&
      pane.contents.type === type
  );
};

export const useIsNodeIdOpen = (nodeId: string, type: PaneType) => {
  const { glslEditorTabs } = useEditorStore(
    useShallow(({ glslEditorTabs }) => ({
      glslEditorTabs,
    }))
  );

  return !!findPaneForNodeId(glslEditorTabs, nodeId, type);
};
