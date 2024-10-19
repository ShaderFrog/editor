import React, { useCallback, MouseEvent, useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  ReactFlow,
  Node as XYFlowNode,
  Background,
  BackgroundVariant,
  XYPosition,
  ReactFlowProps,
  ReactFlowInstance,
} from '@xyflow/react';

import { NodeType, GraphDataType } from '@core/graph';
import { EngineNodeType } from '@core/engine';

import ConnectionLine from './ConnectionLine';
import FlowEdgeComponent from './FlowEdge';
import {
  DataNodeComponent,
  FlowNodeData,
  SourceNodeComponent,
} from './FlowNode';
import { FlowEventHack } from '../../flowEventHack';

import ContextMenu, { MenuItem } from '../ContextMenu';
import { FlowEditorContext } from '@editor/editor/flowEditorContext';
import { isMacintosh } from '@editor/util/platform';

import styles from './floweditor.module.css';
import { ContextMenuType, useEditorStore } from './editor-store';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalculator,
  faCode,
  faCubes,
  faFileCode,
  faHashtag,
  faImage,
  faMultiply,
  faPalette,
  faPallet,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { FlowEdgeOrLink, FlowNode } from './flow-helpers';

// Terrible hack to make the flow graph full height minus the tab height - I
// need better layoutting of the tabs + graph
const flowStyles = { background: '#111' };

const flowKey = (id: string | undefined) => `shaderflog_flow_${id}`;

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

export type MouseData = {
  real: XYPosition;
  viewport: XYPosition;
  projected: XYPosition;
};

export enum NodeContextActions {
  EDIT_SOURCE = '1',
  EDIT_CONFIG = '5',
  DELETE_NODE_AND_DEPENDENCIES = '2',
  DELETE_NODE_ONLY = '3',
  DELETE_FULL_NODE_TREE = '4',
}
const nodeContextMenuItems = (node?: FlowNode): MenuItem[] => {
  if (!node) {
    return [];
  }

  const isData = 'value' in node.data;
  return isData
    ? [
        {
          display: 'Edit Node Config',
          value: NodeContextActions.EDIT_SOURCE,
        },
        {
          display: 'Delete Node',
          value: NodeContextActions.DELETE_NODE_ONLY,
          key: isMacintosh() ? 'Delete' : 'Backspace',
        },
      ]
    : [
        // TODO: engine nodes have type "physical" but no other indicators they
        // need the config link, do I need to put engine in the flownodedata?
        // and selecting the menu on the "add" node triggers an infinite array serach?
        // need to figure out what's not breaking the loope
        ...(node.type === 'source'
          ? [
              {
                display: 'Edit Source',
                value: NodeContextActions.EDIT_SOURCE,
                key: 'Double Click',
              },
              {
                display: 'Edit Configuration',
                value: NodeContextActions.EDIT_CONFIG,
              },
            ]
          : []),
        {
          display: 'Delete Node & Data',
          value: NodeContextActions.DELETE_NODE_AND_DEPENDENCIES,
          key: isMacintosh() ? 'Delete' : 'Backspace',
        },
        {
          display: 'Delete Node Only',
          value: NodeContextActions.DELETE_NODE_ONLY,
          key: isMacintosh() ? 'Option-Delete' : 'Ctrl-Backspace',
        },
        {
          display: 'Delete Node Tree',
          value: NodeContextActions.DELETE_FULL_NODE_TREE,
        },
      ].filter(Boolean);
};

type FlowEditorProps =
  | {
      nodes: FlowNode[];
      edges: FlowEdgeOrLink[];
      menuItems: MenuItem[];
      // onNodesDelete: (nodes: FlowNode[]) => void;
      mouse: React.MutableRefObject<MouseData>;
      onNodeValueChange: (id: string, value: any) => void;
      onMenuAdd: (type: string) => void;
      onMenuClose: () => void;
      onNodeContextSelect: (nodeId: string, type: string) => void;
      onNodeContextHover: (nodeId: string, type: string) => void;
    } & Pick<
      ReactFlowProps,
      | 'onConnect'
      | 'onReconnect'
      | 'onEdgesChange'
      | 'onNodesChange'
      | 'onNodesDelete'
      | 'onNodeDoubleClick'
      | 'onSelectionChange'
      | 'onEdgesDelete'
      | 'onConnectStart'
      | 'onReconnectStart'
      | 'onReconnectEnd'
      | 'onNodeDragStop'
      | 'onConnectEnd'
    >;

