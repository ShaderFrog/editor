import React, {
  useCallback,
  MouseEvent,
  useState,
  useMemo,
  useRef,
} from 'react';
import cx from 'classnames';
import { useDroppable } from '@dnd-kit/core';
import { useHotkeys } from 'react-hotkeys-hook';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  XYPosition,
  ReactFlowProps,
  ReactFlowInstance,
  NodeTypes,
  EdgeTypes,
  NodeChange,
  useReactFlow,
  Connection,
  Edge,
} from '@xyflow/react';

import ConnectionLine from './ConnectionLine';
import FlowEdgeComponent from './FlowEdge';
import {
  DataNodeComponent,
  SourceNodeComponent,
  PREVIEW_HEIGHT,
} from './FlowNode';
import { FlowEventHack } from '../../flowEventHack';

import ContextMenu, { MenuItem } from '../ContextMenu';
import { FlowEditorContext } from '@editor/editor/flowEditorContext';
import { isMacintosh } from '@editor/util/platform';

import editorStyles from '../../styles/editor.module.css';
import styles from './floweditor.module.css';
import { ContextMenuType, MouseData, useEditorStore } from './editor-store';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalculator,
  faCode,
  faCubes,
  faDivide,
  faFileCode,
  faHashtag,
  faImage,
  faMaximize,
  faMinus,
  faMultiply,
  faPalette,
  faPlus,
  faSitemap,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';

import {
  FlowNode,
  FlowEdgeOrLink,
  SHADERFROG_FLOW_EDGE_TYPE,
  FlowNodeDataData,
} from './flow-types';
import { HandleOffset, layoutFlowNodes } from './flow-helpers';
import { isPreviewableNode } from './graph-helpers';
import { canMapType } from '@core/graph/data-nodes';
import {
  BinaryNode,
  BinaryNodeType,
  binaryNodeType,
  binaryNodeTypes,
  GraphNode,
  NodeType,
} from '@core/graph';

// Terrible hack to make the flow graph full height minus the tab height - I
// need better layoutting of the tabs + graph
const flowStyles = {
  background: 'radial-gradient(ellipse at 50% 40%, #17191c 0%, #0c0d0f 100%)',
};

const flowKey = (id: string | undefined) => `shaderflog_flow_${id}`;

