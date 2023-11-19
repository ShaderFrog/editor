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
  menuPosition: XYPosition | undefined;
  setMenuPosition: (p?: XYPosition) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  menuPosition: undefined,
  setMenuPosition: (menuPosition) => set(() => ({ menuPosition })),
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
      | 'onEdgesDelete'
      | 'onConnectStart'
      | 'onEdgeUpdateStart'
      | 'onEdgeUpdateEnd'
      | 'onConnectEnd'
    >;

const FlowEditor = ({
  mouse,
  menuItems,
  onMenuAdd,
  nodes,
  edges,
  onConnect,
  onEdgeUpdate,
  onEdgesChange,
  onNodesChange,
  onNodesDelete,
  onNodeDoubleClick,
  onEdgesDelete,
  onConnectStart,
  onEdgeUpdateStart,
  onEdgeUpdateEnd,
  onConnectEnd,
  onNodeValueChange,
}: FlowEditorProps) => {
  const menuPos = useEditorStore((state) => state.menuPosition);
  const setMenuPos = useEditorStore((state) => state.setMenuPosition);

  useHotkeys('esc', () => setMenuPos());
  useHotkeys('shift+a', () => setMenuPos(mouse.current.real));

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setMenuPos(mouse.current.real);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setMenuPos]
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
  const allMenuItems: MenuItems = [
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

  return (
    <div onContextMenu={onContextMenu} className={styles.flowContainer}>
      {menuPos ? (
        <ContextMenu menu={allMenuItems} position={menuPos} onAdd={onMenuAdd} />
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
  );
};

FlowEditor.displayName = 'FlowEditor';

export type MenuItems = [string, string | MenuItems][];

const ContextMenu = ({
  position,
  onAdd,
  menu,
  title = 'Add a node',
  onMouseEnter,
}: {
  onAdd: (name: string) => void;
  position: XYPosition;
  menu: MenuItems;
  title?: string;
  onMouseEnter?: (e: MouseEvent<any>) => void;
}) => {
  const [childMenu, setChildMenu] = useState<[string, MenuItems, number]>();

  const timeout = useRef<NodeJS.Timeout>();
  const onParentMenuEnter = useCallback(() => {
    if (childMenu) {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => {
        setChildMenu(undefined);
      }, 500);
    }
  }, [childMenu, setChildMenu]);

  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  return (
    <>
      <div
        id="x-context-menu"
        className={styles.contextMenu}
        style={{ top: position.y, left: position.x }}
        onMouseEnter={onMouseEnter}
      >
        <div className={styles.contextHeader}>{title}</div>
        {menu.map(([display, typeOrChildren], index) =>
          typeof typeOrChildren === 'string' ? (
            <div
              key={display}
              className={styles.contextRow}
              onClick={() => onAdd(typeOrChildren)}
              onMouseEnter={onParentMenuEnter}
            >
              {display}
            </div>
          ) : (
            <div
              key={display}
              className={styles.contextRow}
              onMouseEnter={() => {
                if (timeout.current) {
                  clearTimeout(timeout.current);
                }
                setChildMenu([display, typeOrChildren, index]);
              }}
            >
              {display} ➤
            </div>
          )
        )}
      </div>
      {childMenu ? (
        <ContextMenu
          onAdd={onAdd}
          position={{ y: position.y + childMenu[2] * 24, x: position.x + 138 }}
          title={childMenu[0]}
          menu={childMenu[1]}
          onMouseEnter={() => {
            if (timeout.current) {
              clearTimeout(timeout.current);
            }
          }}
        ></ContextMenu>
      ) : null}
    </>
  );
};

export default FlowEditor;