const FlowEditor = ({
  mouse,
  menuItems,
  onMenuAdd,
  onMenuClose,
  onNodeContextSelect,
  onNodeContextHover,
  nodes,
  edges,
  onConnect,
  onReconnect,
  onEdgesChange,
  onNodesChange,
  onNodesDelete,
  onSelectionChange,
  onNodeDoubleClick,
  onEdgesDelete,
  onConnectStart,
  onReconnectStart,
  onReconnectEnd,
  onConnectEnd,
  onNodeDragStop,
  onNodeValueChange,
}: FlowEditorProps) => {
  const { menu, setMenu, hideMenu, shader } = useEditorStore();
  const [contextNodeId, setContextNodeId] = useState<string>();

  useHotkeys('esc', () => hideMenu());
  useHotkeys('shift+a', () =>
    setMenu(ContextMenuType.CONTEXT, mouse.current.viewport)
  );

  const setContextMenu = useCallback(
    (type: ContextMenuType) => {
      setMenu(type, mouse.current.viewport);
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
      localStorage.setItem(flowKey(shader.id), JSON.stringify(flow));
    }
  }, [rfInstance]);
  const defaultViewport = useMemo(
    () =>
      JSON.parse(localStorage.getItem(flowKey(shader.id)) || 'null') || {
        x: 200,
        y: 150,
        zoom: 0.5,
      },
    []
  );

  // These are processed in useGraph() for the next time you need to figure this out
  const addNodeMenuItems: MenuItem[] = [
    {
      display: 'Source Code',
      value: 'Source Code',
      icon: <FontAwesomeIcon icon={faCode} />,
      children: [
        {
          display: 'Fragment and Vertex',
          value: 'fragmentandvertex',
          icon: <FontAwesomeIcon icon={faCode} />,
        },
        {
          display: 'Fragment',
          value: 'fragment',
          icon: <FontAwesomeIcon icon={faFileCode} />,
        },
        {
          display: 'Vertex',
          value: 'vertex',
          icon: <FontAwesomeIcon icon={faFileCode} />,
        },
      ],
    },
    {
      display: 'Data',
      value: 'Data',
      icon: <FontAwesomeIcon icon={faCubes} />,
      children: [
        {
          display: 'Number',
          value: 'number',
          icon: <FontAwesomeIcon icon={faHashtag} />,
        },
        {
          display: 'Texture',
          value: 'texture',
          icon: <FontAwesomeIcon icon={faImage} />,
        },
        { display: 'Sampler Cube', value: 'samplerCube' },
        { display: 'Vector2', value: 'vector2' },
        { display: 'Vector3', value: 'vector3' },
        { display: 'Vector4', value: 'vector4' },
        {
          display: 'Color (RGB)',
          value: 'rgb',
          icon: <FontAwesomeIcon icon={faPalette} />,
        },
        {
          display: 'Color (RGBA)',
          value: 'rgba',
          icon: <FontAwesomeIcon icon={faPalette} />,
        },
      ],
    },
    {
      display: 'Math',
      value: 'Math',
      icon: <FontAwesomeIcon icon={faCalculator} />,
      children: [
        {
          display: 'Add',
          value: 'add',
          icon: <FontAwesomeIcon icon={faPlus} />,
        },
        {
          display: 'Multiply',
          value: 'multiply',
          icon: <FontAwesomeIcon icon={faMultiply} />,
        },
      ],
    },
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

  const onContextItemHover = useCallback(
    (type: string) => {
      if (contextNodeId) {
        onNodeContextHover(contextNodeId, type);
      }
    },
    [onNodeContextHover, contextNodeId]
  );

  const nodeContextMenu = useMemo(
    () =>
      nodeContextMenuItems(
        (nodes || []).find((node) => node.id === contextNodeId)
      ),
    [nodes, contextNodeId]
  );

  const { isOver, setNodeRef } = useDroppable({
    id: 'droppable',
  });

  return (
    <FlowEditorContext.Provider value={{ openNodeContextMenu }}>
      <div
        onContextMenu={onContextMenu}
        className={styles.flowContainer}
        ref={setNodeRef}
      >
        {menu?.menu === ContextMenuType.CONTEXT ? (
          <ContextMenu
            menu={addNodeMenuItems}
            position={menu.position}
            onItemHover={onContextItemHover}
            onSelect={onMenuAdd}
            onClose={onMenuClose}
          />
        ) : menu?.menu === ContextMenuType.NODE_CONTEXT ? (
          <ContextMenu
            title="Node Actions"
            menu={nodeContextMenu}
            position={menu.position}
            onItemHover={onContextItemHover}
            onSelect={onContextSelect}
            onClose={onMenuClose}
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
            onReconnect={onReconnect}
            onEdgesChange={onEdgesChange}
            onNodesChange={onNodesChange}
            onNodesDelete={onNodesDelete}
            onSelectionChange={onSelectionChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgesDelete={onEdgesDelete}
            connectionLineComponent={ConnectionLine}
            onConnectStart={onConnectStart}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            onConnectEnd={onConnectEnd}
            onNodeDragStop={onNodeDragStop}
            onInit={setRfInstance}
            minZoom={0.2}
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={25}
              size={0.5}
              color={isOver ? '#223322' : '#222222'}
            />
          </ReactFlow>
        </FlowEventHack>
      </div>
    </FlowEditorContext.Provider>
  );
};

FlowEditor.displayName = 'FlowEditor';

export default FlowEditor;