const nodeTypes: NodeTypes = {
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

const edgeTypes = {
  [SHADERFROG_FLOW_EDGE_TYPE]: FlowEdgeComponent,
  // This is a whole nightmare, if you use the actual type of the eddgeTypes prop:
  //    Record<typeof SHADERFROG_FLOW_EDGE_TYPE, React.ComponentType<EdgeProps>>
  // Then it errors on component assignment. This satisfies seems to work.
} satisfies EdgeTypes;

export const binaryNodeMenuItems: Record<
  BinaryNodeType,
  { display: string; icon: React.ReactNode }
> = {
  add: { display: 'Add', icon: <FontAwesomeIcon icon={faPlus} /> },
  subtract: { display: 'Subtract', icon: <FontAwesomeIcon icon={faMinus} /> },
  multiply: {
    display: 'Multiply',
    icon: <FontAwesomeIcon icon={faMultiply} />,
  },
  divide: { display: 'Divide', icon: <FontAwesomeIcon icon={faDivide} /> },
};

// Context menu values for "Change Node Type" are this prefix + the new type
export const CHANGE_NODE_TYPE_PREFIX = 'change_type:';

export enum NodeContextActions {
  EDIT_SOURCE = '1',
  EDIT_CONFIG = '5',
  DELETE_NODE_AND_DEPENDENCIES = '2',
  DELETE_NODE_ONLY = '3',
  DELETE_FULL_NODE_TREE = '4',
}
const nodeContextMenuItems = (
  node?: FlowNode,
  graphNode?: GraphNode
): MenuItem[] => {
  if (!node) {
    return [];
  }

  const currentBinaryType =
    graphNode?.type === NodeType.BINARY
      ? binaryNodeType(graphNode as BinaryNode)
      : undefined;

  const isData = 'value' in node.data;
  const isEngine = 'engine' in node.data && node.data.engine;
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
        ...(node.type === 'source' || isEngine
          ? [
              {
                display: isEngine ? 'View Source' : 'Edit Source',
                value: NodeContextActions.EDIT_SOURCE,
                key: 'Double Click',
              },
              {
                display: 'Edit Configuration',
                value: NodeContextActions.EDIT_CONFIG,
              },
            ]
          : []),
        ...(graphNode?.type === NodeType.BINARY
          ? [
              {
                display: 'Edit Node Config',
                value: NodeContextActions.EDIT_SOURCE,
                key: 'Double Click',
              },
              {
                display: 'Change Node Type',
                children: binaryNodeTypes
                  .filter((type) => type !== currentBinaryType)
                  .map((type) => ({
                    ...binaryNodeMenuItems[type],
                    value: CHANGE_NODE_TYPE_PREFIX + type,
                  })),
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
      engine: { name: string };
      menuItems: MenuItem[];
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

const copyMouse = (mouse: MouseData): MouseData => ({
  projected: { ...mouse.projected },
  real: { ...mouse.real },
  viewport: { ...mouse.viewport },
});

const FlowEditor = ({
  mouse,
  engine,
  menuItems,
  onMenuAdd,
  onMenuClose,
  onNodeContextSelect,
  onNodeContextHover,
  onConnect,
  onReconnect,
  onEdgesChange,
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
  const {
    menu,
    setMenu,
    hideMenu,
    shader,
    onNodesChange,
    compileResult,
    flowNodes,
    flowEdges,
    graph,
    setFlowNodes,
    setGraph,
  } = useEditorStore();
  const [contextNodeId, setContextNodeId] = useState<string>();
  const {
    getNode,
    getNodes,
    getInternalNode,
    fitBounds,
    deleteElements,
    screenToFlowPosition,
  } = useReactFlow();

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const sourceData = getNode(c.source)?.data as FlowNodeDataData;
      const sourceHandle = sourceData.outputs.find(
        (o) => o.id === c.sourceHandle
      );

      const targetData = getNode(c.target)?.data as FlowNodeDataData;
      const targetHandle = targetData.inputs.find(
        (i) => i.id === c.targetHandle
      );

      return canMapType(sourceHandle?.dataType, targetHandle?.dataType);
    },
    [getNode]
  );

  /**
   * When React Flow makes a change to the graph *nodes*, it proposes a set of
   * changes. This callback lets you intercept those changes. It handles at
   * least node selection, dragging, and deletion changes.
   *
   * This strategy to is taken from https://github.com/xyflow/xyflow/issues/3092
   */
  const onNodesChangeIntercept = useCallback(
    (changes: NodeChange[]) => {
      // Prevent deleting of output nodes
      const nextChanges = changes.reduce<NodeChange[]>((acc, change) => {
        if (change.type === 'remove') {
          const node = getNode(change.id);
          if (node?.type !== 'output') {
            return [...acc, change];
          }
          return acc;
        }

        return [...acc, change];
      }, []);

      onNodesChange(nextChanges);
    },
    [getNode, onNodesChange]
  );

  useHotkeys('esc', () => hideMenu());
  useHotkeys('shift+a', () =>
    setMenu(ContextMenuType.CONTEXT, copyMouse(mouse.current))
  );

  const setContextMenu = useCallback(
    (type: ContextMenuType) => {
      setMenu(type, copyMouse(mouse.current));
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
  }, [rfInstance, shader.id]);

  const defaultViewport = useMemo(
    () =>
      JSON.parse(localStorage.getItem(flowKey(shader.id)) || 'null') || {
        x: 200,
        y: 150,
        zoom: 0.5,
      },
    [shader.id]
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
      children: binaryNodeTypes.map((type) => ({
        ...binaryNodeMenuItems[type],
        value: type,
      })),
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
        (flowNodes || []).find((node) => node.id === contextNodeId),
        graph.nodes.find((node) => node.id === contextNodeId)
      ),
    [flowNodes, graph.nodes, contextNodeId]
  );

  const { isOver, setNodeRef } = useDroppable({
    id: 'droppable',
  });

  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const setFlowContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      flowContainerRef.current = el;
      setNodeRef(el);
    },
    [setNodeRef]
  );

  // Open the add node menu near the top middle of the graph. The new node is
  // added where the menu opens, so it shows up in view.
  const openAddNodeMenu = useCallback(() => {
    const container = flowContainerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const real = {
      x: rect.left + rect.width / 2 - 100,
      y: rect.top + Math.min(rect.height / 4, 100),
    };
    // The menu is absolutely positioned, so place it relative to whatever
    // element it's positioned against
    const positioned =
      getComputedStyle(container).position !== 'static'
        ? container
        : container.offsetParent || container;
    const parentRect = positioned.getBoundingClientRect();
    setMenu(ContextMenuType.CONTEXT, {
      real,
      viewport: { x: real.x - parentRect.left, y: real.y - parentRect.top },
      projected: screenToFlowPosition(real),
    });
  }, [setMenu, screenToFlowPosition]);

  // Preview strips draw above the node with a negative margin (see
  // .withPreview), so react-flow's node bounds don't include them
  const topOverflow = useMemo(
    () =>
      graph.nodes.reduce<Record<string, number>>((acc, node) => {
        if (isPreviewableNode(node)) {
          acc[node.id] = PREVIEW_HEIGHT;
        }
        return acc;
      }, {}),
    [graph.nodes]
  );

  // Like react-flow's fitView(), but includes the preview strips
  const zoomToFit = useCallback(() => {
    const nodes = getNodes();
    if (!nodes.length) {
      return;
    }
    const bounds = nodes.reduce(
      (b, node) => ({
        minX: Math.min(b.minX, node.position.x),
        minY: Math.min(b.minY, node.position.y - (topOverflow[node.id] || 0)),
        maxX: Math.max(b.maxX, node.position.x + (node.measured?.width || 0)),
        maxY: Math.max(b.maxY, node.position.y + (node.measured?.height || 0)),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
    fitBounds(
      {
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      },
      { padding: 0.1, duration: 800 }
    );
  }, [getNodes, fitBounds, topOverflow]);

  // Animate nodes to their auto-layout positions, then save the positions to
  // the core graph and fit the result on screen
  const layoutAnimation = useRef<number>();
  const autoLayout = useCallback(() => {
    const handleOffset: HandleOffset = (nodeId, handleId, type) => {
      const handle = getInternalNode(nodeId)?.internals.handleBounds?.[
        type
      ]?.find((h) => h.id === handleId);
      return handle ? handle.y + handle.height / 2 : undefined;
    };
    const targets = layoutFlowNodes(
      flowNodes,
      flowEdges,
      handleOffset,
      topOverflow
    );
    const starts = new Map(flowNodes.map((n) => [n.id, n.position]));
    const DURATION = 500;
    const startTime = performance.now();

    if (layoutAnimation.current) {
      cancelAnimationFrame(layoutAnimation.current);
    }

    const step = (now: number) => {
      const t = Math.min((now - startTime) / DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setFlowNodes((nodes) =>
        nodes.map((node) => {
          const from = starts.get(node.id);
          const to = targets[node.id];
          if (!from || !to) {
            return node;
          }
          return {
            ...node,
            position: {
              x: from.x + (to.x - from.x) * ease,
              y: from.y + (to.y - from.y) * ease,
            },
          };
        })
      );

      if (t < 1) {
        layoutAnimation.current = requestAnimationFrame(step);
      } else {
        layoutAnimation.current = undefined;
        setGraph((graph) => ({
          ...graph,
          nodes: graph.nodes.map((node) =>
            targets[node.id] ? { ...node, position: targets[node.id] } : node
          ),
        }));
        // Wait a frame so react-flow has the final node positions
        requestAnimationFrame(zoomToFit);
      }
    };
    layoutAnimation.current = requestAnimationFrame(step);
  }, [
    flowNodes,
    flowEdges,
    topOverflow,
    getInternalNode,
    setFlowNodes,
    setGraph,
    zoomToFit,
  ]);

  const hasDeletableSelection = useMemo(
    () =>
      flowNodes.some((node) => node.selected && node.deletable !== false) ||
      flowEdges.some((edge) => edge.selected),
    [flowNodes, flowEdges]
  );

  // Same path as pressing the delete key, so onNodesDelete/onEdgesDelete fire
  const deleteSelected = useCallback(() => {
    deleteElements({
      nodes: flowNodes.filter((node) => node.selected),
      edges: flowEdges.filter((edge) => edge.selected),
    });
  }, [deleteElements, flowNodes, flowEdges]);

  return (
    <FlowEditorContext.Provider value={{ openNodeContextMenu }}>
      <div className={editorStyles.shrinkGrowRows}>
        <div className={styles.toolbar}>
          <button
            className={cx('formbutton tertiary', styles.toolbarButton)}
            onClick={(e) => {
              e.preventDefault();
              // The editor container hides the menu on any click outside it
              e.stopPropagation();
              openAddNodeMenu();
            }}
            title="Add Node (Shift+A)"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <button
            className={cx('formbutton tertiary', styles.toolbarButton)}
            onClick={(e) => {
              e.preventDefault();
              autoLayout();
            }}
            title="Auto Layout"
          >
            <FontAwesomeIcon icon={faSitemap} rotation={90} />
          </button>
          <button
            className={cx('formbutton tertiary', styles.toolbarButton)}
            onClick={(e) => {
              e.preventDefault();
              deleteSelected();
            }}
            disabled={!hasDeletableSelection}
            title="Delete Selected"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
          <button
            className={cx('formbutton tertiary', styles.toolbarButton)}
            onClick={(e) => {
              e.preventDefault();
              zoomToFit();
            }}
            title="Zoom to Fit"
          >
            <FontAwesomeIcon icon={faMaximize} />
          </button>
        </div>
        <div className={editorStyles.growShrinkRows}>
          <div
            onContextMenu={onContextMenu}
            className={styles.flowContainer}
            ref={setFlowContainerRef}
          >
            {menu?.menu === ContextMenuType.CONTEXT ? (
              <ContextMenu
                menu={addNodeMenuItems}
                position={menu.position.viewport}
                onItemHover={onContextItemHover}
                onSelect={onMenuAdd}
                onClose={onMenuClose}
              />
            ) : menu?.menu === ContextMenuType.NODE_CONTEXT ? (
              <ContextMenu
                title="Node Actions"
                menu={nodeContextMenu}
                position={menu.position.viewport}
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
                nodes={flowNodes}
                edges={flowEdges}
                onMoveEnd={onMoveEnd}
                onConnect={onConnect}
                onReconnect={onReconnect}
                onEdgesChange={onEdgesChange}
                onNodesChange={onNodesChangeIntercept}
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
                isValidConnection={isValidConnection}
              >
                <Background
                  variant={BackgroundVariant.Lines}
                  gap={25}
                  size={0.5}
                  color={isOver ? '#2a3d2c' : '#24272b'}
                />
              </ReactFlow>
            </FlowEventHack>
          </div>

          <div className={editorStyles.graphFooter}>
            <span className={styles.footerSecondary}>Engine: </span>
            {engine.name === 'playcanvas'
              ? 'PlayCanvas'
              : engine.name === 'three'
              ? 'Three.js'
              : engine.name === 'babylon'
              ? 'Babylon.js'
              : 'Wtf'}
            {compileResult?.compileMs ? (
              <>
                <span className={styles.divider}>|</span>
                <span className={styles.footerSecondary}>Compile time: </span>
                {compileResult?.compileMs}ms
              </>
            ) : null}
          </div>
        </div>
      </div>
    </FlowEditorContext.Provider>
  );
};

FlowEditor.displayName = 'FlowEditor';

export default FlowEditor;
