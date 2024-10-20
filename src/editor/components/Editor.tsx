import styles from '../styles/editor.module.css';
import debounce from 'lodash.debounce';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  useDndMonitor,
  MouseSensor,
  useSensor,
  useSensors,
  DragMoveEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import cx from 'classnames';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
} from 'react';

import {
  Node as XyFlowNode,
  Edge as XyFlowEdge,
  Connection,
  ReactFlowProvider,
  useUpdateNodeInternals,
  useReactFlow,
  XYPosition,
  OnSelectionChangeFunc,
  OnConnectStart,
  OnNodeDrag,
} from '@xyflow/react';

import { SplitPane } from '@andrewray/react-multi-split-pane';

import {
  findNode,
  EdgeLink,
  Graph,
  GraphNode,
  Edge,
  EdgeType,
  SourceNode,
  NodeInput,
  computeAllContexts,
  computeContextForNodes,
  isDataNode,
  makeEdge,
  resetGraphIds,
  isError,
  TextureNode,
  computeGrindex,
} from '@core/graph';

import FlowEditor, {
  MouseData,
  NodeContextActions,
  SHADERFROG_FLOW_EDGE_TYPE,
} from './flow/FlowEditor';

import { EngineContext } from '@core/engine';

import useThrottle from '../hooks/useThrottle';

import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import ConfigEditor from './ConfigEditor';

import { Hoisty } from '../hoistedRefContext';
import { ensure } from '../../util/ensure';

import { makeId } from '../../util/id';
import { hasParent } from '../../util/hasParent';
import { SMALL_SCREEN_WIDTH, useWindowSize } from '../hooks/useWindowSize';

import {
  FlowNode,
  FlowNodeSourceData,
  FlowNodeDataData,
  FlowElements,
  FlowEdgeOrLink,
} from './flow/flow-types';

import {
  toFlowInputs,
  setFlowNodeCategories,
  graphToFlowGraph,
  graphNodeToFlowNode,
  graphEdgeToFlowEdge,
  updateGraphNodeInput as updateGraphNodeInputInternal,
  updateFlowNodeInput as updateFlowInputInternal,
  updateFlowNodeData as updateFlowNodeDataInternal,
  addFlowEdge,
  addGraphEdge,
  updateGraphFromFlowGraph,
  updateFlowEdgeData,
  markInputsConnected,
} from './flow/flow-helpers';

