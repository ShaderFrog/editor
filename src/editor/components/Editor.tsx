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
  Edge as ReactFlowEdge,
  Connection,
  ReactFlowProvider,
  useUpdateNodeInternals,
  useReactFlow,
  XYPosition,
  OnConnectStartParams,
  useStoreApi,
  OnSelectionChangeFunc,
  NodeChange,
  useNodesState,
  useEdgesState,
} from 'reactflow';

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
  NodeType,
  makeEdge,
  resetGraphIds,
  isError,
  NodeErrors,
} from '@core/graph';

import FlowEditor, {
  MouseData,
  NodeContextActions,
  SHADERFROG_FLOW_EDGE_TYPE,
  useEditorStore,
} from './flow/FlowEditor';

import { Engine, EngineContext } from '@core/engine';

import useThrottle from '../hooks/useThrottle';

import { useAsyncExtendedState } from '../hooks/useAsyncExtendedState';

import {
  FlowNodeSourceData,
  FlowNodeDataData,
  FlowNodeData,
} from './flow/FlowNode';

import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import CodeEditor from './CodeEditor';
import ConfigEditor from './ConfigEditor';

import { Hoisty } from '../hoistedRefContext';
import { UICompileGraphResult } from '../uICompileGraphResult';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ensure } from '../../util/ensure';

import { makeId } from '../../util/id';
import { hasParent } from '../../util/hasParent';
import { useWindowSize } from '../hooks/useWindowSize';

import {
  FlowNode,
  FlowEdgeOrLink,
  FlowElements,
  toFlowInputs,
  setFlowNodeCategories,
  graphToFlowGraph,
  graphNodeToFlowNode,
  graphEdgeToFlowEdge,
  updateFlowInput,
  updateGraphInput,
  updateFlowNodeData,
  updateFlowNodesData,
  updateGraphNode as updateGraphNodeInternal,
  addFlowEdge,
  addGraphEdge,
  updateGraphFromFlowGraph,
  updateFlowEdgeData,
  markInputsConnected,
  updateFlowNodesConfig,
} from './flow/flow-helpers';

import { usePrevious } from '../hooks/usePrevious';
import {
  compileGraphAsync,
  createGraphNode,
  expandUniformDataNodes,
} from './useGraph';
import StrategyEditor from './StrategyEditor';
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

