import { createContext, useRef, useContext } from 'react';
import { useStore, createStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { NodeChange, XYPosition } from '@xyflow/react';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';

import { ValueOf } from '@editor/util/types';
import { makeId } from '@core/util/id';
import {
  CompileResult,
  EngineContext,
  Graph,
  GraphNode,
  NodeErrors,
  NodeInput,
} from '@core';
import {
  updateFlowNodeInput,
  updateFlowNodeData,
  updateGraphNode,
  updateGraphNodeInput,
  updateFlowNode,
  updateFlowNodeConfig,
  isFlowDataNode,
} from './flow-helpers';
import {
  FlowNodeData,
  InputNodeHandle,
  FlowEdgeOrLink,
  FlowNode,
} from './flow-types';
import { Shader } from '@editor/model';
import { AnySceneConfig } from '../editorTypes';

/*******************************************************************************
 * Types and friends
 ******************************************************************************/

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

export type MouseData = {
  real: XYPosition;
  viewport: XYPosition;
  projected: XYPosition;
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

export type SceneDimensions = {
  width: number;
  height: number;
};

export type CompileInfo = {
  fragError: string | null;
  vertError: string | null;
  programError: string | null;
  compileMs: number | null;
};

export enum ContextMenuType {
  CONTEXT,
  NODE_CONTEXT,
}

export type ContextMenu = { menu: ContextMenuType; position: MouseData };

export const EDITOR_BOTTOM_PANEL = {
  TEXTURE_BROWSER: 'texture-browser',
  NODE_CONFIG_EDITOR: 'node-config-editor',
} as const;
export type EDITOR_BOTTOM_PANEL = ValueOf<typeof EDITOR_BOTTOM_PANEL>;

/*******************************************************************************
 * Editor store state, including graph and GLSL editor
 ******************************************************************************/
interface EditorState {
  // XY-Flow
  flowNodes: FlowNode[];
  flowEdges: FlowEdgeOrLink[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setFlowNodes: (
    nodesOrUpdater: FlowNode[] | ((prevNodes: FlowNode[]) => FlowNode[])
  ) => void;
  setFlowEdges: (
    edgesOrUpdater:
      | FlowEdgeOrLink[]
      | ((prevEdges: FlowEdgeOrLink[]) => FlowEdgeOrLink[])
  ) => void;
  updateAllFlowNodes: (update: (f: FlowNode) => FlowNode) => void;
  addSelectedNodes: (nodeIds: string[]) => void;
  updateFlowNode: (nodeId: string, data: Partial<FlowNode>) => void;
  updateFlowNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  updateFlowNodeConfig: (nodeId: string, config: Record<string, any>) => void;
  updateFlowInput: (
    nodeId: string,
    inputId: string,
    data: Partial<InputNodeHandle>
  ) => void;

  // Shader and core editor
  shader: Shader;
  setShader: (shader: Shader) => void;
  sceneConfig: AnySceneConfig;
  setSceneConfig: (sceneConfig: AnySceneConfig) => void;
  graph: Graph;
  setGraph: (graphOrUpdater: Graph | ((prevGraph: Graph) => Graph)) => void;
  updateGraphNode: (nodeId: string, data: Partial<GraphNode>) => void;
  updateGraphNodeInput: (
    nodeId: string,
    inputId: string,
    data: Partial<NodeInput>
  ) => void;
  compileResult: CompileResult | undefined;
  setCompileResult: (compileResult: CompileResult) => void;
  engineContext: EngineContext | undefined;
  setEngineContext: (engineContext: EngineContext) => void;

  // UI state
  menu: ContextMenu | undefined;
  setMenu: (menu: ContextMenuType, position: MouseData) => void;
  hideMenu: () => void;

  bottomPanelType: EDITOR_BOTTOM_PANEL | undefined;
  openEditorBottomPanel: (bottomPanelType: EDITOR_BOTTOM_PANEL) => void;
  closeEditorBottomPanel: () => void;
  setSceneDimensions: (dimensions: SceneDimensions) => void;
  sceneDimensions: SceneDimensions;

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
  removeEditorTabByNodeIds: (nodeIds: Set<string>) => void;
  removeEditorTabPaneId: (paneId: string) => void;

  // Node errors state
  nodeErrors: Record<string, NodeErrors>;
  setNodeErrors: (nodeId: string, errors: NodeErrors) => void;
  clearNodeErrors: () => void;

  // Compiler results
  setCompileInfo: (compileInfo: Partial<CompileInfo>) => void;
  compileInfo: CompileInfo;
}

const createEditorStore = (
  initProps: Partial<EditorState> & {
    // Required props for initiating the store. See EditorProviderProps
    shader: Shader;
    graph: Graph;
    sceneConfig: AnySceneConfig;
  }
) =>
  createStore<EditorState>((set, get) => ({
    // XY-Flow
    flowNodes: [],
    flowEdges: [],
    onNodesChange: (changes) => {
      set({
        flowNodes: applyNodeChanges<FlowNode>(
          changes as NodeChange<FlowNode>[],
          get().flowNodes
        ),
      });
    },
    onEdgesChange: (changes) => {
      set({
        flowEdges: applyEdgeChanges(changes, get().flowEdges),
      });
    },
    onConnect: (connection) => {
      set({
        flowEdges: addEdge(connection, get().flowEdges),
      });
    },
    setFlowNodes: (flowNodesOrUpdater) => {
      set((state) => {
        if (typeof flowNodesOrUpdater === 'function') {
          return { flowNodes: flowNodesOrUpdater(state.flowNodes) };
        } else {
          return { flowNodes: flowNodesOrUpdater };
        }
      });
    },
    setFlowEdges: (edgesOrUpdater) => {
      set((state) => {
        if (typeof edgesOrUpdater === 'function') {
          return { flowEdges: edgesOrUpdater(state.flowEdges) };
        } else {
          return { flowEdges: edgesOrUpdater };
        }
      });
    },
    updateAllFlowNodes: (update) =>
      set(({ flowNodes }) => ({
        flowNodes: flowNodes.map(update),
      })),
    addSelectedNodes: (nodeIds) =>
      set(({ flowNodes }) => ({
        flowNodes: flowNodes.map((node) => ({
          ...node,
          selected: nodeIds.includes(node.id) ? true : node.selected,
        })),
      })),
    updateFlowNode: (nodeId, data) =>
      set(({ flowNodes }) => ({
        flowNodes: flowNodes.map((node) =>
          node.id === nodeId ? updateFlowNode(node, data) : node
        ),
      })),
    updateFlowNodeData: (nodeId, data) =>
      set(({ flowNodes }) => ({
        flowNodes: flowNodes.map((node) =>
          node.id === nodeId ? updateFlowNodeData(node, data) : node
        ),
      })),
    updateFlowNodeConfig: (nodeId, config) =>
      set(({ flowNodes }) => ({
        flowNodes: flowNodes.map((node) =>
          node.id === nodeId && isFlowDataNode(node)
            ? updateFlowNodeConfig(node, config)
            : node
        ),
      })),
    updateFlowInput: (nodeId, inputId, data) =>
      set(({ flowNodes }) => ({
        flowNodes: flowNodes.map((node) =>
          node.id === nodeId ? updateFlowNodeInput(node, inputId, data) : node
        ),
      })),

    // Shader and core editor
    setShader: (shader) => set(() => ({ shader })),
    setSceneConfig: (sceneConfig) => set(() => ({ sceneConfig })),
    setGraph: (graphOrUpdater) =>
      set((state) => {
        if (typeof graphOrUpdater === 'function') {
          const res = graphOrUpdater(state.graph);
          return { graph: res };
        } else {
          return { graph: graphOrUpdater };
        }
      }),
    updateGraphNode: (nodeId, data) =>
      set(({ graph }) => {
        const res = updateGraphNode(graph, nodeId, data);
        return {
          graph: res,
        };
      }),
    updateGraphNodeInput: (nodeId, inputId, data) =>
      set(({ graph }) => {
        const res = {
          ...graph,
          nodes: graph.nodes.map((node) =>
            node.id === nodeId
              ? updateGraphNodeInput(node, inputId, data)
              : node
          ),
        };
        return {
          graph: res,
        };
      }),
    compileResult: undefined,
    setCompileResult: (compileResult) => set(() => ({ compileResult })),
    engineContext: undefined,
    setEngineContext: (engineContext) => set(() => ({ engineContext })),

    // UI state
    menu: undefined,
    bottomPanelType: undefined,
    setMenu: (menu, position) => set(() => ({ menu: { menu, position } })),
    hideMenu: () => set(() => ({ menu: undefined })),
    openEditorBottomPanel: (bottomPanelType: EDITOR_BOTTOM_PANEL) =>
      set(() => ({ bottomPanelType })),
    closeEditorBottomPanel: () => set(() => ({ bottomPanelType: undefined })),
    setSceneDimensions: (updated) =>
      set(({ sceneDimensions: ui }) => ({
        sceneDimensions: { ...ui, updated },
      })),
    sceneDimensions: {
      width: 0,
      height: 0,
    },

    // The tabs in the editor
    glslEditorActivePaneId: undefined,
    glslEditorTabs: [],
    setGlslEditorActivePaneId: (glslEditorActivePaneId) =>
      set(() => ({ glslEditorActivePaneId })),
    addEditorTab: (nodeId, type) =>
      set(({ glslEditorTabs }) => {
        const existing = findPaneForNodeId(glslEditorTabs, nodeId, type);
        if (existing) {
          return { glslEditorActivePaneId: existing.id };
        } else {
          const id = makeId();
          return {
            glslEditorTabs: glslEditorTabs.concat({
              type: 'pane',
              id,
              contents: { type, nodeId },
            }),
            glslEditorActivePaneId: id,
          };
        }
      }),
    removeEditorTabByNodeIds: (nodeIds) =>
      set(({ glslEditorTabs, glslEditorActivePaneId }) => {
        const filtered = glslEditorTabs.filter(
          (pane) => pane.type !== 'pane' || !nodeIds.has(pane.contents.nodeId)
        );
        return {
          glslEditorTabs: filtered,
          glslEditorActivePaneId: glslEditorTabs.some(
            (p) =>
              p.type === 'pane' && p.contents.nodeId === glslEditorActivePaneId
          )
            ? filtered[0]?.id
            : glslEditorActivePaneId,
        };
      }),
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

    // The "primary" selected node
    primarySelectedNodeId: undefined,
    setPrimarySelectedNodeId: (primarySelectedNodeId) =>
      set(() => ({ primarySelectedNodeId })),

    // Node errors state
    nodeErrors: {},
    setNodeErrors: (nodeId, errors) =>
      set((state) => ({
        nodeErrors: { ...state.nodeErrors, [nodeId]: errors },
      })),
    clearNodeErrors: () => set(() => ({ nodeErrors: {} })),

    // Compiler results
    compileInfo: {
      fragError: null,
      vertError: null,
      programError: null,
      compileMs: null,
    },
    setCompileInfo: (updated) =>
      set(({ compileInfo }) => ({
        compileInfo: { ...compileInfo, ...updated },
      })),

    ...initProps,
  }));

/*******************************************************************************
 * Store provider initialized with props from a component.
 * See https://zustand.docs.pmnd.rs/guides/initialize-state-with-props
 ******************************************************************************/

type EditorStore = ReturnType<typeof createEditorStore>;

export const EditorStoreContext = createContext<EditorStore | null>(null);

// Required props that need to be set at store creation time.
interface EditorProviderProps {
  shader: Shader;
  graph: Graph;
  sceneConfig: AnySceneConfig;
}

export const EditorProvider = ({
  children,
  ...props
}: React.PropsWithChildren<EditorProviderProps>) => {
  const storeRef = useRef<EditorStore>();
  if (!storeRef.current) {
    storeRef.current = createEditorStore(props);
  }
  return (
    <EditorStoreContext.Provider value={storeRef.current}>
      {children}
    </EditorStoreContext.Provider>
  );
};

export const useEditorStoreSelector = <T extends unknown>(
  selector: (state: EditorState) => T
): T => {
  const store = useEditorRawStore();
  return useStore(store, selector);
};

export const useEditorStore = () => {
  const store = useEditorRawStore();
  return useStore(store);
};

export const useEditorRawStore = () => {
  const store = useContext(EditorStoreContext);
  if (!store)
    throw new Error('Missing EditorStoreContext.Provider in the tree');
  return store;
};

/*******************************************************************************
 * Utility functions
 ******************************************************************************/

// Will need to look into this again once I include tabs that can contain node
// configuration and/or split panes!
export const useGlslEditorTabIndex = () => {
  const { glslEditorTabs, glslEditorActivePaneId } = useEditorStoreSelector(
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
  const { glslEditorTabs } = useEditorStoreSelector(
    useShallow(({ glslEditorTabs }) => ({
      glslEditorTabs,
    }))
  );

  return !!findPaneForNodeId(glslEditorTabs, nodeId, type);
};