import { usePrevious } from '../hooks/usePrevious';
import {
  compileGraphAsync,
  createGraphNode,
  expandUniformDataNodes,
} from './useGraph';
import { FlowGraphContext } from '@editor/editor/flowGraphContext';
import { findNodeAndData, findNodeTree } from './flow/graph-helpers';
import { isMacintosh } from '@editor/util/platform';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  AnySceneConfig,
  EditorProps,
  EngineProps,
  NODRAG_CLASS,
  NODROP_CLASS,
} from './editorTypes';
import EffectSearch from './EffectSearch';
import ShaderPreview from './ShaderPreview';
import TextureBrowser from './TextureBrowser';
import randomShaderName from '@editor/util/randomShaderName';
import { Shader } from '@editor/model/Shader';
import BottomModal from './BottomModal';
import {
  EDITOR_BOTTOM_PANEL,
  EditorProvider,
  useEditorRawStore,
  useEditorStore,
} from './flow/editor-store';
import Modal from './Modal';
import { xor } from '@shaderfrog/glsl-parser/parser/utils';
import GlslEditor from './GlslEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowsRotate,
  faCode,
  faDiagramProject,
  faMagnifyingGlass,
  faPencil,
} from '@fortawesome/free-solid-svg-icons';
import MetadataEditor from './MetadataEditor';
import ConvertShadertoy from './ConvertShadertoy';
import { truncate } from '@/util/string';
import indexById from '@/core/util/indexByid';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(editor)\x1b[0m', ...args);

const guessIfColorName = (name: string) =>
  /col|foreground|background/i.test(name);

const Editor = ({
  assetPrefix,
  saveErrors,
  onCloseSaveErrors,
  isOwnShader,
  isAuthenticated,
  onCreateShader,
  onUpdateShader,
  isDeleting,
  onDeleteShader,
  engine,
  menuItems,
  sceneComponent: SceneComponent,
  addEngineNode,
  currentUser,
}: EditorProps & EngineProps) => {
  /**
   * React-Flow to Graph data flow
   *
   * 1. We use the useNodes/EdgesState hooks to manually control the flow graph
   * 2. We use the onNodesChange to filter undeletable nodes
   * 3. Other flow node events fire, like onEdgesDelete to copy react-flow
   *    changes to the core graph
   * 4. For adding new connections, react-flow creates the connection, and
   *    the callback calls our addConnection() function, which updates the core
   *    graph, and then updates the flow graph. I'm pretty sure this undoes what
   *    react-flow does internally, because it calls setEdges()
   * 5. Some callbacks, like onNodesDelete, need additional side effects, like
   *    deleting all the upstream nodes and edges. In those callbacks, the
   *    changes are calculated, and applied to both core and react-flow graph.
   */
  const { screenToFlowPosition, getNode, setViewport } = useReactFlow();

  const {
    // ui state
    hideMenu,
    menu,
    bottomPanelType,
    openEditorBottomPanel,
    closeEditorBottomPanel,
    primarySelectedNodeId,
    setPrimarySelectedNodeId,
    addEditorTab,
    setSceneDimensions,
    setCompileInfo,
    sceneConfig,
    setSceneConfig,
    // Shader
    shader,
    // Graph
    graph,
    setGraph,
    updateGraphNode,
    updateGraphNodeInput,
    setNodeErrors,
    clearNodeErrors,
    engineContext,
    setEngineContext,
    // Flow graph
    flowNodes,
    flowEdges,
    setFlowNodes,
    setFlowEdges,
    updateFlowNodeData,
    updateAllFlowNodes,
    updateFlowNodeConfig,
    updateFlowInput,
    addSelectedNodes,
    onEdgesChange,
    compileResult,
    setCompileResult,
  } = useEditorStore();
  const rawStore = useEditorRawStore();

  const grindex = useMemo(() => computeGrindex(graph), [graph]);

  // The shader being dragged onto something to replace it
  const [draggedShader, setDraggedShader] = useState<Shader | null>(null);

  const [isShowingImport, setShowImport] = useState(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isLocal = window.location.href.indexOf('localhost') > 111;

  const [screenshotData, setScreenshotData] = useState<string>('');
  const takeScreenshotRef = useRef<() => Promise<string>>();
  const takeScreenshot = useCallback(async () => {
    if (!takeScreenshotRef.current) {
      return;
    }
    const data = await takeScreenshotRef.current();
    setScreenshotData(data);
  }, []);

  const updateNodeInternals = useUpdateNodeInternals();

  const primarySelectedNode = primarySelectedNodeId
    ? grindex.nodes[primarySelectedNodeId]
    : undefined;

  const sceneWrapRef = useRef<HTMLDivElement>(null);

  // tabIndex may still be needed to pause rendering
  const [isMetadataOpen, setMetadataOpen] = useState<boolean>(false);
  const [editorTabIndex, setEditorTabIndex] = useState<number>(0);
  const [smallScreenEditorTabIndex, setSmallScreenEditorTabIndex] =
    useState<number>(0);
  const [contexting, setContexting] = useState<boolean>(false);
  const [compiling, setCompiling] = useState<boolean>(false);
  const [guiError, setGuiError] = useState<string>('');

  const [replacingNode, setReplacingNode] = useState<FlowNode | null>(null);

  /**
   * Auto-screenshot logic
   *
   * This may need to change with screenshot logic like being able to set the
   * time and angle of screenshots. Also could bail here if there's an error?
   */
  useEffect(() => {
    const t = setTimeout(takeScreenshot, 500);
    return () => {
      window.clearTimeout(t);
    };
  }, [compileResult, takeScreenshot, sceneConfig]);

  // Convience flag for saying the compile result is dirty
  const [needsCompile, setNeedsCompile] = useState<boolean>(false);
  const debouncedSetNeedsCompile = useMemo(
    () => debounce(setNeedsCompile, 500),
    []
  );

  // Changing the environment map requires a shader re-compile!
  // const previousSceneConfig = usePrevious(sceneConfig);
  const setSceneConfigAndRecompile = useCallback(
    (newConfig: AnySceneConfig) => {
      setSceneConfig(newConfig);
      if (xor(newConfig.bg, sceneConfig?.bg)) {
        debouncedSetNeedsCompile(true);
      }
    },
    [sceneConfig, setSceneConfig, debouncedSetNeedsCompile]
  );

  // Compile function, meant to be called manually in places where we want to
  // trigger a compile. I tried making this a useEffect, however this function
  // needs to update "flowElements" at the end, which leads to an infinite loop
  const compile = useCallback(() => {
    const { flowNodes, flowEdges, graph, engineContext } = rawStore.getState();

    setContexting(false);
    setCompiling(true);

    log('Starting compileGraphAsync()!');
    compileGraphAsync(graph, engine, engineContext!)
      .then((result) => {
        if (isError(result)) {
          setNodeErrors(result.nodeId, result);
          updateFlowNodeData(result.nodeId, { glslError: true });
          return;
        }

        log(`Compile complete in ${result.compileMs} ms!`, {
          compileResult: result,
        });

        clearNodeErrors();
        setGuiError('');
        setCompileResult(result);

        const byId = indexById(graph.nodes);

        // Update the available inputs from the node after the compile
        const updatedFlowNodes = flowNodes.map((node) =>
          updateFlowNodeDataInternal(node, {
            ...node.data,
            glslError: false,
            inputs: toFlowInputs(byId[node.id]),
            active: result.compileResult.activeNodeIds.has(node.id),
          })
        );

        const { nodes, edges } = markInputsConnected(
          setFlowNodeCategories(
            {
              edges: flowEdges,
              nodes: updatedFlowNodes,
            },
            result.dataNodes
          )
        );
        setFlowNodes(nodes);
        setFlowEdges(edges);

        // This is a hack to make the edges update to their handles if they move
        // https://github.com/wbkd/react-flow/issues/2008
        setTimeout(() => {
          updatedFlowNodes.forEach((node) => updateNodeInternals(node.id));
        }, 500);
      })
      .catch((err) => {
        console.error('Error compiling!', err);
        setGuiError(err.message);
      })
      .finally(() => {
        setNeedsCompile(false);
        setCompiling(false);
        setContexting(false);
      });
  }, [
    updateNodeInternals,
    setFlowEdges,
    setFlowNodes,
    clearNodeErrors,
    setNodeErrors,
    updateFlowNodeData,
    engine,
    rawStore,
    setCompileResult,
  ]);

  /**
   * Convenience compilation effect. This lets other callbacks update the
   * graph or flowElements however they want, and then set needsCompliation
   * to true, without having to worry about all the possible combinations of
   * updates of the parameters to compile()
   */
  useEffect(() => {
    if (needsCompile && !compiling) {
      compile();
    }
  }, [compiling, needsCompile, compile]);

  const setGlResult = useCallback(
    (result: {
      fragError: string;
      vertError: string;
      programError: string;
    }) => {
      setCompileInfo(result);
    },
    [setCompileInfo]
  );

  // Computes and recompiles an entirely new graph
  const initializeGraph = useCallback(
    async (
      initialFlowElements: FlowElements,
      newCtx: EngineContext,
      graph: Graph
    ) => {
      setContexting(true);

      try {
        setEngineContext(newCtx);
        setFlowNodes(initialFlowElements.nodes);
        setFlowEdges(initialFlowElements.edges);

        const result = await computeAllContexts(newCtx, engine, graph);
        if (isError(result)) {
          setNodeErrors(result.nodeId, result);
          // setFlowNodes((nodes) =>
          //   updateFlowNodesData(nodes, result.nodeId, { glslError: true })
          // );
          updateFlowNodeData(result.nodeId, { glslError: true });

          setContexting(false);
          const { errors } = result;
          console.error('Error computing context!', errors);
          setGuiError(`Error computing context: ${errors[0]}`);
        } else {
          setEngineContext({
            ...newCtx,
            nodes: {
              ...newCtx.nodes,
              ...result,
            },
          });
        }

        log('Initializing flow nodes and compiling graph!', {
          graph,
          newCtx,
        });

        updateAllFlowNodes((node) =>
          updateFlowNodeDataInternal(node, { glslError: false })
        );

        clearNodeErrors();
        compile();
      } catch (error: any) {
        setContexting(false);
        console.error('Error computing context!', error);
        setGuiError(error.message);

        // Same comment as above
        setFlowNodes(initialFlowElements.nodes);
        setFlowEdges(initialFlowElements.edges);
      }
    },
    [
      compile,
      engine,
      setFlowNodes,
      setFlowEdges,
      setNodeErrors,
      clearNodeErrors,
      updateAllFlowNodes,
      updateFlowNodeData,
      setEngineContext,
    ]
  );

  // Once we receive a new engine context, re-initialize the graph. This method
  // is passed to engine specific editor components
  const setCtx = useCallback(
    (newCtx: EngineContext) => {
      const { engineContext } = rawStore.getState();

      if (newCtx.engine !== engineContext?.engine) {
        engineContext?.engine
          ? log('🔀 Changing engines!', { engineContext, newCtx })
          : log('🌟 Initializing engine!', newCtx, '(no old context)', {
              engineContext,
            });
        // setEngineContext(newCtx);
        let newGraph = graph;
        // Previous logic of switching between engines. Maybe will revisit
        // someday...

        // if (lastEngine) { newGraph = convertToEngine(lastEngine,
        // engine, graph);

        //   if (ctx?.engine) {
        //     const currentScene = getRefData(ctx.engine);
        //     if (currentScene) {
        //       // @ts-ignore
        //       currentScene.destroy(currentScene);
        //     }
        //   }
        // }
        log({ flow: graphToFlowGraph(newGraph), newCtx, newGraph });
        initializeGraph(graphToFlowGraph(newGraph), newCtx, newGraph);
        // This branch wasn't here before I started working on the bug where
        // switching away from the scene to the source code tab and back removed
        // the envmap and others. I want to try to cache the whole scene and
        // objects here to avoid re-creating anything. I'm also curious if this
        // causes any kind of infinite loupe
      } else {
        setEngineContext(newCtx);
      }
    },
    [setEngineContext, initializeGraph, graph, rawStore]
  );

  const onNodeValueChange = useCallback(
    (nodeId: string, value: any) => {
      if (!compileResult) {
        return;
      }

      updateFlowNodeData(nodeId, { value });
      updateGraphNode(nodeId, { value });

      // Only recompile if a non-data-node value changes
      if (!isDataNode(graph.nodes.find((n) => n.id === nodeId)!)) {
        debouncedSetNeedsCompile(true);
      }
    },
    [
      compileResult,
      debouncedSetNeedsCompile,
      updateGraphNode,
      updateFlowNodeData,
      graph.nodes,
    ]
  );

  const onInputBakedToggle = useCallback(
    (nodeId: string, inputId: string, baked: boolean) => {
      updateFlowInput(nodeId, inputId, { baked });
      updateGraphNodeInput(nodeId, inputId, { baked });
      debouncedSetNeedsCompile(true);
    },
    [updateGraphNodeInput, updateFlowInput, debouncedSetNeedsCompile]
  );

  /**
   * Split pane mgmt
   */
  const windowSize = useWindowSize();
  const isSmallScreen = windowSize.width < SMALL_SCREEN_WIDTH;

  const [defaultMainSplitSize, setDefaultMainSplitSize] = useState<
    number[] | undefined
  >();

  useLayoutEffect(() => {
    const width = window.innerWidth;
    if (!isSmallScreen) {
      const DEFAULT_SPLIT_PERCENT = 30;
      const sizes = [
        0.1 * (100 - DEFAULT_SPLIT_PERCENT) * width,
        0.1 * DEFAULT_SPLIT_PERCENT * width,
      ];
      setDefaultMainSplitSize(sizes);
    }
  }, [isSmallScreen]);

  const syncSceneSize = useThrottle(() => {
    if (sceneWrapRef.current) {
      const { width, height } = sceneWrapRef.current.getBoundingClientRect();
      setSceneDimensions({ width: width, height: height });
    }
  }, 100);

  useEffect(() => {
    const listener = () => syncSceneSize();
    window.addEventListener('resize', listener);
    return () => {
      window.removeEventListener('resize', listener);
    };
  }, [syncSceneSize]);

  useEffect(() => syncSceneSize(), [defaultMainSplitSize, syncSceneSize]);

  /**
   * React flow
   */

  const addConnection = useCallback(
    (newEdge: XyFlowEdge | Connection) => {
      const newEdgeId = makeId();
      const sourceId = ensure(newEdge.source);
      const targetId = ensure(newEdge.target);
      const targetHandleId = ensure(newEdge.targetHandle);
      const sourceHandleId = ensure(newEdge.sourceHandle);

      // Duplicated by the flow graph update after this
      setGraph((graph) => {
        const targetGraphNode = findNode(graph, targetId);
        const input = ensure(
          targetGraphNode.inputs.find((i) => i.id === targetHandleId)
        );
        const sourceGraphNode = findNode(graph, sourceId);

        // Icky business logic here...
        const type: EdgeType | undefined =
          (sourceGraphNode as SourceNode).stage ||
          sourceGraphNode.outputs?.[0]?.dataType;
        const isCode = sourceGraphNode.type === 'source';

        const addedEdge: Edge = {
          id: newEdgeId,
          from: sourceId,
          to: targetId,
          output: sourceHandleId,
          input: targetHandleId,
          type,
        };

        const updatedGraph = addGraphEdge(graph, addedEdge);

        return {
          ...updatedGraph,
          nodes: updatedGraph.nodes.map((node) =>
            node.id === targetId
              ? updateGraphNodeInputInternal(
                  node,
                  targetHandleId,
                  // Here's the "auto-baking"
                  input.bakeable
                    ? {
                        baked: isCode,
                      }
                    : {}
                )
              : node
          ),
        };
      });

      // Duplicates above core graph logic. Another option is to map the result
      // of these operations into the core graph, but that would require making
      // both graphs dependencies of this usecallback hook, which could be a lot
      // of extra renders
      const sourceFlowNode = ensure(getNode(newEdge.source!));

      // More icky business logic here...
      const edgeType = (sourceFlowNode.data as FlowNodeDataData).dataType;
      const type: EdgeType | undefined =
        (sourceFlowNode.data as FlowNodeSourceData).stage || edgeType;
      const isCode = sourceFlowNode.type === 'source';

      const addedEdge: FlowEdgeOrLink = {
        ...newEdge,
        id: newEdgeId,
        source: sourceId,
        target: targetId,
        data: { type },
        className: cx(type, edgeType),
        type: SHADERFROG_FLOW_EDGE_TYPE,
      };

      const { nodes, edges } = addFlowEdge(
        { nodes: flowNodes, edges: flowEdges },
        addedEdge
      );
      const nodesWithInput = nodes.map((node) =>
        node.id === sourceId
          ? updateFlowInputInternal(node, targetHandleId, { baked: isCode })
          : node
      );

      // React-flow updates the edges, calls the onEdgeUpdate callback, which
      // calls this function, which then again updates the edges. I *think* this
      // will override what react-flow is doing, maye causing double work. It
      // might be better to move this logic into onEdgesChange, like how
      // onNodesChange blocks the output nodes from being deleted, since this is
      // specific interception logic on top of adding a new graph edge.
      setFlowNodes(nodesWithInput);
      setFlowEdges(edges);

      setNeedsCompile(true);
    },
    // This nonsense function uses setGraph with an updater, but takes in
    // flowEdges and flowNdoes as a dependency
    [getNode, setFlowNodes, setFlowEdges, flowNodes, flowEdges, setGraph]
  );

  // This is the Flow callback that calls our custom connection handler when a
  // new edge is dragged between inputs/outputs
  const onConnect = useCallback(
    (edge: XyFlowEdge | Connection) => addConnection(edge),
    [addConnection]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: XyFlowEdge, newConnection: Connection) => {
      edgeUpdateSuccessful.current = true;
      addConnection(newConnection);
    },
    [addConnection]
  );

  const openNodeEditor = useCallback(
    (nodeId: string) => {
      const active = graph.nodes.find((n) => n.id === nodeId) as SourceNode;
      addEditorTab(active.id, 'code');
      addSelectedNodes([active.id]);

      setEditorTabIndex(1);
    },
    [addSelectedNodes, graph, addEditorTab]
  );

  const onNodeDoubleClick = useCallback(
    (event, flowNode: XyFlowNode) => {
      const node = graph.nodes.find((n) => n.id === flowNode.id) as SourceNode;

      addSelectedNodes([node.id]);
      setPrimarySelectedNodeId(node.id);

      if (isDataNode(node)) {
        openEditorBottomPanel(EDITOR_BOTTOM_PANEL.NODE_CONFIG_EDITOR);
      } else if (node.type === 'source') {
        addEditorTab(node.id, 'code');
        setEditorTabIndex(1);
      }
    },
    [
      addSelectedNodes,
      graph.nodes,
      openEditorBottomPanel,
      setPrimarySelectedNodeId,
      addEditorTab,
    ]
  );

  const onSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes }) => {
      const flowNode = nodes?.[0];
      const node = grindex.nodes[flowNode?.id];
      if (node) {
        setPrimarySelectedNodeId(node.id);
      } else {
        setPrimarySelectedNodeId(undefined);
      }
    },
    [setPrimarySelectedNodeId, grindex]
  );

  const setValidHandleTargets = useCallback(
    (nodeId: string, handleType: string) => {
      setFlowNodes((nodes) => {
        const source = graph.nodes.find(({ id }) => id === nodeId) as GraphNode;
        return nodes.map((n) => {
          const node = n as FlowNode;
          if (
            // Can't connect to yourself - you'll go blind
            node.id === source.id ||
            // Stages can only connect to the same stage if present
            ('stage' in source &&
              'stage' in node.data &&
              source.stage !== node.data.stage)
          ) {
            return node;
          }
          return updateFlowNodeDataInternal(node, {
            inputs: node.data.inputs.map((input) => ({
              ...input,
              validTarget: handleType === 'source',
            })),
            outputs: node.data.outputs.map((output) => ({
              ...output,
              validTarget: handleType === 'target',
            })),
          });
        });
      });
    },
    [setFlowNodes, graph]
  );

  const resetTargets = useCallback(() => {
    setFlowNodes((nodes) =>
      (nodes as FlowNode[]).map((node) =>
        updateFlowNodeDataInternal(node, {
          inputs: node.data.inputs.map((input) => ({
            ...input,
            validTarget: false,
          })),
          outputs: node.data.outputs.map((output) => ({
            ...output,
            validTarget: false,
          })),
        })
      )
    );
  }, [setFlowNodes]);

  // Used for deleting edge on drag off
  const edgeUpdateSuccessful = useRef(true);

  const onReconnectStart = useCallback(
    (event: any, edge: any) => {
      edgeUpdateSuccessful.current = false;

      const g = event.target.parentElement;
      const handleType =
        [...g.parentElement.children].indexOf(g) === 3 ? 'source' : 'target';
      const nodeId = handleType === 'source' ? edge.source : edge.target;
      setValidHandleTargets(nodeId, handleType);
    },
    [setValidHandleTargets]
  );

  const createNodeOnDragRef = useRef<{
    node: GraphNode;
    input: NodeInput;
  } | null>();

  /**
   * Called when dragging from any handle, input and output
   */
  const onConnectStart = useCallback<OnConnectStart>(
    (_, params) => {
      const { nodeId, handleType, handleId } = params;
      if (!nodeId || !handleType) {
        return;
      }
      const node = ensure(graph.nodes.find((n) => n.id === nodeId));

      if (handleType !== 'source') {
        createNodeOnDragRef.current = {
          node,
          input: ensure(node.inputs.find((i) => i.id === handleId)),
        };
      }
      setValidHandleTargets(nodeId, handleType);
    },
    [graph, setValidHandleTargets]
  );

  /**
   * Called after edge drag finishes, for succssful and unsuccessfull connections
   */
  const onReconnectEnd = useCallback(
    (_, edge) => {
      resetTargets();

      // Delete edge dragged off node
      // From https://reactflow.dev/examples/edges/delete-edge-on-drop
      if (!edgeUpdateSuccessful.current) {
        const { nodes, edges } = markInputsConnected({
          nodes: flowNodes,
          edges: flowEdges.filter((e) => e.id !== edge.id),
        });
        setFlowNodes(nodes);
        setFlowEdges(edges);
      }
      edgeUpdateSuccessful.current = true;
    },
    [resetTargets, setFlowNodes, setFlowEdges, flowNodes, flowEdges]
  );

  const addNodeAtPosition = useCallback(
    async (
      graph: Graph,
      nodeDataType: string,
      name: string,
      position: XYPosition,
      newEdgeData?: Omit<Edge, 'id' | 'from'>,
      defaultValue?: any
    ) => {
      setContexting(true);

      let originalNodes: Set<string> | undefined;
      let expanded: Graph | undefined;

      if (addEngineNode) {
        [originalNodes, expanded] =
          addEngineNode(
            nodeDataType,
            name,
            position,
            newEdgeData,
            defaultValue
          ) || [];
      }

      if (!originalNodes || !expanded) {
        // Expand uniforms on new nodes automatically
        [originalNodes, expanded] = createGraphNode(
          nodeDataType,
          name,
          position,
          engine,
          newEdgeData,
          defaultValue
        );
      }

      setFlowEdges((edges) => [
        ...edges,
        ...expanded!.edges.map(graphEdgeToFlowEdge),
      ]);

      setFlowNodes((nodes) => [
        ...nodes,
        ...expanded!.nodes.map((newGn, index) =>
          graphNodeToFlowNode(
            newGn,
            // We only want to position the originally created nodes, to
            // separate vertex/fragment. The auto-expanded uniforms get placed
            // by the expand fn
            originalNodes!.has(newGn.id)
              ? {
                  x: position.x + index * 20,
                  y: position.y + index * 40,
                }
              : newGn.position
          )
        ),
      ]);

      const updatedGraph = {
        ...graph,
        edges: [...graph.edges, ...expanded!.edges],
        nodes: [...graph.nodes, ...expanded!.nodes],
      };
      // Create new inputs for new nodes added to the graph
      const nodesToRefresh = [
        ...expanded!.nodes,
        ...(newEdgeData ? [findNode(updatedGraph, newEdgeData.to)] : []),
      ];
      log('Computing context for new nodes to generate their inputs...', {
        'New Nodes': nodesToRefresh,
      });

      const newNodeContext = await computeContextForNodes(
        engineContext!,
        engine,
        updatedGraph,
        nodesToRefresh
      );
      if (!isError(newNodeContext)) {
        setEngineContext({
          ...engineContext!,
          nodes: {
            ...engineContext!.nodes,
            ...newNodeContext,
          },
        });
      }
      setGraph(updatedGraph);
      debouncedSetNeedsCompile(true);
    },
    [
      addEngineNode,
      debouncedSetNeedsCompile,
      engine,
      engineContext,
      setFlowEdges,
      setFlowNodes,
      setGraph,
      setEngineContext,
    ]
  );

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnectEnd = useCallback(
    (event) => {
      resetTargets();
      // Make sure we only drop over the grid, not over a node
      const targetIsPane = event.target.classList.contains('react-flow__pane');

      if (
        targetIsPane &&
        reactFlowWrapper.current &&
        createNodeOnDragRef.current
      ) {
        // Remove the wrapper bounds to get the correct position
        const { node, input } = createNodeOnDragRef.current;

        let type: EdgeType | undefined = input.dataType;
        if (!type) {
          log('Could not resolve dragged edge type for', input);
          return;
        }

        // Find the default value for this property, if any
        const fromNode = graph.nodes.find((n) => n.id === node.id);
        let defaultValue;
        if (fromNode && 'config' in fromNode && input.property) {
          const properties = fromNode.config?.properties || [];
          defaultValue = properties.find(
            (p) => p.property === input.property
          )?.defaultValue;
        }

        let guessedType = type;
        if (guessIfColorName(input.displayName)) {
          if (input.dataType === 'vector3') {
            guessedType = 'rgb';
          } else if (input.dataType === 'vector4') {
            guessedType = 'rgba';
          }
        }

        addNodeAtPosition(
          graph,
          guessedType,
          input.displayName,
          screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          } as XYPosition),
          {
            to: node.id,
            // This needs to line up with the weird naming convention in data-nodes.ts output
            output: '1',
            input: input.id,
            type: guessedType,
          },
          defaultValue
        );
      }

      // Clear the connection info on drag stop
      createNodeOnDragRef.current = null;
    },
    [graph, screenToFlowPosition, addNodeAtPosition, resetTargets]
  );

  /**
   * Copy node positions from the flow graph into the domain graph on node move
   */
  const onNodeDragStop: OnNodeDrag = (event, node, nodes) => {
    updateGraphNode(node.id, { position: node.position });
  };

  /**
   * When selecting a group to replace the current node with
   */
  const onSelectGroup = (
    nodeToReplace: GraphNode | undefined,
    shader: Shader
  ) => {
    // For now can only replace the currently selected node
    if (!nodeToReplace || nodeToReplace.type === 'output') {
      log('Not replacing activeNode', nodeToReplace);
      return;
    } else {
      log('Replacing', nodeToReplace);
    }

    const {
      edgeIds: edgesToRemoveById,
      nodeIds: nodesToRemoveIds,
      edgeToVertexOutput,
      linkedFragmentNode,
      linkedVertexNode,
    } = findNodeTree(graph, nodeToReplace);

    // TODO: Gotta figure out how to do this in the context of groups

    const activeNodeIds = new Set([linkedFragmentNode.id]);

    // TODO: This is not actually guaranteed to be a fragment, user could select
    // vertex node to replace
    const currentFragFromEdge = graph.edges.find(
      (edge) => edge.from === linkedFragmentNode.id
    );
    const currentToFragNode = graph.nodes.find(
      (node) => node.id === currentFragFromEdge?.to
    );

    // We want to replace the current output vertex edge with the incoming one,
    // if present. In the case where there's a single linked vertex node (the
    // second branch below), we can rely on the edge coming out of that. If
    // the current tree has a lot of fragment and vertex nodes, and there's an
    // edge that plugs into the *output* node (the first case), use that.
    const currentVertFromEdge =
      edgeToVertexOutput ||
      graph.edges.find(
        (edge) =>
          // Don't find the link, rather find the output. Link is removed later
          edge.type !== EdgeLink.NEXT_STAGE &&
          edge.from === linkedVertexNode?.id
      );
    const currentToVertNode = graph.nodes.find(
      (node) => node.id === currentVertFromEdge?.to
    );

    // TODO: Guessing for how nodes are parented to a group, and remove those
    // instead of all the inputs to a node
    // activeNode.parentId ?
    //     graph.nodes.find((n) => n.id === activeNode.parentId)

    // Figure out some shit from the incoming graph
    const { graph: originalIncomingGraph } = shader.config;

    const incomingGraph = resetGraphIds(originalIncomingGraph);

    const incomingOutputFrag = incomingGraph.nodes.find(
      (node) => node.type === 'output' && node.stage === 'fragment'
    );
    const incomingOutFragEdge = incomingGraph.edges.find(
      (edge) => edge.to === incomingOutputFrag?.id
    );
    const incomingOutFragNode = incomingGraph.nodes.find(
      (n) => n.id === incomingOutFragEdge?.from
    );
    const incomingFragOutput = incomingOutFragNode?.outputs?.[0];

    const incomingOutputVert = incomingGraph.nodes.find(
      (node) => node.type === 'output' && node.stage === 'vertex'
    );
    const incomingOutVertEdge = incomingGraph.edges.find(
      (edge) => edge.to === incomingOutputVert?.id
    );
    const incomingOutVertNode = incomingGraph.nodes.find(
      (n) => n.id === incomingOutVertEdge?.from
    );
    const incomingVertOutput = incomingOutVertNode?.outputs?.[0];

    // Determine the amount we need to shift the incoming graph
    const delta: XYPosition = incomingOutFragNode
      ? {
          x: incomingOutFragNode.position.x - linkedFragmentNode.position.x,
          y: incomingOutFragNode.position.y - linkedFragmentNode.position.y,
        }
      : { x: 0, y: 0 };

    const groupId = makeId();
    const filteredIncomingGraph: Graph = {
      nodes: incomingGraph.nodes
        // remove the output nodes from the incoming graph
        .filter(
          (n) =>
            n.id !== incomingOutputFrag?.id && n.id !== incomingOutputVert?.id
        )
        // and give all nodes the parent group id
        .map((n) => ({
          ...n,
          position: {
            x: n.position.x - delta.x,
            y: n.position.y - delta.y,
          },
          parentId: groupId,
        })),
      // remove any edges to the output nodes
      edges: incomingGraph.edges.filter(
        (e) =>
          e.to !== incomingOutputFrag?.id && e.to !== incomingOutputVert?.id
      ),
    };

    // Connect our incoming graph's output contract node with our current
    // graph's active toNode input
    const newFragOutEdge =
      incomingOutFragNode &&
      incomingFragOutput &&
      currentFragFromEdge &&
      currentToFragNode
        ? makeEdge(
            // id, from, to, output, input, type
            makeId(),
            incomingOutFragNode.id,
            currentToFragNode.id,
            incomingFragOutput.id,
            currentFragFromEdge.input,
            // See TODO in edge. These should be seprate fields on the edge
            (incomingOutFragNode as SourceNode).stage ||
              incomingOutFragNode.outputs?.[0]?.dataType
          )
        : null;
    const newVertOutEdge =
      incomingOutVertNode &&
      incomingVertOutput &&
      currentVertFromEdge &&
      currentToVertNode
        ? makeEdge(
            // id, from, to, output, input, type
            makeId(),
            incomingOutVertNode.id,
            currentToVertNode.id,
            incomingVertOutput.id,
            currentVertFromEdge.input,
            // See TODO in edge. These should be seprate fields on the edge
            (incomingOutVertNode as SourceNode).stage ||
              incomingOutVertNode.outputs?.[0]?.dataType
          )
        : null;

    const newGraph: Graph = {
      nodes: [
        ...graph.nodes.filter(
          (node) =>
            // Remove the currently selected node, which we're replacing
            !activeNodeIds.has(node.id) &&
            // And its friends
            !nodesToRemoveIds.has(node.id) &&
            // And its next stage node if present
            node.id !== linkedVertexNode?.id
        ),
        ...filteredIncomingGraph.nodes,
      ],
      // And remove all their edges
      edges: [
        ...graph.edges.filter(
          (edge) =>
            edge.id !== currentFragFromEdge?.id &&
            edge.id !== currentVertFromEdge?.id &&
            !edgesToRemoveById.has(edge.id)
        ),
        // And add in the incoming edges
        ...filteredIncomingGraph.edges,
        // Add the contract connector
        ...(newFragOutEdge ? [newFragOutEdge] : []),
        ...(newVertOutEdge ? [newVertOutEdge] : []),
      ],
    };

    const newFlowGraph = graphToFlowGraph(newGraph);

    setFlowNodes(newFlowGraph.nodes);
    setFlowEdges(newFlowGraph.edges);
    setGraph(newGraph);

    if (incomingOutFragNode) {
      setPrimarySelectedNodeId(incomingOutFragNode.id);

      // Flakey: Select the node visually in the graph. Don't know why flakey
      // so added timeout
      setTimeout(() => {
        addSelectedNodes([incomingOutFragNode.id]);
      }, 100);
    }
    debouncedSetNeedsCompile(true);
  };

  const mouseRef = useRef<MouseData>({
    real: { x: 0, y: 0 },
    viewport: { x: 0, y: 0 },
    projected: { x: 0, y: 0 },
  });

  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (reactFlowWrapper.current) {
        const { top, left } = reactFlowWrapper.current.getBoundingClientRect();
        mouseRef.current.real = {
          x: event.clientX,
          y: event.clientY,
        };
        mouseRef.current.viewport = {
          x: event.clientX - left,
          y: event.clientY - top,
        };
        mouseRef.current.projected = screenToFlowPosition(
          mouseRef.current.real
        );
      }
    },
    [screenToFlowPosition]
  );

  const onMenuAdd = useCallback(
    (type: string) => {
      const pos = screenToFlowPosition(menu?.position as XYPosition);
      addNodeAtPosition(graph, type, '', pos);
      hideMenu();
    },
    [graph, addNodeAtPosition, screenToFlowPosition, hideMenu, menu]
  );

  const previousMenu = usePrevious(menu);
  useEffect(() => {
    if (!menu && previousMenu) {
      updateAllFlowNodes((node) =>
        updateFlowNodeDataInternal(node, { ghost: false })
      );
      setFlowEdges((edges) =>
        edges.map((edge) => updateFlowEdgeData(edge, { ghost: false }))
      );
    }
  }, [setFlowNodes, setFlowEdges, previousMenu, menu, updateAllFlowNodes]);

  const onNodeContextSelect = useCallback(
    (nodeId: string, type: string) => {
      const currentNode = graph.nodes.find(
        (n) => n.id === nodeId
      ) as SourceNode;
      if (type === NodeContextActions.EDIT_SOURCE) {
        addSelectedNodes([currentNode.id]);
        setPrimarySelectedNodeId(currentNode.id);

        if (isDataNode(currentNode)) {
          openEditorBottomPanel(EDITOR_BOTTOM_PANEL.NODE_CONFIG_EDITOR);
        } else {
          addEditorTab(currentNode.id, 'code');
          setEditorTabIndex(1);
        }
      } else if (type === NodeContextActions.EDIT_CONFIG) {
        addSelectedNodes([currentNode.id]);
        setPrimarySelectedNodeId(currentNode.id);

        addEditorTab(currentNode.id, 'config');
        setEditorTabIndex(1);
      } else if (type === NodeContextActions.DELETE_NODE_ONLY) {
        setFlowNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
        setFlowEdges((edges) =>
          edges.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId
          )
        );
        setGraph((graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => node.id !== nodeId),
          edges: graph.edges.filter(
            (edge) => edge.to !== nodeId && edge.from !== nodeId
          ),
        }));
        debouncedSetNeedsCompile(true);
      } else if (type === NodeContextActions.DELETE_FULL_NODE_TREE) {
        const { edgeIds, nodeIds } = findNodeTree(graph, currentNode);
        setFlowNodes((nodes) => nodes.filter((node) => !nodeIds.has(node.id)));
        setFlowEdges((edges) => edges.filter((edge) => !edgeIds.has(edge.id)));
        setGraph((graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => !nodeIds.has(node.id)),
          edges: graph.edges.filter((edge) => !edgeIds.has(edge.id)),
        }));
        debouncedSetNeedsCompile(true);
      } else if (type === NodeContextActions.DELETE_NODE_AND_DEPENDENCIES) {
        const { edgeIds, nodeIds } = findNodeAndData(graph, currentNode);
        setFlowNodes((nodes) => nodes.filter((node) => !nodeIds.has(node.id)));
        setFlowEdges((edges) => edges.filter((edge) => !edgeIds.has(edge.id)));
        setGraph((graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => !nodeIds.has(node.id)),
          edges: graph.edges.filter((edge) => !edgeIds.has(edge.id)),
        }));
        debouncedSetNeedsCompile(true);
      }
      hideMenu();
    },
    [
      graph,
      setGraph,
      setFlowEdges,
      setFlowNodes,
      addSelectedNodes,
      setEditorTabIndex,
      hideMenu,
      debouncedSetNeedsCompile,
      openEditorBottomPanel,
      setPrimarySelectedNodeId,
      addEditorTab,
    ]
  );

  const onNodeContextHover = useCallback(
    (nodeId: string, type: string) => {
      if (compiling) {
        return;
      }
      const currentNode = graph.nodes.find(
        (n) => n.id === nodeId
      ) as SourceNode;
      if (type === NodeContextActions.DELETE_NODE_ONLY) {
        updateAllFlowNodes((node) =>
          updateFlowNodeDataInternal(node, { ghost: node.id === nodeId })
        );
        setFlowEdges((edges) =>
          edges.map((edge) =>
            updateFlowEdgeData(edge, {
              ghost: edge.source === nodeId || edge.target === nodeId,
            })
          )
        );
      } else if (type === NodeContextActions.DELETE_FULL_NODE_TREE) {
        const { edgeIds, nodeIds } = findNodeTree(graph, currentNode);
        setFlowNodes((nodes) =>
          nodes.map((node) =>
            updateFlowNodeDataInternal(node, { ghost: nodeIds.has(node.id) })
          )
        );
        setFlowEdges((edges) =>
          edges.map((edge) =>
            updateFlowEdgeData(edge, { ghost: edgeIds.has(edge.id) })
          )
        );
      } else if (type === NodeContextActions.DELETE_NODE_AND_DEPENDENCIES) {
        const { edgeIds, nodeIds } = findNodeAndData(graph, currentNode);
        setFlowNodes((nodes) =>
          nodes.map((node) =>
            updateFlowNodeDataInternal(node, { ghost: nodeIds.has(node.id) })
          )
        );
        setFlowEdges((edges) =>
          edges.map((edge) =>
            updateFlowEdgeData(edge, { ghost: edgeIds.has(edge.id) })
          )
        );
      } else {
        setFlowNodes((nodes) =>
          nodes.map((node) =>
            updateFlowNodeDataInternal(node, { ghost: false })
          )
        );
        setFlowEdges((edges) =>
          edges.map((edge) => updateFlowEdgeData(edge, { ghost: false }))
        );
      }
    },
    [compiling, graph, setFlowNodes, setFlowEdges, updateAllFlowNodes]
  );

  const onContainerClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (
        !hasParent(event.target as HTMLElement, '#x-context-menu, .nodeConfig')
      ) {
        hideMenu();
      }
    },
    [hideMenu]
  );

  // Callback to inform of which edges were deleted. This does NOT need to
  // modify react flow nodes
  const onEdgesDelete = useCallback(
    (edges: XyFlowEdge[]) => {
      const ids = new Set(edges.map((e) => e.id));
      setGraph((graph) => ({
        ...graph,
        edges: graph.edges.filter((edge) => !ids.has(edge.id)),
      }));
      setNeedsCompile(true);
    },
    [setGraph]
  );

  // Note if an edge is connected to this node, onEdgesDelete fires to update
  // edges in the flow and core graph. This does NOT need to modify flow nodes,
  // this
  const onNodesDelete = useCallback(
    (nodes: XyFlowNode[]) => {
      const graphNode = graph.nodes.find(
        (node) => node.id === nodes[0].id
      ) as GraphNode;

      const { edgeIds: edgesToRemoveIds, nodeIds: nodesToRemoveIds } =
        findNodeTree(graph, graphNode);

      // Update the flow graph to delete extra nodes and edges, since this
      // callback is only for a single node.
      setFlowNodes((nodes) =>
        nodes.filter((node) => !nodesToRemoveIds.has(node.id))
      );
      setFlowEdges((edges) =>
        edges.filter((edge) => !edgesToRemoveIds.has(edge.id))
      );

      setGraph((graph) => ({
        ...graph,
        nodes: graph.nodes.filter((node) => !nodesToRemoveIds.has(node.id)),
        edges: graph.edges.filter((edge) => !edgesToRemoveIds.has(edge.id)),
      }));
    },
    [graph, setGraph, setFlowEdges, setFlowNodes]
  );

  const getClosestNodeToPosition = useCallback(
    (xy: XYPosition) => {
      const MIN_DISTANCE = 150;

      const closestNode = flowNodes.reduce<{
        distance: number;
        node: FlowNode | null;
      }>(
        (res, n) => {
          const dx = n.position!.x + (n.measured?.width || 1) / 2 - xy.x;
          const dy = n.position!.y + (n.measured?.height || 1) / 2 - xy.y;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < res.distance && d < MIN_DISTANCE) {
            res.distance = d;
            res.node = n;
          }

          return res;
        },
        {
          distance: Number.MAX_VALUE,
          node: null,
        }
      );

      return closestNode.node;
    },
    [flowNodes]
  );

  const onDragStart = (event: DragStartEvent) => {
    if (
      hasParent(
        event.active.data?.current?.target as HTMLDivElement,
        `.${NODRAG_CLASS}`
      )
    ) {
      return;
    }
    if (event.active.data?.current?.shader) {
      const shader = event.active.data.current!.shader as Shader;
      setDraggedShader(shader);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (
      hasParent(
        event.activatorEvent.target as HTMLDivElement,
        `.${NODRAG_CLASS}`
      )
    ) {
      return;
    }
    setDraggedShader(null);
    setReplacingNode(null);
    updateAllFlowNodes((node) =>
      updateFlowNodeDataInternal(node, { ghost: false })
    );
    if (!event.over) {
      return;
    }

    if (replacingNode && draggedShader) {
      onSelectGroup(
        graph.nodes.find((n) => n.id === replacingNode.id),
        draggedShader
      );
    } else if (draggedShader) {
      // Figure out some shit from the incoming graph
      const { graph: originalIncomingGraph } = draggedShader.config;

      const incomingGraph = resetGraphIds(originalIncomingGraph);

      const incomingOutputFrag = incomingGraph.nodes.find(
        (node) => node.type === 'output' && node.stage === 'fragment'
      );
      const incomingOutFragEdge = incomingGraph.edges.find(
        (edge) => edge.to === incomingOutputFrag?.id
      );
      const incomingOutFragNode = incomingGraph.nodes.find(
        (n) => n.id === incomingOutFragEdge?.from
      );

      const incomingOutputVert = incomingGraph.nodes.find(
        (node) => node.type === 'output' && node.stage === 'vertex'
      );

      // Determine the amount we need to shift the incoming graph
      const delta: XYPosition = incomingOutFragNode
        ? {
            x: incomingOutFragNode.position.x - mouseRef.current.projected.x,
            y: incomingOutFragNode.position.y - mouseRef.current.projected.y,
          }
        : { x: 0, y: 0 };

      const groupId = makeId();
      const filteredIncomingGraph: Graph = {
        nodes: incomingGraph.nodes
          // remove the output nodes from the incoming graph
          .filter(
            (n) =>
              n.id !== incomingOutputFrag?.id && n.id !== incomingOutputVert?.id
          )
          // and give all nodes the parent group id
          .map((n) => ({
            ...n,
            position: {
              x: n.position.x - delta.x,
              y: n.position.y - delta.y,
            },
            parentId: groupId,
          })),
        // remove any edges to the output nodes
        edges: incomingGraph.edges.filter(
          (e) =>
            e.to !== incomingOutputFrag?.id && e.to !== incomingOutputVert?.id
        ),
      };

      const newGraph: Graph = {
        nodes: [...graph.nodes, ...filteredIncomingGraph.nodes],
        edges: [
          ...graph.edges,
          // And add in the incoming edges
          ...filteredIncomingGraph.edges,
        ],
      };

      const newFlowGraph = graphToFlowGraph(newGraph);

      setFlowNodes(newFlowGraph.nodes);
      setFlowEdges(newFlowGraph.edges);
      setGraph(newGraph);

      debouncedSetNeedsCompile(true);
    }
  };

  const onDragMove = (event: DragMoveEvent) => {
    if (
      hasParent(
        event.activatorEvent.target as HTMLDivElement,
        `.${NODRAG_CLASS}`
      )
    ) {
      return;
    }
    if (mouseRef.current) {
      const closestNodeId = getClosestNodeToPosition(
        mouseRef.current.projected
      )?.id;

      setFlowNodes((nodes) =>
        nodes.map((node) =>
          updateFlowNodeDataInternal(node, {
            ghost: closestNodeId === node.id,
          })
        )
      );
      const closestNode = flowNodes.find((n) => n.id === closestNodeId);
      if (closestNode) {
        setReplacingNode(closestNode);
      }
    }
  };

  useDndMonitor({
    onDragMove,
    onDragStart,
    onDragEnd,
  });

  const saveOrFork = useCallback(
    async (btnFork = false) => {
      if (!onUpdateShader && !onCreateShader) {
        return;
      }
      setIsSaving(true);
      // TODO: These values like engine and bg all have their own state, vs
      // setShader() copies all those values
      const payload = {
        // TODO CONVERT OR THROW
        engine: engine.name as 'three',
        name: shader.name,
        tags: [],
        description: shader.description,
        visibility: shader.visibility || 1,
        imageData: screenshotData,
        config: {
          graph: updateGraphFromFlowGraph(graph, {
            nodes: flowNodes,
            edges: flowEdges,
          }),
          scene: sceneConfig,
        },
      };

      if (shader.id && onUpdateShader && isOwnShader && !btnFork) {
        await onUpdateShader({
          id: shader.id,
          ...payload,
        });
      } else if (onCreateShader) {
        await onCreateShader(payload);
      }
      log('saved');

      setIsSaving(false);
    },
    [
      shader,
      engine,

      flowEdges,
      flowNodes,
      graph,
      isOwnShader,
      onCreateShader,
      onUpdateShader,
      sceneConfig,
      screenshotData,
    ]
  );

  useEffect(() => {
    if (isSmallScreen) {
      syncSceneSize();
    }
  }, [isSmallScreen, syncSceneSize]);

  useHotkeys(isMacintosh() ? `cmd+'` : `ctrl+'`, () => {
    compile();
  });

  useHotkeys(
    'meta+s',
    () => {
      saveOrFork();
    },
    { preventDefault: true }
  );

  const editorElements = (
    <>
      {isSmallScreen ? null : isAuthenticated ? (
        <div className={cx(styles.tabControls, { [styles.col3]: isLocal })}>
          {saveErrors?.length ? (
            <div className={cx(styles.errorPill, 'm-right-10')}>
              <button
                className={styles.close}
                onClick={(e) => {
                  e.preventDefault();
                  onCloseSaveErrors && onCloseSaveErrors();
                }}
              >
                &times;
              </button>
              <ul>
                {saveErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="m-right-15">
            <button
              className="buttonauto formbutton size2 secondary m-right-10"
              onClick={(e) => {
                e.preventDefault();
                setViewport(
                  {
                    x: 0,
                    y: 0,
                    zoom: 0.5,
                  },
                  { duration: 800 }
                );
              }}
              title="Reset Graph View"
            >
              <span className={cx('fa-layers', styles.resetVeiw)}>
                <FontAwesomeIcon icon={faArrowsRotate} size="xl" />
                <FontAwesomeIcon icon={faMagnifyingGlass} size="1x" />
              </span>
            </button>

            {'shadertoy' in engine.importers ? (
              <button
                className="buttonauto formbutton size2 secondary m-right-10"
                onClick={(e) => {
                  e.preventDefault();
                  setShowImport(true);
                }}
              >
                Import&hellip;
              </button>
            ) : null}
            {!shader.id || !isOwnShader ? null : (
              <button
                disabled={isSaving || isDeleting}
                className="buttonauto formbutton size2 secondary m-right-10"
                onClick={(e) => {
                  e.preventDefault();
                  saveOrFork(true);
                }}
              >
                Fork
              </button>
            )}
            <button
              disabled={isSaving || isDeleting}
              className="buttonauto formbutton size2"
              onClick={(e) => {
                e.preventDefault();
                saveOrFork();
              }}
              title={`${isMacintosh() ? `⌘-s` : `Ctrl-s`}`}
            >
              {shader.id && !isOwnShader ? 'Fork' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.tabControls}>Log in to save</div>
      )}

      <div
        className={styles.editorMetadata}
        onClick={() => setMetadataOpen(true)}
      >
        <div className="grid shrinkGrowShrink gap-5">
          <div className={styles.imagePreview}>
            {screenshotData && (
              <img src={screenshotData} alt={`${shader.name} screenshot`} />
            )}
          </div>
          <span className={styles.metadataName}>{truncate(shader?.name)}</span>
          <FontAwesomeIcon icon={faPencil} />
        </div>
      </div>

      <Tabs
        onTabSelect={setEditorTabIndex}
        selected={editorTabIndex}
        className={styles.shrinkGrowRows}
      >
        <TabGroup className={styles.tabBar}>
          <Tab>
            <FontAwesomeIcon
              icon={faDiagramProject}
              color="#aca"
              className="m-right-5"
            />{' '}
            Graph
          </Tab>
          <Tab>
            <FontAwesomeIcon icon={faCode} color="#aca" className="m-right-5" />
            GLSL Editor
          </Tab>
        </TabGroup>
        <TabPanels>
          {/* Graph tab */}
          <TabPanel className={styles.growShrinkRows}>
            <SplitPane split="vertical" defaultSizes={[0.2, 0.8]}>
              <div
                className={cx(
                  styles.splitInner,
                  styles.vSplit,
                  styles.vScroll,
                  NODROP_CLASS
                )}
              >
                <EffectSearch
                  engine={engine.name}
                  activeNode={primarySelectedNode as SourceNode}
                  onSelect={(selection) =>
                    onSelectGroup(primarySelectedNode, selection)
                  }
                />
              </div>
              <div className={styles.splitInner} ref={reactFlowWrapper}>
                {bottomPanelType === EDITOR_BOTTOM_PANEL.TEXTURE_BROWSER ? (
                  <BottomModal onClose={() => closeEditorBottomPanel()}>
                    <TextureBrowser
                      onSelect={(av) => {
                        if (primarySelectedNode?.type === 'texture') {
                          const sn = primarySelectedNode as TextureNode;
                          onNodeValueChange(primarySelectedNode.id, {
                            ...sn.value,
                            ...av,
                            properties: {
                              ...(av.properties || {}),
                              ...(sn.value?.properties || {}),
                            },
                          });
                        }
                      }}
                    />
                  </BottomModal>
                ) : bottomPanelType ===
                    EDITOR_BOTTOM_PANEL.NODE_CONFIG_EDITOR &&
                  primarySelectedNode ? (
                  <BottomModal onClose={() => closeEditorBottomPanel()}>
                    <ConfigEditor
                      node={primarySelectedNode}
                      onChange={(change) => {
                        updateGraphNode(primarySelectedNode.id, change);
                        if ('name' in change) {
                          updateFlowNodeData(primarySelectedNode.id, {
                            label: change.name,
                          });
                        } else {
                          updateFlowNodeConfig(primarySelectedNode.id, change);
                        }
                      }}
                    />
                  </BottomModal>
                ) : null}
                <FlowEditor
                  nodes={flowNodes}
                  edges={flowEdges}
                  menuItems={menuItems}
                  mouse={mouseRef}
                  onMenuAdd={onMenuAdd}
                  onMenuClose={hideMenu}
                  onNodeContextSelect={onNodeContextSelect}
                  onNodeContextHover={onNodeContextHover}
                  onNodeValueChange={onNodeValueChange}
                  onConnect={onConnect}
                  onReconnect={onEdgeUpdate}
                  onEdgesChange={onEdgesChange}
                  onNodesDelete={onNodesDelete}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onSelectionChange={onSelectionChange}
                  onEdgesDelete={onEdgesDelete}
                  onConnectStart={onConnectStart}
                  onReconnectStart={onReconnectStart}
                  onReconnectEnd={onReconnectEnd}
                  onConnectEnd={onConnectEnd}
                  onNodeDragStop={onNodeDragStop}
                />
                <div className={styles.graphFooter}>
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
                      <span className={styles.footerSecondary}>
                        Compile time:{' '}
                      </span>
                      {compileResult?.compileMs}ms
                    </>
                  ) : null}
                </div>
              </div>
            </SplitPane>
          </TabPanel>
          {/* Main code editor tab */}
          <TabPanel className="relative">
            <GlslEditor
              engine={engine}
              onCompile={compile}
              onSaveOrFork={saveOrFork}
              onGraphChange={() => {
                setGraph(graph);
                const updated = graphToFlowGraph(graph);
                setFlowNodes(updated.nodes);
                setFlowEdges(updated.edges);
              }}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );

  const sceneElements = (
    <div className={styles.sceneElements}>
      {contexting ? (
        <div className={styles.compiling}>
          <span>Building Context&hellip;</span>
        </div>
      ) : compiling ? (
        <div className={styles.compiling}>
          <span>Compiling&hellip;</span>
        </div>
      ) : guiError ? (
        <div className={styles.guiError}>
          <b>Compilation Error!</b> {guiError}
        </div>
      ) : null}
      <div className={styles.sceneAndControls}>
        <SceneComponent
          sceneConfig={sceneConfig}
          setSceneConfig={setSceneConfigAndRecompile}
          setCtx={setCtx}
          graph={graph}
          compile={compile}
          compileResult={compileResult}
          setGlResult={setGlResult}
          width={sceneConfig.width}
          height={sceneConfig.height}
          assetPrefix={assetPrefix}
          takeScreenshotRef={takeScreenshotRef}
        />
      </div>
    </div>
  );

  return (
    <FlowGraphContext.Provider
      value={{
        onInputBakedToggle,
        jumpToError: openNodeEditor,
        currentUser,
      }}
    >
      <div
        className={cx(styles.editorContainer, {
          [styles.smallScreen]: isSmallScreen,
        })}
        onClick={onContainerClick}
        onMouseMove={onMouseMove}
      >
        {isShowingImport ? (
          <Modal onClose={() => setShowImport(false)}>
            <ConvertShadertoy
              engine={engine}
              onImport={(newNodes, newEdges) => {
                const newGraph: Graph = {
                  nodes: graph.nodes.concat(newNodes).flat(2),
                  edges: graph.edges.concat(newEdges).flat(2),
                };

                const newFlowGraph = graphToFlowGraph(newGraph);

                setFlowNodes(newFlowGraph.nodes);
                setFlowEdges(newFlowGraph.edges);
                setGraph(newGraph);

                setShowImport(false);
              }}
            />
          </Modal>
        ) : null}
        {isMetadataOpen ? (
          <Modal onClose={() => setMetadataOpen(false)}>
            <MetadataEditor
              isOwnShader={isOwnShader}
              isDeleting={isDeleting}
              onDeleteShader={onDeleteShader}
              takeScreenshot={takeScreenshot}
              screenshotData={screenshotData}
            />
          </Modal>
        ) : null}
        {isSmallScreen ? (
          <Tabs
            onTabSelect={setSmallScreenEditorTabIndex}
            selected={smallScreenEditorTabIndex}
            className={styles.shrinkGrowRows}
          >
            <TabGroup>
              <Tab>Scene</Tab>
              <Tab>Editor</Tab>
            </TabGroup>
            <TabPanels>
              <TabPanel ref={sceneWrapRef} style={{ height: '100% ' }}>
                {sceneElements}
              </TabPanel>
              <TabPanel>{editorElements}</TabPanel>
            </TabPanels>
          </Tabs>
        ) : (
          <SplitPane
            onChange={syncSceneSize}
            defaultSizes={defaultMainSplitSize}
          >
            <div className={styles.splitInner}>{editorElements}</div>
            {/* 3d display split */}
            <div ref={sceneWrapRef} className={styles.splitInner}>
              {sceneElements}
            </div>
          </SplitPane>
        )}
        <DragOverlay dropAnimation={null}>
          {draggedShader ? <ShaderPreview shader={draggedShader} /> : null}
        </DragOverlay>
      </div>
    </FlowGraphContext.Provider>
  );
};

const EditorWithProviders = (props: EditorProps & EngineProps) => {
  const { exampleShader, example, examples, makeExampleGraph } = props;

  // For dragging shaders into the graph, make sure the mouse has to travel,
  // to avoid clicking on a siderbar shader causing a drag state
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });
  const sensors = useSensors(mouseSensor);

  const defaultShader = useMemo(
    () => ({
      user: {
        name: 'Fake User',
        isPro: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      engine: props.engine.name as 'three',
      name: randomShaderName(),
      visibility: 0,
      imageData: '',
      tags: [],
      config: {
        graph: {
          nodes: [],
          edges: [],
        },
        scene: {
          bg: '',
          lights: 'point',
          previewObject: 'sphere',
        },
      },
    }),
    [props.engine]
  );

  const shader = props.shader || defaultShader;

  const [initialGraph, initialSceneConfig, initialExample] = useMemo(() => {
    if (exampleShader) {
      return [exampleShader.config.graph, exampleShader.config.scene];
    }
    const query = new URLSearchParams(window.location.search);
    const exampleGraph = query.get('example') || example;
    if (shader) {
      return [shader.config.graph, shader.config.scene];
    }
    const [graph, sceneConfig] = makeExampleGraph(exampleGraph);
    return [expandUniformDataNodes(graph), sceneConfig, exampleGraph];
  }, [makeExampleGraph, example, shader, exampleShader]);

  // Use the key id to force a remount of the editor when the shader changes.
  // It would be nice to keep the scene context around, but that's a refactor
  // for another day...
  const id = 'id' in shader ? shader.id : null;

  return (
    <EditorProvider
      key={id}
      shader={shader}
      graph={initialGraph}
      sceneConfig={initialSceneConfig}
    >
      <DndContext sensors={sensors}>
        <ReactFlowProvider>
          <Hoisty>
            <Editor {...props} key={id} />
          </Hoisty>
        </ReactFlowProvider>
      </DndContext>
    </EditorProvider>
  );
};

export default EditorWithProviders;
