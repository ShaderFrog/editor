import React, {
  useCallback,
  useRef,
  MouseEvent,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import ConnectionLine from './ConnectionLine';
import { create } from 'zustand';

import ReactFlow, {
  Background,
  BackgroundVariant,
  XYPosition,
  ReactFlowProps,
  ReactFlowInstance,
} from 'reactflow';

import { NodeType, GraphDataType } from '@core/graph';
import { EngineNodeType } from '@core/engine';
import FlowEdgeComponent from './FlowEdge';
import { DataNodeComponent, SourceNodeComponent } from './FlowNode';
import { FlowEventHack } from '../../flowEventHack';

import styles from './context.menu.module.css';
import GraphContextMenu, { MenuItems } from './GraphContextMenu';
import { FlowEditorContext } from '@editor/editor/flowEditorContext';
import { isMacintosh } from '@editor/editor-util/platform';

/**
 * This file is an attempt to break up Editor.tsx by abstracting out the view
 * implementaiton of FlowEditor. Any visual / non-graph functionality inside
 * the graph editor is meant to go in here.
 *
 * The menu and the mouse position need input from the parent component. Right
 * now I pass the mouse as a mutable object and the menu position with zustand.
 * Maybe instead put both in zustand or pull it all up into the parent? I don't
 * want to cause a re-render on every mouse move which is why it's an object
 */

interface EditorStore {
  menu: ContextMenu | undefined;
  setMenu: (menu: ContextMenuType, position: XYPosition) => void;
  hideMenu: () => void;
}

export enum ContextMenuType {
  CONTEXT,
  NODE_CONTEXT,
}

export type ContextMenu = { menu: ContextMenuType; position: XYPosition };

export const useEditorStore = create<EditorStore>((set) => ({
  menu: undefined,
  setMenu: (menu, position) => set(() => ({ menu: { menu, position } })),
  hideMenu: () => set(() => ({ menu: undefined })),
}));

// Terrible hack to make the flow graph full height minus the tab height - I
// need better layoutting of the tabs + graph
const flowStyles = { background: '#111' };

const flowKey = 'example-flow';

const nodeTypes: Record<NodeType | GraphDataType | EngineNodeType, any> = {
  toon: SourceNodeComponent,
  phong: SourceNodeComponent,
  physical: SourceNodeComponent,
  shader: SourceNodeComponent,
  output: SourceNodeComponent,
  binary: SourceNodeComponent,
  source: SourceNodeComponent,
  vector2: DataNodeComponent,
  vector3: DataNodeComponent,
  vector4: DataNodeComponent,
  rgb: DataNodeComponent,
  rgba: DataNodeComponent,
  mat2: DataNodeComponent,
  mat3: DataNodeComponent,
  mat4: DataNodeComponent,
  mat2x2: DataNodeComponent,
  mat2x3: DataNodeComponent,
  mat2x4: DataNodeComponent,
  mat3x2: DataNodeComponent,
  mat3x3: DataNodeComponent,
  mat3x4: DataNodeComponent,
  mat4x2: DataNodeComponent,
  mat4x3: DataNodeComponent,
  mat4x4: DataNodeComponent,
  texture: DataNodeComponent,
  samplerCube: DataNodeComponent,
  number: DataNodeComponent,
  array: DataNodeComponent,
};

export const SHADERFROG_FLOW_EDGE_TYPE = 'special';

const edgeTypes: Record<typeof SHADERFROG_FLOW_EDGE_TYPE, any> = {
  [SHADERFROG_FLOW_EDGE_TYPE]: FlowEdgeComponent,
};

export type MouseData = { real: XYPosition; projected: XYPosition };

type FlowEditorProps =
  | {
      menuItems: MenuItems;
      mouse: React.MutableRefObject<MouseData>;
      onNodeValueChange: (id: string, value: any) => void;
      onMenuAdd: (type: string) => void;
      onNodeContextSelect: (nodeId: string, type: string) => void;
    } & Pick<
      ReactFlowProps,
      | 'nodes'
      | 'edges'
      | 'onConnect'
      | 'onEdgeUpdate'
      | 'onEdgesChange'
      | 'onNodesChange'
      | 'onNodesDelete'
      | 'onNodeDoubleClick'
      | 'onSelectionChange'
      | 'onEdgesDelete'
      | 'onConnectStart'
      | 'onEdgeUpdateStart'
      | 'onEdgeUpdateEnd'
      | 'onConnectEnd'
    >;

export enum NodeContextActions {
  EDIT_SOURCE = '1',
  DELETE_NODE_AND_DEPENDENCIES = '2',
  DELETE_NODE_ONLY = '3',
}
const nodeContextMenuItems: MenuItems = [
  ['Edit Source', NodeContextActions.EDIT_SOURCE, 'DblClick'],
  [
    'Delete Node And Dependencies',
    NodeContextActions.DELETE_NODE_AND_DEPENDENCIES,
    isMacintosh() ? 'Delete' : 'Backspace',
  ],
  [
    'Delete Node Only',
    NodeContextActions.DELETE_NODE_ONLY,
    isMacintosh() ? 'Option-Delete' : 'Ctrl-Backspace',
  ],
];

const FlowEditor = ({
  mouse,
  menuItems,
  onMenuAdd,
  onNodeContextSelect,
  nodes,
  edges,
  onConnect,
  onEdgeUpdate,
  onEdgesChange,
  onNodesChange,
  onNodesDelete,
  onSelectionChange,
  onNodeDoubleClick,
  onEdgesDelete,
  onConnectStart,
  onEdgeUpdateStart,
  onEdgeUpdateEnd,
  onConnectEnd,
  onNodeValueChange,
}: FlowEditorProps) => {
  const { menu, setMenu, hideMenu } = useEditorStore();
  const [contextNodeId, setContextNodeId] = useState<string>();

  useHotkeys('esc', () => hideMenu());
  useHotkeys('shift+a', () =>
    setMenu(ContextMenuType.CONTEXT, mouse.current.real)
  );

  const setContextMenu = useCallback(
    (type: ContextMenuType) => {
      setMenu(type, mouse.current.real);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setMenu]
  );

  const openNodeContextMenu = useCallback(
    (id: string) => {
      setContextNodeId(id);
      setContextMenu(ContextMenuType.NODE_CONTEXT);
    },
    [setContextMenu]
  );

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setContextMenu(ContextMenuType.CONTEXT);
    },
    [setContextMenu]
  );

  const [rfInstance, setRfInstance] = useState<ReactFlowInstance>();
  const onMoveEnd = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject().viewport;
      localStorage.setItem(flowKey, JSON.stringify(flow));
    }
  }, [rfInstance]);
  const defaultViewport = useMemo(
    () =>
      JSON.parse(localStorage.getItem(flowKey) || 'null') || {
        x: 200,
        y: 150,
        zoom: 0.5,
      },
    []
  );

  // These are processed in useGraph() for the next time you need to figure this out
  const addNodeMenuItems: MenuItems = [
    [
      'Source Code',
      [
        ['Fragment and Vertex', 'fragmentandvertex'],
        ['Fragment', 'fragment'],
        ['Vertex', 'vertex'],
      ],
    ],
    [
      'Data',
      [
        ['Number', 'number'],
        ['Texture', 'texture'],
        ['Sampler Cube', 'samplerCube'],
        ['Vector2', 'vector2'],
        ['Vector3', 'vector3'],
        ['Vector4', 'vector4'],
        ['Color (RGB)', 'rgb'],
        ['Color (RGBA)', 'rgba'],
      ],
    ],
    [
      'Math',
      [
        ['Add', 'add'],
        ['Multiply', 'multiply'],
      ],
    ],
    ...menuItems,
  ];

  const onContextSelect = useCallback(
    (type: string) => {
      if (contextNodeId) {
        onNodeContextSelect(contextNodeId, type);
      }
    },
    [onNodeContextSelect, contextNodeId]
  );

  return (
    <FlowEditorContext.Provider value={{ openNodeContextMenu }}>
      <div onContextMenu={onContextMenu} className={styles.flowContainer}>
        {menu?.menu === ContextMenuType.CONTEXT ? (
          <GraphContextMenu
            menu={addNodeMenuItems}
            position={menu.position}
            onSelect={onMenuAdd}
          />
        ) : menu?.menu === ContextMenuType.NODE_CONTEXT ? (
          <GraphContextMenu
            title="Node Actions"
            menu={nodeContextMenuItems}
            position={menu.position}
            onSelect={onContextSelect}
          />
        ) : null}
        <FlowEventHack onChange={onNodeValueChange}>
          <ReactFlow
            defaultViewport={defaultViewport}
            style={flowStyles}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodes={nodes}
            edges={edges}
            onMoveEnd={onMoveEnd}
            onConnect={onConnect}
            onEdgeUpdate={onEdgeUpdate}
            onEdgesChange={onEdgesChange}
            onNodesChange={onNodesChange}
            onNodesDelete={onNodesDelete}
            onSelectionChange={onSelectionChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgesDelete={onEdgesDelete}
            connectionLineComponent={ConnectionLine}
            onConnectStart={onConnectStart}
            onEdgeUpdateStart={onEdgeUpdateStart}
            onEdgeUpdateEnd={onEdgeUpdateEnd}
            onConnectEnd={onConnectEnd}
            onInit={setRfInstance}
            minZoom={0.2}
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={25}
              size={0.5}
              color="#222222"
            />
          </ReactFlow>
        </FlowEventHack>
      </div>
    </FlowEditorContext.Provider>
  );
};

FlowEditor.displayName = 'FlowEditor';

export default FlowEditor;