const SMALL_SCREEN_WIDTH = 500;

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(editor)\x1b[0m', ...args);

const Editor = ({
  assetPrefix,
  saveErrors,
  onCloseSaveErrors,
  shader: initialShader,
  isOwnShader,
  isAuthenticated,
  onCreateShader,
  onUpdateShader,
  isDeleting,
  onDeleteShader,
  engine,
  exampleShader,
  example,
  examples,
  makeExampleGraph,
  menuItems,
  sceneComponent: SceneComponent,
  addEngineNode,
  currentUser,
}: EditorProps & EngineProps) => {
  const reactFlowStore = useStoreApi();
  const { addSelectedNodes } = reactFlowStore.getState();
  const { screenToFlowPosition, getNode } = useReactFlow();

  const {
    hideMenu,
    menu,
    isTextureBrowserOpen,
    closeTextureBrowser,
    isNodeConfigEditorOpen,
    openNodeConfigEditor,
    closeNodeConfigEditor,
  } = useEditorStore();

  const [shader, setShader] = useState<Shader>(() => {
    return (
      initialShader || {
        user: {
          name: 'Fake User',
          isPro: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        engine: engine.name as 'three',
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
      }
    );
  });

  // Refresh the shader from the server if the ID changes - which happens on a
  // fork and a create
  if (initialShader && shader?.id && initialShader?.id !== shader?.id) {
    setShader(initialShader);
  }

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

  // Store the engine context in state. There's a separate function for passing
  // to children to update the engine context, which has more side effects
  const [ctx, setCtxState] = useState<EngineContext>();

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
  const [flowNodes, setNodes, applyNodeChanges] = useNodesState([]);
  const [flowEdges, setEdges, applyEdgeChanges] = useEdgesState([]);
  const flowStore = useStoreApi();

  const [initialGraph, initialSceneConfig, initialExample] = useMemo(() => {
    if (exampleShader) {
      return [exampleShader.config.graph, exampleShader.config.scene];
    }
    const query = new URLSearchParams(window.location.search);
    const exampleGraph = query.get('example') || example;
    if (initialShader) {
      return [initialShader.config.graph, initialShader.config.scene];
    }
    // @ts-ignore
    const [graph, sceneConfig] = makeExampleGraph(exampleGraph);
    return [expandUniformDataNodes(graph), sceneConfig, exampleGraph];
  }, [makeExampleGraph, example, initialShader, exampleShader]);

  const [currentExample, setExample] = useState<string | null | undefined>(
    initialExample
  );
  const [sceneConfig, setSceneConfig] =
    useState<AnySceneConfig>(initialSceneConfig);
  const [graph, setGraph] = useLocalStorage<Graph>('graph', initialGraph);
  const [nodeErrors, setNodeErrors] = useState<Record<string, NodeErrors>>({});

  /**
   * Compare the react-flow graph to the core graph, look for discrepancies.
   * Could be expanded to include any kind of invariant checking.
   */
  const graphIntegrity = useMemo(() => {
    const flowNodesById = new Set<string>(flowNodes.map((node) => node.id));
    const graphNodesById = new Set<string>(graph.nodes.map((node) => node.id));
    let errors: string[] = [];
    errors = errors.concat(
      graph.edges
        .filter(
          (edge) =>
            !graphNodesById.has(edge.to) || !graphNodesById.has(edge.from)
        )
        .map(
          (edge) =>
            `Edge "${edge.id}" is linked ${
              !graphNodesById.has(edge.to)
                ? `to id "${edge.to}"`
                : `from id "${edge.from}"`
            } which does not exist!`
        )
    );
    const allIds = new Set<string>([...flowNodesById, ...graphNodesById]);
    errors = errors.concat(
      Array.from(allIds).reduce<string[]>((acc, id) => {
        if (!graphNodesById.has(id)) {
          const flowNode = getNode(id);
          const stage = (flowNode?.data as FlowNodeSourceData)?.stage;
          return [
            ...acc,
            `Node ${flowNode?.data?.label} (${
              stage ? stage + ', ' : ''
            }id "${id}") found in flow graph but not graph`,
          ];
        } else if (!flowNodesById.has(id)) {
          const node = graph.nodes.find((n) => id === n.id);
          const stage = (node as SourceNode)?.stage;
          return [
            ...acc,
            `Node "${node?.name}" (${
              stage ? stage + ', ' : ''
            }id "${id}") found in graph but not flow graph`,
          ];
        }
        return acc;
      }, [])
    );

    return errors;
  }, [flowNodes, getNode, graph]);

  const tryToUnEffTheGraph = () => {
    setGraph((graph) => {
      const nodesById = graph.nodes.reduce<Record<string, GraphNode>>(
        (acc, node) => ({ ...acc, [node.id]: node }),
        {}
      );
      const orphanedEdgeIds = graph.edges
        .filter((edge) => !(edge.to in nodesById) || !(edge.from in nodesById))
        .reduce<Set<string>>((edges, edge) => {
          edges.add(edge.id);
          return edges;
        }, new Set<string>());
      log('Pruning', orphanedEdgeIds);
      return {
        ...graph,
        edges: graph.edges.filter((edge) => !orphanedEdgeIds.has(edge.id)),
      };
    });
  };

  const sceneWrapRef = useRef<HTMLDivElement>(null);

  // tabIndex may still be needed to pause rendering
  const [sceneTabIndex, setSceneTabIndex] = useState<number>(0);
  const [editorTabIndex, setEditorTabIndex] = useState<number>(0);
  const [smallScreenEditorTabIndex, setSmallScreenEditorTabIndex] =
    useState<number>(0);
  const [contexting, setContexting] = useState<boolean>(false);
  const [compiling, setCompiling] = useState<boolean>(false);
  const [guiError, setGuiError] = useState<string>('');

  // Which node is active in the GLSL editor tab
  const [activeEditingNode, setActiveEditingNode] = useState<SourceNode>(
    (graph.nodes.find((n) => n.type === 'source') ||
      graph.nodes[0]) as SourceNode
  );

  // Which node has the primary focus in the graph editor. Used for replacing
  // the current selected node with another graph, used for the texture browser
  // to replace the seleted node's texture value. This is different than the
  // react-flow selection, which can select multiple nodes.
  const [selectedNode, setSelectedNode] = useState<GraphNode | undefined>(
    activeEditingNode
  );
  const [replacingNode, setReplacingNode] = useState<FlowNode | null>(null);

  const [compileResult, setCompileResult] = useState<UICompileGraphResult>();

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

  // React-flow apparently needs(?) the useState callback to ensure the latest
  // flow elements are in state. We can no longer easily access the "latest"
  // flow elements in react-flow callbacks. To get the latest state, this
  // flag is set, and read in a useEffect
  const [needsCompile, setNeedsCompile] = useState<boolean>(false);

  const debouncedSetNeedsCompile = useMemo(
    () => debounce(setNeedsCompile, 500),
    []
  );

  useEffect(() => {
    if (shader) {
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const value = currentExample || '';
    urlParams.set('example', value);
    window.history.replaceState(
      {},
      value,
      `${window.location.pathname}?${urlParams.toString()}`
    );
  }, [currentExample, shader]);

  const setVertexOverride = useCallback(
    (vertexResult: string) => {
      setCompileResult({
        ...compileResult,
        vertexResult,
      } as UICompileGraphResult);
    },
    [compileResult]
  );
  const debouncedSetVertexOverride = useMemo(
    () => debounce(setVertexOverride, 1000),
    [setVertexOverride]
  );
  const setFragmentOverride = useCallback(
    (fragmentResult: string) => {
      setCompileResult({
        ...compileResult,
        fragmentResult,
      } as UICompileGraphResult);
    },
    [compileResult]
  );
  const debouncedSetFragmentOverride = useMemo(
    () => debounce(setFragmentOverride, 1000),
    [setFragmentOverride]
  );

  const [uiState, , extendUiState] = useAsyncExtendedState<{
    fragError: string | null;
    vertError: string | null;
    programError: string | null;
    compileMs: string | null;
    sceneWidth: number;
    sceneHeight: number;
  }>({
    fragError: null,
    vertError: null,
    programError: null,
    compileMs: null,
    sceneWidth: 0,
    sceneHeight: 0,
  });

  const updateFlowNode = useCallback(
    (nodeId: string, data: Partial<FlowNodeData>) => {
      setNodes((nodes) => updateFlowNodesData(nodes, nodeId, data));
    },
    [setNodes]
  );
  const updateFlowNodeConfig = useCallback(
    (nodeId: string, config: Record<string, any>) => {
      setNodes((nodes) => updateFlowNodesConfig(nodes, nodeId, config));
    },
    [setNodes]
  );
  const updateGraphNode = useCallback(
    (nodeId: string, data) => {
      setGraph((graph) => updateGraphNodeInternal(graph, nodeId, data));
    },
    [setGraph]
  );

  // Compile function, meant to be called manually in places where we want to
  // trigger a compile. I tried making this a useEffect, however this function
  // needs to update "flowElements" at the end, which leads to an infinite loop
  const compile = useCallback(
    (
      engine: Engine,
      ctx: EngineContext,
      graph: Graph,
      flowElements: FlowElements
    ) => {
      setContexting(false);
      setCompiling(true);

      log('Starting compileGraphAsync()!');
      compileGraphAsync(graph, engine, ctx)
        .then((result) => {
          if (isError(result)) {
            setNodeErrors((nodeErrors) => ({
              ...nodeErrors,
              [result.nodeId]: result,
            }));
            updateFlowNode(result.nodeId, { glslError: true });
            return;
          }

          log(`Compile complete in ${result.compileMs} ms!`, {
            compileResult: result,
          });

          setNodeErrors({});
          setGuiError('');
          setCompileResult(result);

          const byId = graph.nodes.reduce<Record<string, GraphNode>>(
            (acc, node) => ({ ...acc, [node.id]: node }),
            {}
          );

          // Update the available inputs from the node after the compile
          const updatedFlowNodes = flowElements.nodes.map((node) => {
            return updateFlowNodeData(node, {
              ...node.data,
              glslError: false,
              inputs: toFlowInputs(byId[node.id]),
              active: result.compileResult.activeNodeIds.has(node.id),
            });
          });

          const { nodes, edges } = markInputsConnected(
            setFlowNodeCategories(
              {
                ...flowElements,
                nodes: updatedFlowNodes,
              },
              result.dataNodes
            )
          );
          setNodes(nodes);
          setEdges(edges);

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
    },
    [updateNodeInternals, setEdges, setNodes, updateFlowNode]
  );

  // Let child components call compile after, say, their lighting has finished
  // updating. I'm doing this to avoid having to figure out the flow control
  // of: parent updates lights, child gets updates, sets lights, then parent
  // handles recompile
  const childCompile = useCallback(
    (ctx: EngineContext) => {
      return compile(engine, ctx, graph, {
        nodes: flowNodes,
        edges: flowEdges,
      });
    },
    [engine, compile, graph, flowNodes, flowEdges]
  );

  const setGlResult = useCallback(
    (result: {
      fragError: string;
      vertError: string;
      programError: string;
    }) => {
      extendUiState(result);
    },
    [extendUiState]
  );

  // Computes and recompiles an entirely new graph
  const initializeGraph = useCallback(
    (initialElements: FlowElements, newCtx: EngineContext, graph: Graph) => {
      setContexting(true);
      setTimeout(async () => {
        try {
          const result = await computeAllContexts(newCtx, engine, graph);
          if (isError(result)) {
            setNodeErrors((nodeErrors) => ({
              ...nodeErrors,
              [result.nodeId]: result,
            }));
            setNodes((nodes) =>
              updateFlowNodesData(nodes, result.nodeId, { glslError: true })
            );

            setContexting(false);
            const { errors } = result;
            console.error('Error computing context!', errors);
            setGuiError(`Error computing context: ${errors[0]}`);

            // In case the initial context fails to generate, which can happen
            // if a node is saved in a bad state, create the flow elements
            // anyway, so the graph still shows up
            setNodes(initialElements.nodes);
            setEdges(initialElements.edges);
          }

          log('Initializing flow nodes and compiling graph!', {
            graph,
            newCtx,
          });

          setNodes((nodes) =>
            nodes.map((node) => updateFlowNodeData(node, { glslError: false }))
          );

          setNodeErrors({});
          compile(engine, newCtx, graph, initialElements);
        } catch (error: any) {
          setContexting(false);
          console.error('Error computing context!', error);
          setGuiError(error.message);

          // Same comment as above
          setNodes(initialElements.nodes);
          setEdges(initialElements.edges);
        }
      }, 0);
    },
    [compile, engine, setNodes, setEdges]
  );

  // Once we receive a new engine context, re-initialize the graph. This method
  // is passed to engine specific editor components
  const setCtx = useCallback(
    (newCtx: EngineContext) => {
      if (newCtx.engine !== ctx?.engine) {
        ctx?.engine
          ? log('🔀 Changing engines!', { ctx, newCtx })
          : log('🌟 Initializing engine!', newCtx, '(no old context)', {
              ctx,
            });
        setCtxState(newCtx);
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
        initializeGraph(graphToFlowGraph(newGraph), newCtx, newGraph);
        // This branch wasn't here before I started working on the bug where
        // switching away from the scene to the source code tab and back removed
        // the envmap and others. I want to try to cache the whole scene and
        // objects here to avoid re-creating anything. I'm also curious if this
        // causes any kind of infinite loupe
      } else {
        setCtxState(newCtx);
      }
    },
    [ctx, setCtxState, initializeGraph, graph]
  );

  const onNodeValueChange = useCallback(
    (nodeId: string, value: any) => {
      if (!compileResult) {
        return;
      }

      updateFlowNode(nodeId, { value });
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
      updateFlowNode,
      graph.nodes,
    ]
  );

  const onInputBakedToggle = useCallback(
    (nodeId: string, inputId: string, baked: boolean) => {
      setNodes((nodes) => updateFlowInput(nodes, nodeId, inputId, { baked }));
      // setFlowElements((fe) => updateFlowInput(fe, nodeId, inputId, { baked }));
      setGraph((graph) => updateGraphInput(graph, nodeId, inputId, { baked }));
      debouncedSetNeedsCompile(true);
    },
    [setGraph, setNodes, debouncedSetNeedsCompile]
  );

  // TODO: Might be able to get rid of all of this, need to test running the
  // editor standalone to see how examples are used, if at all
  const previousExample = usePrevious(currentExample);
  useEffect(() => {
    if (currentExample !== previousExample && previousExample !== undefined) {
      log('🧶 Loading new example!', currentExample);
      const [graph, sceneConfig] = makeExampleGraph(
        // @ts-ignore
        currentExample || examples.DEFAULT
      );
      const newGraph = expandUniformDataNodes(graph);
      setGraph(newGraph);
      setSceneConfig(sceneConfig);
      setActiveEditingNode(newGraph.nodes[0] as SourceNode);
      addSelectedNodes([newGraph.nodes[0].id]);

      if (ctx) {
        const initFlowElements = graphToFlowGraph(newGraph);
        initializeGraph(initFlowElements, ctx, newGraph);
      } else {
        log('NOT Running initializeGraph from example change!');
      }
    }
  }, [
    addSelectedNodes,
    currentExample,
    previousExample,
    setGraph,
    ctx,
    initializeGraph,
    examples,
    makeExampleGraph,
    onInputBakedToggle,
  ]);

  /**
   * Split state mgmt
   */
  const windowSize = useWindowSize();
  const isSmallScreen = windowSize.width < SMALL_SCREEN_WIDTH;

  const [defaultMainSplitSize, setDefaultMainSplitSize] = useState<
    number[] | undefined
  >();

  useLayoutEffect(() => {
    const width = window.innerWidth;
    if (width >= SMALL_SCREEN_WIDTH) {
      const DEFAULT_SPLIT_PERCENT = 30;
      const sizes = [
        0.1 * (100 - DEFAULT_SPLIT_PERCENT) * width,
        0.1 * DEFAULT_SPLIT_PERCENT * width,
      ];
      setDefaultMainSplitSize(sizes);
    }
  }, []);

  const syncSceneSize = useThrottle(() => {
    if (sceneWrapRef.current) {
      const { width, height } = sceneWrapRef.current.getBoundingClientRect();
      extendUiState({ sceneWidth: width, sceneHeight: height });
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
    (newEdge: ReactFlowEdge | Connection) => {
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

        return updateGraphInput(
          addGraphEdge(graph, addedEdge),
          targetId,
          targetHandleId,
          // Here's the "auto-baking"
          input.bakeable
            ? {
                baked: isCode,
              }
            : {}
        );
      });

      // Duplicates above core graph logic. Another option is to map the result
      // of these operations into the core graph, but that would require making
      // both graphs dependencies of this usecallback hook, which could be a lot
      // of extra renders
      const targetFlowNode = ensure(getNode(newEdge.target!)) as FlowNode;

      const input = ensure(
        targetFlowNode.data.inputs.find((i) => i.id === targetHandleId)
      );

      const sourceFlowNode = ensure(getNode(newEdge.source!));

      // More icky business logic here...
      const edgeType = (sourceFlowNode.data as FlowNodeDataData).type;
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
      const nodesWithInput = updateFlowInput(
        nodes,
        sourceId,
        targetHandleId,
        input.bakeable
          ? {
              baked: isCode,
            }
          : {}
      );

      // React-flow updates the edges, calls the onEdgeUpdate callback, which
      // calls this function, which then again updates the edges. I *think* this
      // will override what react-flow is doing, maye causing double work. It
      // might be better to move this logic into onEdgesChange, like how
      // onNodesChange blocks the output nodes from being deleted, since this is
      // specific interception logic on top of adding a new graph edge.
      setNodes(nodesWithInput);
      setEdges(edges);

      setNeedsCompile(true);
    },
    [getNode, setNodes, setEdges, flowNodes, flowEdges, setGraph]
  );

  // This is the Flow callback that calls our custom connection handler when a
  // new edge is dragged between inputs/outputs
  const onConnect = useCallback(
    (edge: ReactFlowEdge | Connection) => addConnection(edge),
    [addConnection]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: ReactFlowEdge, newConnection: Connection) => {
      edgeUpdateSuccessful.current = true;
      addConnection(newConnection);
    },
    [addConnection]
  );

  /**
   * When React Flow makes a change to the graph *nodes*, it proposes a set of
   * changes. This callback lets you intercept those changes. It handles at
   * least node selection, dragging, and deletion changes.
   *
   * This strategy to is taken from https://github.com/xyflow/xyflow/issues/3092
   */
  const onNodesChange = useCallback(
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

      applyNodeChanges(nextChanges);
    },
    [getNode, applyNodeChanges]
  );

  const openNodeEditor = useCallback(
    (nodeId: string) => {
      const active = graph.nodes.find((n) => n.id === nodeId) as SourceNode;
      setActiveEditingNode(active);
      addSelectedNodes([active.id]);
      setSelectedNode(active);

      setEditorTabIndex(1);
    },
    [addSelectedNodes, graph]
  );

  const onNodeDoubleClick = useCallback(
    (event, node: FlowNode) => {
      if (!('value' in node.data)) {
        openNodeEditor(node.id);
      }
    },
    [openNodeEditor]
  );

  const onSelectionChange = useCallback<OnSelectionChangeFunc>(
    ({ nodes }) => {
      const node = nodes?.[0];
      if (node) {
        const selected = graph.nodes.find((n) => n.id === node.id) as GraphNode;
        setSelectedNode(selected);
      } else {
        setSelectedNode(undefined);
      }
    },
    [graph]
  );

  const setValidHandleTargets = useCallback(
    (nodeId: string, handleType: string) => {
      setNodes((nodes) => {
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
          return updateFlowNodeData(node, {
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
    [setNodes, graph]
  );

  const resetTargets = useCallback(() => {
    setNodes((nodes) =>
      (nodes as FlowNode[]).map((node) =>
        updateFlowNodeData(node, {
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
  }, [setNodes]);

  // Used for deleting edge on drag off
  const edgeUpdateSuccessful = useRef(true);

  const onEdgeUpdateStart = useCallback(
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
  const onConnectStart = useCallback(
    (_: React.MouseEvent | React.TouchEvent, params: OnConnectStartParams) => {
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
  const onEdgeUpdateEnd = useCallback(
    (_, edge) => {
      resetTargets();

      // Delete edge dragged off node
      // From https://reactflow.dev/examples/edges/delete-edge-on-drop
      if (!edgeUpdateSuccessful.current) {
        const { nodes, edges } = markInputsConnected({
          nodes: flowNodes,
          edges: flowEdges.filter((e) => e.id !== edge.id),
        });
        setNodes(nodes);
        setEdges(edges);
      }
      edgeUpdateSuccessful.current = true;
    },
    [resetTargets, setNodes, setEdges, flowNodes, flowEdges]
  );

  const addNodeAtPosition = useCallback(
    (
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

      setEdges((edges) => [
        ...edges,
        ...expanded!.edges.map(graphEdgeToFlowEdge),
      ]);
      setNodes((nodes) => [
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

      // Give the flow graph time to update after adding the new nodes
      setTimeout(async () => {
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
        await computeContextForNodes(
          ctx as EngineContext,
          engine,
          updatedGraph,
          nodesToRefresh
        );
        setGraph(updatedGraph);
        debouncedSetNeedsCompile(true);
      }, 10);
    },
    [
      addEngineNode,
      debouncedSetNeedsCompile,
      engine,
      ctx,
      setEdges,
      setNodes,
      setGraph,
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
        addNodeAtPosition(
          graph,
          type,
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
            type,
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
  const onNodeDragStop = (
    event: React.MouseEvent,
    node: FlowNode,
    nodes: FlowNode[]
  ) => {
    setGraph((graph) => ({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === node.id
          ? {
              ...n,
              position: node.position,
            }
          : n
      ),
    }));
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
      edgesById: edgesToRemoveById,
      nodesById: nodesToRemoveById,
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
            !nodesToRemoveById.has(node.id) &&
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

    setNodes(newFlowGraph.nodes);
    setEdges(newFlowGraph.edges);
    setGraph(newGraph);

    if (incomingOutFragNode) {
      setActiveEditingNode(incomingOutFragNode as SourceNode);

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
      setNodes((nodes) =>
        nodes.map((node) => updateFlowNodeData(node, { ghost: false }))
      );
      setEdges((edges) =>
        edges.map((edge) => updateFlowEdgeData(edge, { ghost: false }))
      );
    }
  }, [setNodes, setEdges, previousMenu, menu]);

  const onNodeContextSelect = useCallback(
    (nodeId: string, type: string) => {
      const currentNode = graph.nodes.find(
        (n) => n.id === nodeId
      ) as SourceNode;
      if (type === NodeContextActions.EDIT_SOURCE) {
        setActiveEditingNode(currentNode);
        addSelectedNodes([currentNode.id]);
        setSelectedNode(currentNode);

        if (isDataNode(currentNode)) {
          openNodeConfigEditor();
        } else {
          setEditorTabIndex(1);
        }
      } else if (type === NodeContextActions.DELETE_NODE_ONLY) {
        setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
        setEdges((edges) =>
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
        const { edgesById, nodesById } = findNodeTree(graph, currentNode);
        setNodes((nodes) => nodes.filter((node) => !nodesById.has(node.id)));
        setEdges((edges) => edges.filter((edge) => !edgesById.has(edge.id)));
        setGraph((graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => !nodesById.has(node.id)),
          edges: graph.edges.filter((edge) => !edgesById.has(edge.id)),
        }));
        debouncedSetNeedsCompile(true);
      } else if (type === NodeContextActions.DELETE_NODE_AND_DEPENDENCIES) {
        const { edgesById, nodesById } = findNodeAndData(graph, currentNode);
        setNodes((nodes) => nodes.filter((node) => !nodesById.has(node.id)));
        setEdges((edges) => edges.filter((edge) => !edgesById.has(edge.id)));
        setGraph((graph) => ({
          ...graph,
          nodes: graph.nodes.filter((node) => !nodesById.has(node.id)),
          edges: graph.edges.filter((edge) => !edgesById.has(edge.id)),
        }));
        debouncedSetNeedsCompile(true);
      }
      hideMenu();
    },
    [
      graph,
      setGraph,
      setEdges,
      setNodes,
      setActiveEditingNode,
      addSelectedNodes,
      setSelectedNode,
      setEditorTabIndex,
      hideMenu,
      debouncedSetNeedsCompile,
      openNodeConfigEditor,
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
        setNodes((nodes) =>
          nodes.map((node) =>
            updateFlowNodeData(node, { ghost: node.id === nodeId })
          )
        );
        setEdges((edges) =>
          edges.map((edge) =>
            updateFlowEdgeData(edge, {
              ghost: edge.source === nodeId || edge.target === nodeId,
            })
          )
        );
      } else if (type === NodeContextActions.DELETE_FULL_NODE_TREE) {
        const { edgesById, nodesById } = findNodeTree(graph, currentNode);
        setNodes((nodes) =>
          nodes.map((node) =>
            updateFlowNodeData(node, { ghost: nodesById.has(node.id) })
          )
        );
        setEdges((edges) =>
          edges.map((edge) =>
            updateFlowEdgeData(edge, { ghost: edgesById.has(edge.id) })
          )
        );
      } else if (type === NodeContextActions.DELETE_NODE_AND_DEPENDENCIES) {
        const { edgesById, nodesById } = findNodeAndData(graph, currentNode);
        setNodes((nodes) =>
          nodes.map((node) =>
            updateFlowNodeData(node, { ghost: nodesById.has(node.id) })
          )
        );
        setEdges((edges) =>
          edges.map((edge) =>
            updateFlowEdgeData(edge, { ghost: edgesById.has(edge.id) })
          )
        );
      } else {
        setNodes((nodes) =>
          nodes.map((node) => updateFlowNodeData(node, { ghost: false }))
        );
        setEdges((edges) =>
          edges.map((edge) => updateFlowEdgeData(edge, { ghost: false }))
        );
      }
    },
    [compiling, graph, setNodes, setEdges]
  );

  // const onNodeContextClose = useCallback(() => {
  //   setFlowElements((fe) => ({
  //     ...fe,
  //     nodes: fe.nodes.map((node) => updateFlowNodeData(node, { ghost: false })),
  //     edges: fe.edges.map((edge) => updateFlowEdgeData(edge, { ghost: false })),
  //   }));
  // }, [setFlowElements]);

  /**
   * Convenience compilation effect. This lets other callbacks update the
   * graph or flowElements however they want, and then set needsCompliation
   * to true, without having to worry about all the possible combinations of
   * updates of the parameters to compile()
   */
  useEffect(() => {
    if (needsCompile && !compiling) {
      compile(engine, ctx as EngineContext, graph, {
        nodes: flowNodes,
        edges: flowEdges,
      });
    }
  }, [
    compiling,
    needsCompile,
    flowNodes,
    flowEdges,
    ctx,
    graph,
    compile,
    engine,
  ]);

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
    (edges: ReactFlowEdge[]) => {
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
    (nodes: FlowNode[]) => {
      const graphNode = graph.nodes.find(
        (node) => node.id === nodes[0].id
      ) as GraphNode;

      const { edgesById: edgesToRemoveById, nodesById: nodesToRemoveById } =
        findNodeTree(graph, graphNode);

      // Update the flow graph to delete extra nodes and edges, since this
      // callback is only for a single node.
      setNodes((nodes) =>
        nodes.filter((node) => !nodesToRemoveById.has(node.id))
      );
      setEdges((edges) =>
        edges.filter((edge) => !edgesToRemoveById.has(edge.id))
      );

      setGraph((graph) => ({
        ...graph,
        nodes: graph.nodes.filter((node) => !nodesToRemoveById.has(node.id)),
        edges: graph.edges.filter((edge) => !edgesToRemoveById.has(edge.id)),
      }));
    },
    [graph, setGraph, setEdges, setNodes]
  );

  const getClosestNodeToPosition = useCallback(
    (xy: XYPosition) => {
      const MIN_DISTANCE = 150;

      const { nodeInternals } = flowStore.getState();
      const storeNodes = Array.from(nodeInternals.values());

      const closestNode = storeNodes.reduce<{
        distance: number;
        node: FlowNode | null;
      }>(
        (res, n) => {
          const dx = n.positionAbsolute!.x + n.width! / 2 - xy.x;
          const dy = n.positionAbsolute!.y + n.height! / 2 - xy.y;
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
    [flowStore]
  );

  const [activeShader, setActiveShader] = useState<Shader | null>(null);

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
      setActiveShader(shader);
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
    setActiveShader(null);
    setReplacingNode(null);
    setNodes((nodes) =>
      nodes.map((node) => updateFlowNodeData(node, { ghost: false }))
    );
    if (!event.over) {
      return;
    }
    if (
      hasParent(
        event.activatorEvent.target as HTMLDivElement,
        `.${NODROP_CLASS}`
      )
    ) {
      return;
    }
    if (replacingNode && activeShader) {
      onSelectGroup(
        graph.nodes.find((n) => n.id === replacingNode.id),
        activeShader
      );
    } else if (activeShader) {
      // Figure out some shit from the incoming graph
      const { graph: originalIncomingGraph } = activeShader.config;

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

      setNodes(newFlowGraph.nodes);
      setEdges(newFlowGraph.edges);
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
      const closestNode = getClosestNodeToPosition(mouseRef.current.projected);
      setNodes((nodes) =>
        nodes.map((node) =>
          updateFlowNodeData(node, { ghost: closestNode?.id === node.id })
        )
      );
      setReplacingNode(closestNode);
    }
  };

  useDndMonitor({
    onDragMove,
    onDragStart,
    onDragEnd,
  });

  const saveOrFork = async (btnFork = false) => {
    if (!ctx || (!onUpdateShader && !onCreateShader)) {
      return;
    }
    setIsSaving(true);
    // TODO: These values like engine and bg all have their own state, vs
    // setShader() copies all those values
    const payload = {
      // TODO CONVERT OR THROW
      engine: engine.name as 'three',
      name: shader?.name,
      tags: [],
      description: shader?.description,
      visibility: shader?.visibility || 1,
      imageData: screenshotData,
      config: {
        graph: updateGraphFromFlowGraph(graph, {
          nodes: flowNodes,
          edges: flowEdges,
        }),
        scene: sceneConfig,
      },
    };

    if (shader?.id && onUpdateShader && isOwnShader && !btnFork) {
      await onUpdateShader({
        id: shader.id,
        ...payload,
      });
    } else if (onCreateShader) {
      await onCreateShader(payload);
    }
    log('saved');

    setIsSaving(false);
  };

  useEffect(() => {
    if (isSmallScreen) {
      syncSceneSize();
    }
  }, [isSmallScreen, syncSceneSize]);

  useHotkeys(isMacintosh() ? `cmd+'` : `ctrl+'`, () => {
    compile(engine, ctx as EngineContext, graph, {
      nodes: flowNodes,
      edges: flowEdges,
    });
  });

  useHotkeys(
    'meta+s',
    () => {
      saveOrFork();
    },
    { preventDefault: true }
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [canDelete, setCanDelete] = useState<boolean>(false);
  const isLocal = window.location.href.indexOf('localhost') > 111;
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
      <Tabs
        onTabSelect={setEditorTabIndex}
        selected={editorTabIndex}
        className={styles.shrinkGrowRows}
      >
        <TabGroup className={styles.tabBar}>
          <Tab>Graph</Tab>
          <Tab>GLSL Editor</Tab>
          <Tab
            className={{
              [styles.errored]: uiState.fragError || uiState.vertError,
            }}
          >
            Shader
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
                  activeNode={selectedNode as SourceNode}
                  onSelect={(selection) =>
                    onSelectGroup(selectedNode, selection)
                  }
                />
              </div>
              <div className={styles.splitInner} ref={reactFlowWrapper}>
                {isTextureBrowserOpen ? (
                  <BottomModal onClose={() => closeTextureBrowser()}>
                    <TextureBrowser
                      onSelect={(av) => {
                        if (selectedNode?.type === 'texture') {
                          onNodeValueChange(selectedNode.id, av);
                        }
                      }}
                    />
                  </BottomModal>
                ) : isNodeConfigEditorOpen && selectedNode ? (
                  <BottomModal onClose={() => closeNodeConfigEditor()}>
                    <ConfigEditor
                      node={selectedNode}
                      onChange={(change) => {
                        updateGraphNode(selectedNode.id, change);
                        if ('name' in change) {
                          updateFlowNode(selectedNode.id, {
                            label: change.name,
                          });
                        } else {
                          updateFlowNodeConfig(selectedNode.id, change);
                        }
                      }}
                    />
                  </BottomModal>
                ) : null}
                <FlowEditor
                  menuItems={menuItems}
                  mouse={mouseRef}
                  onMenuAdd={onMenuAdd}
                  onMenuClose={hideMenu}
                  onNodeContextSelect={onNodeContextSelect}
                  onNodeContextHover={onNodeContextHover}
                  onNodeValueChange={onNodeValueChange}
                  nodes={flowNodes}
                  edges={flowEdges}
                  onConnect={onConnect}
                  onEdgeUpdate={onEdgeUpdate}
                  onNodesChange={onNodesChange}
                  onEdgesChange={applyEdgeChanges}
                  onNodesDelete={onNodesDelete}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onSelectionChange={onSelectionChange}
                  onEdgesDelete={onEdgesDelete}
                  onConnectStart={onConnectStart}
                  onEdgeUpdateStart={onEdgeUpdateStart}
                  onEdgeUpdateEnd={onEdgeUpdateEnd}
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
            <SplitPane split="horizontal">
              {/* Monaco split */}
              <div className={cx(styles.shrinkGrowRows, 'wFull')}>
                <div className={styles.editorControls}>
                  <select
                    className="select auto size2 m-right-5"
                    onChange={(event) => {
                      const node = graph.nodes.find(
                        (n) => n.id === event.target.value
                      ) as SourceNode;
                      setActiveEditingNode(node);
                      addSelectedNodes([node.id]);
                    }}
                    value={activeEditingNode.id}
                  >
                    {graph.nodes
                      .filter(
                        (n) => !isDataNode(n) && n.type !== NodeType.OUTPUT
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({(n as SourceNode).stage})
                        </option>
                      ))}
                  </select>
                  {activeEditingNode.config?.properties?.length ||
                  activeEditingNode.engine ? (
                    <div className={styles.infoMsg}>
                      Read-only: This node&apos;s source code is generated by{' '}
                      {engine.displayName}, and can&apos;t be edited directly.
                    </div>
                  ) : (
                    <button
                      className="buttonauto formbutton size2"
                      onClick={() =>
                        compile(engine, ctx as EngineContext, graph, {
                          nodes: flowNodes,
                          edges: flowEdges,
                        })
                      }
                      title={`${isMacintosh() ? `⌘-'` : `Ctrl+'`}`}
                    >
                      Compile
                    </button>
                  )}
                </div>
                <CodeEditor
                  engine={engine}
                  identity={activeEditingNode.id}
                  defaultValue={activeEditingNode.source}
                  errors={nodeErrors[activeEditingNode.id]}
                  onSave={() => {
                    saveOrFork();
                  }}
                  onCompile={() => {
                    compile(engine, ctx as EngineContext, graph, {
                      nodes: flowNodes,
                      edges: flowEdges,
                    });
                  }}
                  onChange={(value, event) => {
                    if (value) {
                      (
                        graph.nodes.find(
                          ({ id }) => id === activeEditingNode.id
                        ) as SourceNode
                      ).source = value;
                    }
                  }}
                />
              </div>
              {/* Strategy editor split */}
              <div className={cx(styles.splitInner, styles.nodeEditorPanel)}>
                <StrategyEditor
                  ctx={ctx}
                  node={activeEditingNode}
                  graph={graph}
                  onSave={() =>
                    compile(engine, ctx as EngineContext, graph, {
                      nodes: flowNodes,
                      edges: flowEdges,
                    })
                  }
                  onGraphChange={() => {
                    setGraph(graph);
                    const updated = graphToFlowGraph(graph);
                    setNodes(updated.nodes);
                    setEdges(updated.edges);
                  }}
                ></StrategyEditor>
              </div>
            </SplitPane>
          </TabPanel>
          {/* Final source code tab */}
          <TabPanel>
            <Tabs
              onTabSelect={setSceneTabIndex}
              selected={sceneTabIndex}
              className={styles.shrinkGrowRows}
            >
              <TabGroup className={styles.secondary}>
                <Tab>Metadata</Tab>
                <Tab className={{ [styles.errored]: uiState.fragError }}>
                  Fragment
                </Tab>
                <Tab className={{ [styles.errored]: uiState.vertError }}>
                  Vertex
                </Tab>
              </TabGroup>
              <TabPanels>
                {/* final fragment shader subtab */}
                <TabPanel className="relative">
                  <div className="fullScroll">
                    <div className={cx(styles.uiGroup, 'm0')}>
                      <div className="grid col2 gap50">
                        <div>
                          <h2 className={cx(styles.uiHeader)}>
                            Screenshot
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                takeScreenshot();
                              }}
                              className="buttonauto formbutton size2 m-left-15"
                            >
                              Update
                            </button>
                          </h2>
                          {screenshotData ? (
                            <img
                              src={screenshotData}
                              alt={`${shader.name} screenshot`}
                            />
                          ) : null}
                        </div>
                        <div>
                          <h2 className={styles.uiHeader}>Shader Name</h2>
                          <input
                            className="textinput"
                            type="text"
                            value={shader?.name}
                            onChange={(e) => {
                              setShader({
                                ...shader,
                                name: e.target.value,
                              });
                            }}
                          ></input>
                          <h2 className={cx(styles.uiHeader, 'm-top-25')}>
                            Description
                          </h2>
                          <textarea
                            className="textinput"
                            value={shader?.description || ''}
                            onChange={(e) => {
                              setShader({
                                ...shader,
                                description: e.target.value,
                              });
                            }}
                          ></textarea>
                          <h2 className={cx(styles.uiHeader, 'm-top-25')}>
                            Graph Integrity
                          </h2>
                          <div className="m-top-15">
                            {graphIntegrity.length ? (
                              <div>
                                {graphIntegrity.map((t) => (
                                  <div
                                    className="errorText px12 m-top-5"
                                    key={t}
                                  >
                                    {t}
                                  </div>
                                ))}
                                <div className="m-top-10">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      tryToUnEffTheGraph();
                                    }}
                                    className="buttonauto formbutton size2"
                                  >
                                    Attempt graph fix
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>✅ Integrity check passed</>
                            )}
                          </div>

                          {shader?.id && isOwnShader ? (
                            <div className="m-top-25">
                              <h2 className={cx(styles.uiHeader)}>Delete</h2>
                              <div className="m-top-15">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    onDeleteShader &&
                                      onDeleteShader(shader.id!);
                                  }}
                                >
                                  <input
                                    disabled={isDeleting}
                                    className="textinput"
                                    type="text"
                                    onChange={(e) => {
                                      setCanDelete(e.target.value === 'Delete');
                                    }}
                                    placeholder="Type 'Delete' to delete"
                                  ></input>
                                  <button
                                    disabled={!canDelete || isDeleting}
                                    className="buttonauto formbutton size2 m-top-10"
                                    type="submit"
                                  >
                                    Delete Shader
                                  </button>
                                </form>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabPanel>
                <TabPanel>
                  {uiState.fragError && (
                    <div className={styles.codeError} title={uiState.fragError}>
                      {(uiState.fragError || '').substring(0, 500)}
                    </div>
                  )}
                  <CodeEditor
                    engine={engine}
                    value={compileResult?.fragmentResult}
                    onChange={(value, event) => {
                      debouncedSetFragmentOverride(value);
                    }}
                  />
                </TabPanel>
                {/* final vertex shader subtab */}
                <TabPanel>
                  {uiState.vertError && (
                    <div className={styles.codeError} title={uiState.vertError}>
                      {(uiState.vertError || '').substring(0, 500)}
                    </div>
                  )}
                  <CodeEditor
                    engine={engine}
                    value={compileResult?.vertexResult}
                    onChange={(value, event) => {
                      debouncedSetVertexOverride(value);
                    }}
                  />
                </TabPanel>
              </TabPanels>
            </Tabs>
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
          setSceneConfig={setSceneConfig}
          setCtx={setCtx}
          graph={graph}
          compile={childCompile}
          compileResult={compileResult}
          setGlResult={setGlResult}
          width={uiState.sceneWidth}
          height={uiState.sceneHeight}
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
          {activeShader ? <ShaderPreview shader={activeShader} /> : null}
        </DragOverlay>
      </div>
    </FlowGraphContext.Provider>
  );
};

const EditorWithProviders = (props: EditorProps & EngineProps) => {
  // For dragging shaders into the graph, make sure the mouse has to travel,
  // to avoid clicking on a siderbar shader causing a drag state
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });
  const sensors = useSensors(mouseSensor);

  return (
    <DndContext sensors={sensors}>
      <ReactFlowProvider>
        <Hoisty>
          <Editor {...props} />
        </Hoisty>
      </ReactFlowProvider>
    </DndContext>
  );
};

export default EditorWithProviders;
