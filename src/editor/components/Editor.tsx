import styles from '../styles/editor.module.css';
import debounce from 'lodash.debounce';
import groupBy from 'lodash.groupby';

import FlowEditor, {
  MenuItems,
  MouseData,
  SHADERFROG_FLOW_EDGE_TYPE,
  useEditorStore,
} from './flow/FlowEditor';

import { SplitPane } from '@andrewray/react-multi-split-pane';
import cx from 'classnames';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
  MutableRefObject,
  FunctionComponent,
} from 'react';

import {
  Node as FlowNode,
  Edge as FlowEdge,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  ReactFlowProvider,
  useUpdateNodeInternals,
  useReactFlow,
  XYPosition,
  OnConnectStartParams,
  useStoreApi,
} from 'reactflow';

import {
  findNode,
  EdgeLink,
  Graph,
  GraphNode,
  Edge,
  EdgeType,
  CodeNode,
  SourceNode,
  NodeInput,
  computeAllContexts,
  computeContextForNodes,
  isDataNode,
  NodeType,
  collectConnectedNodes,
  filterGraphFromNode,
  makeEdge,
  findLinkedNode,
} from '@core/graph';

import { Engine, EngineContext } from '@core/engine';

import useThrottle from '../hooks/useThrottle';

import { useAsyncExtendedState } from '../hooks/useAsyncExtendedState';

import { FlowEdgeData } from './flow/FlowEdge';
import { FlowNodeSourceData, FlowNodeDataData } from './flow/FlowNode';

import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import CodeEditor from './CodeEditor';

import { Hoisty } from '../hoistedRefContext';
import { UICompileGraphResult } from '../uICompileGraphResult';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ensure } from '../../editor-util/ensure';

import { makeId } from '../../editor-util/id';
import { hasParent } from '../../editor-util/hasParent';
import { useWindowSize } from '../hooks/useWindowSize';

import {
  FlowElements,
  toFlowInputs,
  setFlowNodeCategories,
  graphToFlowGraph,
  graphNodeToFlowNode,
  graphEdgeToFlowEdge,
  updateFlowInput,
  updateGraphInput,
  updateFlowNodeData,
  updateGraphNode,
  addFlowEdge,
  addGraphEdge,
  updateGraphFromFlowGraph,
} from './flow/helpers';

import { usePrevious } from '../hooks/usePrevious';
import {
  compileGraphAsync,
  createGraphNode,
  expandUniformDataNodes,
} from './useGraph';
import StrategyEditor from './StrategyEditor';
import randomShaderName from '@api/randomShaderName';

export type PreviewLight = 'point' | '3point' | 'spot';

const SMALL_SCREEN_WIDTH = 500;

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(editor)\x1b[0m', ...args);

const post = async (path: string, body: any) => {
  const result = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!result.status.toString().startsWith('2')) {
    console.error('Fetch error', result);
    throw new Error(result.toString());
  }
  return await result.json();
};

/**
 * Where was I?
 * - Made babylon a lot better, got three<>babylon example working. Then
 *   noticed:
 *    - Adding a source code node that references a known engine global, like
 *      "time", fails because time isn't auto-injected. And an expression-only
 *      node can't currently support a line for a uniform on top. It woudln't
 *      make sense for a node to be "uniform float time;\n(sin(time))" for the
 *      expression. Should it be a function?
 *      - Also there is no function node generic abstraction
 *    - API improvement ideas:
 *      - Make shader generation and uniform generation part of engines, not
 *        components
 *    - Up next: Instead of inlining baked values, declare them as a variable
 *      and reference that variable in the filler code
 *    - Merge vertex and fragment shaders together into the same nodes, to avoid
 *      duplicating uniforms between the two nodes
 * - Add comments to shaders (and likes)
 * - Add standalone shader viewer page
 * - Add ability to export shaders
 * - Add an "easy mode" to the graph so it's easier for newcomers to use
 * - Add screen space shader support, like shadertoy
 * - Improve the compiler speed (or explore using)
 * - Add anonymous shader saving
 * - Launch: Feedback, URL sharing, examples
 * - Caching contexts would be helpful
 * - Switching between threejs source code tab and runtime tab re-creates things
 *   not stored on sceneData like the threetone and the mesh and I guess the
 *   scene it self - can I reuse all of that on hoisted ref between switches?
 *
 * ✅ TODO ✅
 *
 * Experimentation ideas
 * - Break up editors into different types to avoid loading all 3 libraries in a
 *   single component
 * - Try this noise donut torus shader
 *   https://www.youtube.com/watch?v=ixEPBzrhgTg
 * - Put other images in the graph like the toon step shader
 * - Adding a rim glow to a toon lit mesh is cool - but it would be even cooler
 *   to be able to multiply the rim lighting by the threejs lighting output
 *   specifically.
 * - Add post processing effect support
 * - Add playcanvas support
 * - Add screen space shader support
 * - ✅ Try SDF image shader https://www.youtube.com/watch?v=1b5hIMqz_wM
 * - ✅ Have uniforms added per shader in the graph
 *
 * Fundamental Issues
 * - "displacementMap" on a three.js material is calculated in the vertex
 *   shader, so fundamentally it can't have fragment shaders plugged into it as
 *   images.
 * - Setting custom vertex attributes on the mesh, then reading them in the
 *   shader, like "in vec3 tangent;" get suffixed to "in vec3 tangent_1234;" and
 *   lose their relationship with the attribute on the geometry.
 * - Autosave shader while editing ( + memoizing to avoid recompiling three
 *   every time)
 * - Fix graph saving of positions, when loading a graph nodes move around
 * - Add ability to delete inputs from nodes? When removing a uniform, its
 *   inputs don't go away.
 * - ✅ Do different things based on shader settings. They are independent of the
 *   uniforms and/or set the uniforms. Right now there's no way to plug into a
 *   property like "map" or "envMap". Should there be a separate "properties"
 *   section on each node?
 *   (https://github.com/mrdoob/three.js/blob/e22cb060cc91283d250e704f886528e1be593f45/src/materials/MeshPhysicalMaterial.js#L37)
 * - ✅ The three.js material has properties like "envMap" and "reflectivity"
 *   which
 *
 * Polish / Improvements
 * - UX
 *   - Add more syntax highlighting to the GLSL editor, look at vscode plugin?
 *     https://github.com/stef-levesque/vscode-shader/tree/master/syntaxes
 *   - Uniform strategy should be added as default to all shaders
 *   - Add three.js ability to switch lighting megashader and/or save node
 *     positions for examples?
 *   - Show input type by the input
 *   - ✅ Allow dragging uniform edge out backwards to create a data node for it
 *   - ✅ Auto rename the data inputs to uniforms to be that uniform name
 *   - ✅ Sort node inputs into engine, uniforms, properties
 *   - ✅ "Compiling" doesn't show up when (at least) changing number input
 *     nodes, and the compiling indicator could be more obvious
 *   - ✅ Store graph zoom / pan position between tab switches
 *   - ✅ fix default placement of nodes so they don't overlap and stack better,
 * - Core
 *   - Recompiling re-parses / re-compiles the entire graph, nothing is
 *     memoized. Can we use immer or something else to preserve and update the
 *     original AST so it can be reused?
 *   - Break up graph.ts into more files, lke core parsers maybe
 *   - onBeforeCompile in threngine mutates the node to add the source - can we
 *     make this an immutable update in graph.ts?
 *   - See TODO on collapseInputs in graph.ts
 *   - Fragment and Vertex nodes should be combined together, because uniforms
 *     are used between both of them (right?). Although I guess technically you
 *     could bake a different value in the fragment vs vertex uniform...
 *   - Make properties "shadow" the uniforms the control to hide the uniforms on
 *     the node inputs
 *   - Add Graph Index data type to avoid re-indexing nodes by ID, filtering
 *     nodes everywhere
 *
 * Features
 * - Ability to export shaders + use in engine
 * - Enable backfilling of uv param
 * - Allow for shader being duplicated in a main fn to allow it to be both
 *   normal map and albdeo
 * - Add types to the connections (like vec3/float), and show the types on the
 *   inputs/ouputs, and prevent wrong types from being connected
 * - Re-add the three > babylon conversion
 * - Shader node editor specific undo history
 * - For parsing and mangling - after parsing - can I just produce a function
 *   that fills in a template? So that when it's time to compose, it's just
 *   string manipulation?
 * - ✅ Add image data nodes to the graph
 * - ✅ Add persistable shaders to a db!
 * - ✅ Add ability to show wireframe
 *
 * Bugs
 * - UI
 * - Babylon
 *   - Features not backported: material caching, updating material properties
 *     when a new edge is plugged in.
 *   - Babylon.js light doesn't seem to animate
 *   - Adding shader inputs like bumpTexture should not require duplicating that
 *     manually into babylengine
 * - Uniforms
 *   - Plugging in a number node to a vec2 uniform (like perlin clouds speed)
 *     causes a crash
 *   - Data nodes hard coded as '1' fail because that's not a valid float, like
 *     hard coding "transmission" uniform.
 * - Nodes / Graph
 *   - clamp(texture2D(), vec4(), vec4()) and replacing texture2D() eats whole
 *     clamp!
 *   - Plugging in Shader > Add > Baked Texture Input causes the input to be
 *     unbaked. This is because the auto-bake algorithm only looks one node
 *     level deep, and the "add" node isn't type = "source"
 *   - Deleting a node while it's plugged into the output (maybe any connected
 *     node, i repro'd with the Physical node) node causes crash
 *   - Adding together a three.js phong and physical lighting model fails to
 *     compiles becaues it introduces duplicated structs - structs aren't
 *     suffixed/renamed? Interesting
 *   - "color" is an engine variable but most shaders have their own unique
 *     color uniform. So "color" should only be preserved in engine nodes
 *   - ✅ Dragging out a color/vec3 auto-creates a number node, causing webgl
 *     render crash
 * - Core
 *   - Some custom nodes set engine shader varyings like vNormal. If an engine
 *     shader sets that property later, it overrides the custom node. A feature
 *     could be to look for any varying assignments in the custom node, and
 *     remove any assignments to those in the
 *   - In a source node, if two functions declare a variable, the current
 *     "Variable" strategy will only pick the second one as an input.
 *   - (same as above?) The variable strategy needs to handle multiple variable
 *     replacements of the same name (looping over references), and maybe handle
 *     if that variable is declared in the program by removing the declaration
 *     line
 *   - Nodes not plugged into the graph don't get their contex computed (like
 *     new inputs)
 *   - Move engine nodes into engine specific constructors
 *   - On Safari, Babylon generates different GLSL than Chrome, specifically it
 *     adds `uniform Material { reflectionMatrix }` while on Chrome it just adds
 *     `uniform mat4 reflectionMatrix`. Shaderfrog treats these as unique names
 *     in the shader, so it crashed the shader on Safari because it had both,
 *     redeclaring the variable. Is this a bug? Also this case would have been
 *     alievated by the global variable detection system: parsing engine
 *     variables out of engine shaders.
 */

export type BaseSceneConfig = {
  bg: string | null;
  lights: string;
  previewObject: string;
};
export type AnySceneConfig = BaseSceneConfig & Record<string, any>;

// This must be kept in sync with the site/ shader model. TODO: Should that be
// moved into Core instead?
export type EditorShader = {
  id?: string;
  engine: string;
  createdAt?: Date;
  updatedAt?: Date;
  tags: { name: string; slug: string }[];
  userId?: string;
  image?: string | null;
  name: string;
  description?: string | null;
  visibility: number;
  config: {
    graph: {
      nodes: GraphNode[];
      edges: Edge[];
    };
    scene: AnySceneConfig;
  };
};
// Ditto. Maybe one day extract a @shaderfrog/types library or something
type ShaderUpdateInput = Omit<
  EditorShader,
  'createdAt' | 'updatedAt' | 'userId'
> & {
  id: string;
  tags: string[];
};

type ShaderCreateInput = Omit<
  EditorShader,
  'id' | 'createdAt' | 'updatedAt' | 'userId'
> & { imageData: string; tags: string[] };

type AnyFn = (...args: any) => any;

/**
 * This is the interface for the props that any engine scene component must
 * accept. Usage:
 *    <Editor sceneComponent={MyEngineEditor} />
 * Where MyEngineEditor (the component) must accept these props, because this
 * parent editor component controls their state/functionality
 */
export type SceneProps = {
  compile: AnyFn;
  compileResult: UICompileGraphResult | undefined;
  graph: Graph;
  setCtx: (ctx: EngineContext) => void;
  sceneConfig: AnySceneConfig;
  setSceneConfig: (config: AnySceneConfig) => void;
  setGlResult: AnyFn;
  width: number;
  height: number;
  assetPrefix: string;
  takeScreenshotRef: MutableRefObject<(() => Promise<string>) | undefined>;
};

/**
 * Props you must pass to <Editor /> from the wrapping page
 */
export type EditorProps = {
  assetPrefix: string;
  searchUrl: string;
  saveError?: string;
  isFork?: boolean;
  isAuthenticated?: boolean;
  shader?: EditorShader;
  onCreateShader?: (shader: ShaderCreateInput) => Promise<void>;
  onUpdateShader?: (shader: ShaderUpdateInput) => Promise<void>;
};

/**
 * Props that individual engine components (like ThreeEditor.tsx) combine with
 * parent EditorProps to this component.
 */
export type EngineProps = {
  engine: Engine;
  example: string;
  examples: Record<string, string>;
  makeExampleGraph: (example: string) => [Graph, AnySceneConfig];
  menuItems: MenuItems;
  addEngineNode: (
    nodeDataType: string,
    name: string,
    position: { x: number; y: number },
    newEdgeData?: Omit<Edge, 'id' | 'from'>,
    defaultValue?: any
  ) => [Set<string>, Graph] | undefined;
  sceneComponent: FunctionComponent<SceneProps>;
};

const GroupSearch = ({
  engine,
  searchUrl,
  activeNode,
  onSelect,
}: {
  engine: string;
  searchUrl: string;
  activeNode: SourceNode;
  onSelect: (shader: EditorShader) => void;
}) => {
  const [search, setSearch] = useState<string>('');
  const [effects, setEffects] = useState<{
    total: number;
    shaders: EditorShader[];
  }>({ total: 0, shaders: [] });

  const doSearch = useMemo(() => {
    return debounce(async (text: string) => {
      try {
        const { count, shaders } = await post(searchUrl, { text, engine });

        // Remove shaders with engine nodes. There's probably a more important
        // criteria here that I don't know yet.
        const filtered = (shaders as EditorShader[]).filter((s) => {
          return !s.config.graph.nodes.find((n) => (n as SourceNode).engine);
        });

        setEffects({ total: count, shaders: filtered });
      } catch (e) {
        console.error('Error searching', e);
      }
    }, 500);
  }, [engine, searchUrl]);

  useEffect(() => {
    doSearch('');
  }, [doSearch]);

  const onChange = (event: React.FormEvent<HTMLInputElement>) => {
    const search = event.currentTarget.value || '';
    setSearch(search);
    doSearch(search);
  };

  return (
    <>
      <div>
        <label className="label" htmlFor="efsrc">
          Effect Search
        </label>
        <input
          name="search"
          id="efsrc"
          className="textinput"
          placeholder="Effect name"
          onChange={onChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              doSearch(search);
            }
          }}
        ></input>
      </div>
      <div className="m-top-10">
        <div>
          <div>
            <label className="label">Results</label>
          </div>
          {effects.shaders.length ? (
            <div className="grid col2">
              {effects.shaders.map((shader) => (
                <div
                  key={shader.id}
                  className="shaderCardButton"
                  onClick={() => onSelect(shader)}
                >
                  <div className="cardImg">
                    <img
                      src={shader.image as string}
                      alt={`${shader.name} screenshot`}
                    />
                  </div>
                  <div className="body">{shader.name}</div>
                </div>
              ))}
            </div>
          ) : (
            'No results'
          )}
        </div>
      </div>
    </>
  );
};

const Editor = ({
  assetPrefix,
  searchUrl,
  saveError,
  shader: initialShader,
  isFork,
  isAuthenticated,
  onCreateShader,
  onUpdateShader,
  engine,
  example,
  examples,
  makeExampleGraph,
  menuItems,
  sceneComponent: SceneComponent,
  addEngineNode,
}: EditorProps & EngineProps) => {
  const reactFlowStore = useStoreApi();
  const { addSelectedNodes } = reactFlowStore.getState();

  const [shader, setShader] = useState<EditorShader>(() => {
    return (
      initialShader || {
        engine: engine.name,
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
  const [flowElements, setFlowElements] = useLocalStorage<FlowElements>(
    'flow',
    {
      nodes: [],
      edges: [],
    }
  );

  const [initialGraph, initialSceneConfig, initialExample] = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const exampleGraph = query.get('example') || example;
    if (initialShader) {
      return [initialShader.config.graph as Graph, initialShader.config.scene];
    }
    // @ts-ignore
    const [graph, sceneConfig] = makeExampleGraph(exampleGraph);
    return [expandUniformDataNodes(graph), sceneConfig, exampleGraph];
  }, [makeExampleGraph, example, initialShader]);

  const [currentExample, setExample] = useState<string | null | undefined>(
    initialExample
  );
  const [sceneConfig, setSceneConfig] =
    useState<AnySceneConfig>(initialSceneConfig);
  const [graph, setGraph] = useLocalStorage<Graph>('graph', initialGraph);

  const sceneWrapRef = useRef<HTMLDivElement>(null);

  // tabIndex may still be needed to pause rendering
  const [sceneTabIndex, setSceneTabIndex] = useState<number>(0);
  const [editorTabIndex, setEditorTabIndex] = useState<number>(0);
  const [smallScreenEditorTabIndex, setSmallScreenEditorTabIndex] =
    useState<number>(0);
  const [contexting, setContexting] = useState<boolean>(false);
  const [compiling, setCompiling] = useState<boolean>(false);
  const [guiError, setGuiError] = useState<string>('');

  const [activeNode, setActiveNode] = useState<SourceNode>(
    (graph.nodes.find((n) => n.type === 'source') ||
      graph.nodes[0]) as SourceNode
  );

  const [compileResult, setCompileResult] = useState<UICompileGraphResult>();

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
          log(`Compile complete in ${result.compileMs} ms!`, {
            compileResult: result,
          });
          setGuiError('');
          setCompileResult(result);

          const byId = graph.nodes.reduce<Record<string, GraphNode>>(
            (acc, node) => ({ ...acc, [node.id]: node }),
            {}
          );

          // Update the available inputs from the node after the compile
          const updatedFlowNodes = flowElements.nodes.map((node) => {
            return {
              ...node,
              data: {
                ...node.data,
                inputs: toFlowInputs(byId[node.id]),
                active: result.compileResult.activeNodeIds.has(node.id),
              },
            };
          });

          setFlowElements(
            setFlowNodeCategories(
              {
                ...flowElements,
                nodes: updatedFlowNodes,
              },
              result.dataNodes
            )
          );

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
    [updateNodeInternals, setFlowElements]
  );

  const onNodeValueChange = useCallback(
    (nodeId: string, value: any) => {
      if (!compileResult) {
        return;
      }

      setFlowElements((fe) => updateFlowNodeData(fe, nodeId, { value }));
      setGraph((graph) => updateGraphNode(graph, nodeId, { value }));

      // Only recompile if a non-data-node value changes
      const { dataNodes } = compileResult;
      if (!(nodeId in dataNodes)) {
        debouncedSetNeedsCompile(true);
      }
    },
    [setFlowElements, compileResult, debouncedSetNeedsCompile, setGraph]
  );

  const onInputBakedToggle = useCallback(
    (nodeId: string, inputId: string, baked: boolean) => {
      setFlowElements((fe) => updateFlowInput(fe, nodeId, inputId, { baked }));
      setGraph((graph) => updateGraphInput(graph, nodeId, inputId, { baked }));
      debouncedSetNeedsCompile(true);
    },
    [setGraph, setFlowElements, debouncedSetNeedsCompile]
  );

  // Let child components call compile after, say, their lighting has finished
  // updating. I'm doing this to avoid having to figure out the flow control
  // of: parent updates lights, child gets updates, sets lights, then parent
  // handles recompile
  const childCompile = useCallback(
    (ctx: EngineContext) => {
      return compile(engine, ctx, graph, flowElements);
    },
    [engine, compile, graph, flowElements]
  );

  // Computes and recompiles an entirely new graph
  const initializeGraph = useCallback(
    (initialElements: FlowElements, newCtx: EngineContext, graph: Graph) => {
      setContexting(true);
      setTimeout(async () => {
        try {
          const result = await computeAllContexts(newCtx, engine, graph);
          if (result.type === 'errors') {
            setContexting(false);
            const errors = result.errors as any[];
            console.error('Error computing context!', errors);
            setGuiError(`Error computing context: ${errors[0]}`);

            // In case the initial context fails to generate, which can happen
            // if a node is saved in a bad state, create the flow elements
            // anyway, so the graph still shows up
            setFlowElements(initialElements);
          } else {
            log('Initializing flow nodes and compiling graph!', {
              graph,
              newCtx,
            });
            compile(engine, newCtx, graph, initialElements);
          }
        } catch (error: any) {
          setContexting(false);
          console.error('Error computing context!', error);
          setGuiError(error.message);

          // Same comment as above
          setFlowElements(initialElements);
        }
      }, 0);
    },
    [compile, engine, setFlowElements]
  );

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
      setActiveNode(newGraph.nodes[0] as SourceNode);
      addSelectedNodes([newGraph.nodes[0].id]);

      if (ctx) {
        const initFlowElements = graphToFlowGraph(newGraph, onInputBakedToggle);
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
        // if (lastEngine) {
        //   newGraph = convertToEngine(lastEngine, engine, graph);

        //   if (ctx?.engine) {
        //     const currentScene = getRefData(ctx.engine);
        //     if (currentScene) {
        //       // @ts-ignore
        //       currentScene.destroy(currentScene);
        //     }
        //   }
        // }
        initializeGraph(
          graphToFlowGraph(newGraph, onInputBakedToggle),
          newCtx,
          newGraph
        );
        // This branch wasn't here before I started working on the bug where
        // switching away from the scene to the source code tab and back removed
        // the envmap and others. I want to try to cache the whole scene and
        // objects here to avoid re-creating anything. I'm also curious if this
        // causes any kind of infinite loupe
      } else {
        setCtxState(newCtx);
      }
    },
    [ctx, setCtxState, initializeGraph, graph, onInputBakedToggle]
  );

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
    (newEdge: FlowEdge | Connection) => {
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
        const edgeType = sourceGraphNode.type;
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

      // Duplicates above branch. Another option is to map the result of these
      // operations into the core graph, but that would require making both
      // graphs dependencies of this usecallback hook, which could be a lot of
      // extra renders
      setFlowElements((fe) => {
        const targetFlowNode = ensure(
          fe.nodes.find((node) => node.id === newEdge.target)
        );
        const input = ensure(
          targetFlowNode.data.inputs.find((i) => i.id === targetHandleId)
        );

        const sourceFlowNode = ensure(
          fe.nodes.find((node) => node.id === newEdge.source)
        );

        // More icky business logic here...
        const edgeType = (sourceFlowNode.data as FlowNodeDataData).type;
        const type: EdgeType | undefined =
          (sourceFlowNode.data as FlowNodeSourceData).stage || edgeType;
        const isCode = sourceFlowNode.type === 'source';

        const addedEdge: FlowEdge<FlowEdgeData> = {
          ...newEdge,
          id: newEdgeId,
          source: sourceId,
          target: targetId,
          data: { type },
          className: cx(type, edgeType),
          type: SHADERFROG_FLOW_EDGE_TYPE,
        };

        return updateFlowInput(
          addFlowEdge(fe, addedEdge),
          sourceId,
          targetHandleId,
          input.bakeable
            ? {
                baked: isCode,
              }
            : {}
        );
      });

      setNeedsCompile(true);
    },
    [setFlowElements, setGraph]
  );

  // This is the Flow callback that calls our custom connection handler when a
  // new edge is dragged between inputs/outputs
  const onConnect = useCallback(
    (edge: FlowEdge | Connection) => addConnection(edge),
    [addConnection]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: FlowEdge, newConnection: Connection) =>
      addConnection(newConnection),
    [addConnection]
  );

  // Used for selecting edges, also called when an edge is removed, along with
  // onEdgesDelete above
  const onEdgesChange = useCallback(
    (changes) => {
      console.log('onEdgesChange', changes);
      return setFlowElements((fe) => ({
        ...fe,
        edges: applyEdgeChanges(changes, fe.edges),
      }));
    },
    [setFlowElements]
  );

  // Handles selection, dragging, and deletion
  const onNodesChange = useCallback(
    (changes) =>
      setFlowElements((elements) => ({
        nodes: applyNodeChanges(changes, elements.nodes),
        edges: elements.edges,
      })),
    [setFlowElements]
  );

  const onNodeDoubleClick = useCallback(
    (event, node: FlowNode) => {
      if (!('value' in node.data)) {
        const active = graph.nodes.find((n) => n.id === node.id) as SourceNode;
        setActiveNode(active);
        addSelectedNodes([active.id]);

        setEditorTabIndex(1);
      }
    },
    [addSelectedNodes, graph]
  );

  const setTargets = useCallback(
    (nodeId: string, handleType: string) => {
      setFlowElements((flowElements) => {
        const source = graph.nodes.find(({ id }) => id === nodeId) as GraphNode;
        return {
          edges: flowElements.edges,
          nodes: flowElements.nodes.map((node) => {
            if (
              node.data &&
              'stage' in source &&
              'stage' in node.data &&
              'label' in node.data &&
              (node.data.stage === source.stage ||
                !source.stage ||
                !node.data.stage) &&
              node.id !== nodeId
            ) {
              return {
                ...node,
                data: {
                  ...node.data,
                  inputs: node.data.inputs.map((input) => ({
                    ...input,
                    validTarget: handleType === 'source',
                  })),
                  outputs: node.data.outputs.map((output) => ({
                    ...output,
                    validTarget: handleType === 'target',
                  })),
                },
              };
            }
            return node;
          }),
        };
      });
    },
    [setFlowElements, graph]
  );

  const resetTargets = useCallback(() => {
    setFlowElements((flowElements) => {
      return {
        edges: flowElements.edges,
        nodes: flowElements.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            inputs: node.data.inputs.map((input) => ({
              ...input,
              validTarget: false,
            })),
            outputs: node.data.outputs.map((output) => ({
              ...output,
              validTarget: false,
            })),
          },
        })),
      };
    });
  }, [setFlowElements]);

  const onEdgeUpdateStart = useCallback(
    (event: any, edge: any) => {
      const g = event.target.parentElement;
      const handleType =
        [...g.parentElement.children].indexOf(g) === 3 ? 'source' : 'target';
      const nodeId = handleType === 'source' ? edge.source : edge.target;
      setTargets(nodeId, handleType);
    },
    [setTargets]
  );

  const connecting = useRef<{ node: GraphNode; input: NodeInput } | null>();
  const onConnectStart = useCallback(
    (_: React.MouseEvent | React.TouchEvent, params: OnConnectStartParams) => {
      const { nodeId, handleType, handleId } = params;
      if (handleType === 'source' || !nodeId || !handleType) {
        return;
      }
      const node = ensure(graph.nodes.find((n) => n.id === nodeId));

      connecting.current = {
        node,
        input: ensure(node.inputs.find((i) => i.id === handleId)),
      };
      setTargets(nodeId, handleType);
    },
    [graph, setTargets]
  );

  const onEdgeUpdateEnd = () => resetTargets();

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

      if (engine.name === 'three') {
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

      setFlowElements((fe) => ({
        edges: [...fe.edges, ...expanded!.edges.map(graphEdgeToFlowEdge)],
        nodes: [
          ...fe.nodes,
          ...expanded!.nodes.map((newGn, index) =>
            graphNodeToFlowNode(
              newGn,
              onInputBakedToggle,
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
        ],
      }));

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
      onInputBakedToggle,
      setFlowElements,
      setGraph,
    ]
  );

  const { project } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnectEnd = useCallback(
    (event) => {
      resetTargets();
      // Make sure we only drop over the grid, not over a node
      const targetIsPane = event.target.classList.contains('react-flow__pane');

      if (targetIsPane && reactFlowWrapper.current && connecting.current) {
        // Remove the wrapper bounds to get the correct position
        const { top, left } = reactFlowWrapper.current.getBoundingClientRect();
        const { node, input } = connecting.current;

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
          project({
            x: event.clientX - left,
            y: event.clientY - top,
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
      connecting.current = null;
    },
    [graph, project, addNodeAtPosition, resetTargets]
  );

  /**
   * When selecting a group to replace the current node with
   */
  const onSelectGroup = (shader: EditorShader) => {
    // For now can only replace the currently selected node
    if (!activeNode || activeNode.type === 'output' || !activeNode.stage) {
      return;
    }

    // TODO: Gotta figure out how to do this in the context of groups

    // Find the current active node and its next stage node if present
    const curentOutputNode = activeNode;
    const activeNodeIds = new Set([curentOutputNode.id]);
    const currentToEdge = graph.edges.find(
      (edge) => edge.from === activeNode.id
    );
    const currentToNode = graph.nodes.find(
      (node) => node.id === currentToEdge?.to
    );

    const otherActiveNode = findLinkedNode(graph, activeNode.id);

    // TODO: Guessing for how nodes are parented to a group, and remove those
    // instead of all the inputs to a node
    // activeNode.parentId ?
    //     graph.nodes.find((n) => n.id === activeNode.parentId)

    // Filter the graph from the active node to essentialy remove its data
    // inputs. With groups this should change to the group.
    const currentElementsToRemove = filterGraphFromNode(graph, activeNode, {
      node: (node, inputEdges, acc) => {
        return Object.values(acc.edges)
          .map((edge) => edge.from)
          .includes(node.id);
      },
      edge: (input, toNode, inputEdge, fromNode) => {
        const res = !!(
          fromNode &&
          toNode.id === activeNode.id &&
          isDataNode(fromNode)
        );
        return res;
      },
    });
    const edgesToRemoveById = groupBy(currentElementsToRemove.edges, 'id');
    const nodesToRemoveById = groupBy(currentElementsToRemove.nodes, 'id');

    // Figure out some shit from the incoming graph
    const { graph: incomingGraph } = shader.config;
    const outputFrag = incomingGraph.nodes.find(
      (node) => node.type === 'output' && node.stage === 'fragment'
    );
    const outputVert = incomingGraph.nodes.find(
      (node) => node.type === 'output' && node.stage === 'vertex'
    );
    const incomingOutEdge = incomingGraph.edges.find(
      (edge) => edge.to === outputFrag?.id
    );
    const incomingOutNode = incomingGraph.nodes.find(
      (n) => n.id === incomingOutEdge?.from
    );
    const incomingOutput = incomingOutNode?.outputs?.[0];

    const groupId = makeId();
    const filteredIncomingGraph: Graph = {
      nodes: incomingGraph.nodes
        // remove the output nodes from the incoming graph
        .filter((n) => n.id !== outputFrag?.id && n.id !== outputVert?.id)
        // and give all nodes the parent group id
        .map((n) => ({
          ...n,
          parentId: groupId,
        })),
      // remove any edges to the output nodes
      edges: incomingGraph.edges.filter(
        (e) => e.to !== outputFrag?.id && e.to !== outputVert?.id
      ),
    };

    // Connect our incoming graph's output contract node with our current
    // graph's active toNode input
    const newOutEdge =
      incomingOutNode && incomingOutput && currentToEdge && currentToNode
        ? makeEdge(
            // id, from, to, output, input, type
            makeId(),
            incomingOutNode.id,
            currentToNode.id,
            incomingOutput.id,
            currentToEdge.input,
            // See TODO in edge. These should be seprate fields on the edge
            (incomingOutNode as SourceNode).stage ||
              incomingOutNode.outputs?.[0]?.dataType
          )
        : null;

    const newGraph: Graph = {
      nodes: [
        ...graph.nodes.filter(
          (node) =>
            // Remove the currently selected node, which we're replacing
            !activeNodeIds.has(node.id) &&
            // And its friends
            !(node.id in nodesToRemoveById) &&
            // And its next stage node if present
            node.id !== otherActiveNode?.id
        ),
        ...filteredIncomingGraph.nodes,
      ],
      // And remove all their edges
      edges: [
        ...graph.edges.filter(
          (edge) =>
            edge.id !== currentToEdge?.id && !(edge.id in edgesToRemoveById)
        ),
        // And add in the incoming edges
        ...filteredIncomingGraph.edges,
        // Add the contract connector
        ...(newOutEdge ? [newOutEdge] : []),
      ],
    };

    const newFlowGraph = graphToFlowGraph(newGraph, onInputBakedToggle);

    setFlowElements(newFlowGraph);
    setGraph(newGraph);

    if (incomingOutNode) {
      setActiveNode(incomingOutNode as SourceNode);

      // Flakey: Select the node visually in the graph. Don't know why flakey
      // so added timeout
      setTimeout(() => {
        addSelectedNodes([incomingOutNode.id]);
      }, 100);
    }
    debouncedSetNeedsCompile(true);
  };

  const mouseRef = useRef<MouseData>({
    real: { x: 0, y: 0 },
    projected: { x: 0, y: 0 },
  });

  const onMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (reactFlowWrapper.current) {
      const { top, left } = reactFlowWrapper.current.getBoundingClientRect();
      mouseRef.current.real = {
        x: event.clientX - left,
        y: event.clientY - top,
      };
    }
  }, []);

  const setMenuPos = useEditorStore((state) => state.setMenuPosition);
  const menuPosition = useEditorStore((state) => state.menuPosition);

  const onMenuAdd = useCallback(
    (type: string) => {
      const pos = project(menuPosition as XYPosition);
      addNodeAtPosition(graph, type, '', pos);
      setMenuPos();
    },
    [graph, addNodeAtPosition, setMenuPos, project, menuPosition]
  );

  /**
   * Convenience compilation effect. This lets other callbacks update the
   * graph or flowElements however they want, and then set needsCompliation
   * to true, without having to worry about all the possible combinations of
   * updates of the parameters to compile()
   */
  useEffect(() => {
    if (needsCompile && !compiling) {
      compile(engine, ctx as EngineContext, graph, flowElements);
    }
  }, [compiling, needsCompile, flowElements, ctx, graph, compile, engine]);

  const onContainerClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!hasParent(event.target as HTMLElement, '#x-context-menu')) {
        setMenuPos();
      }
    },
    [setMenuPos]
  );

  // onEdgesChange is what applies the edge changes to the flow graph.
  const onEdgesDelete = useCallback(
    (edges: FlowEdge[]) => {
      const ids = edges.reduce<Record<string, boolean>>(
        (acc, e) => ({ ...acc, [e.id]: true }),
        {}
      );
      setGraph((graph) => ({
        ...graph,
        edges: graph.edges.filter((edge) => !(edge.id in ids)),
      }));
      setNeedsCompile(true);
    },
    [setGraph]
  );

  // Note if an edge is connected to this node, onEdgesDelete and onEdgesChange
  // both fire to update edges in the flow and core graph
  const onNodesDelete = useCallback(
    (nodes: FlowNode[]) => {
      const ids = nodes.reduce<Record<string, boolean>>(
        (acc, n) => ({ ...acc, [n.id]: true }),
        {}
      );
      setFlowElements(({ nodes, edges }) => ({
        nodes: nodes.filter((node) => !(node.id in ids)),
        edges,
      }));
      setGraph((graph) => ({
        ...graph,
        nodes: graph.nodes.filter((node) => !(node.id in ids)),
      }));
    },
    [setFlowElements, setGraph]
  );

  const saveOrFork = async (btnFork = false) => {
    if (!ctx || (!onUpdateShader && !onCreateShader)) {
      return;
    }
    setIsSaving(true);
    // TODO: These values like engine and bg all have their own state, vs
    // setShader() copies all those values
    const payload = {
      engine: engine.name,
      name: shader?.name,
      tags: [],
      description: shader?.description,
      visibility: shader?.visibility || 1,
      imageData: screenshotData,
      config: {
        graph: updateGraphFromFlowGraph(graph, flowElements),
        scene: sceneConfig,
      },
    };

    if (shader?.id && onUpdateShader && !isFork && !btnFork) {
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

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isLocal = window.location.href.indexOf('localhost') > 111;
  const editorElements = (
    <>
      {isSmallScreen ? null : isAuthenticated ? (
        <div className={cx(styles.tabControls, { [styles.col3]: isLocal })}>
          {saveError ? (
            <div className={cx(styles.errorPill, 'm-right-10')}>
              {saveError}
            </div>
          ) : null}
          <div className="m-right-15">
            {!shader.id || isFork ? null : (
              <button
                disabled={isSaving}
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
              disabled={isSaving}
              className="buttonauto formbutton size2"
              onClick={(e) => {
                e.preventDefault();
                saveOrFork();
              }}
            >
              {isFork ? 'Fork' : 'Save'}
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
          {editorTabIndex === 0 ? (
            <div className="secondary m-left-25 m-top-5">
              Double click nodes to edit GLSL!
            </div>
          ) : null}
        </TabGroup>
        <TabPanels>
          {/* Graph tab */}
          <TabPanel onMouseMove={onMouseMove} className={styles.growShrinkRows}>
            <SplitPane split="vertical" defaultSizes={[0.2, 0.8]}>
              <div
                className={cx(styles.splitInner, styles.vSplit, styles.vScroll)}
              >
                <GroupSearch
                  searchUrl={searchUrl}
                  engine={engine.name}
                  activeNode={activeNode}
                  onSelect={onSelectGroup}
                />
              </div>
              <div className={styles.splitInner} ref={reactFlowWrapper}>
                <FlowEditor
                  menuItems={menuItems}
                  mouse={mouseRef}
                  onMenuAdd={onMenuAdd}
                  onNodeValueChange={onNodeValueChange}
                  nodes={flowElements.nodes}
                  edges={flowElements.edges}
                  onConnect={onConnect}
                  onEdgeUpdate={onEdgeUpdate}
                  onEdgesChange={onEdgesChange}
                  onNodesChange={onNodesChange}
                  onNodesDelete={onNodesDelete}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onEdgesDelete={onEdgesDelete}
                  onConnectStart={onConnectStart}
                  onEdgeUpdateStart={onEdgeUpdateStart}
                  onEdgeUpdateEnd={onEdgeUpdateEnd}
                  onConnectEnd={onConnectEnd}
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
                      setActiveNode(node);
                      addSelectedNodes([node.id]);
                    }}
                    value={activeNode.id}
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
                  {activeNode.config?.properties?.length ||
                  activeNode.engine ? (
                    <div className={styles.infoMsg}>
                      Read-only: This node&apos;s source code is generated by{' '}
                      {engine.displayName}, and can&apos;t be edited directly.
                    </div>
                  ) : (
                    <button
                      className="buttonauto formbutton size2"
                      onClick={() =>
                        compile(
                          engine,
                          ctx as EngineContext,
                          graph,
                          flowElements
                        )
                      }
                    >
                      Compile
                    </button>
                  )}
                </div>
                <CodeEditor
                  engine={engine}
                  identity={activeNode.id}
                  defaultValue={activeNode.source}
                  onSave={() => {
                    compile(engine, ctx as EngineContext, graph, flowElements);
                  }}
                  onChange={(value, event) => {
                    if (value) {
                      (
                        graph.nodes.find(
                          ({ id }) => id === activeNode.id
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
                  node={activeNode}
                  graph={graph}
                  onSave={() =>
                    compile(engine, ctx as EngineContext, graph, flowElements)
                  }
                  onGraphChange={() => {
                    setGraph(graph);
                    setFlowElements(
                      graphToFlowGraph(graph, onInputBakedToggle)
                    );
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
                        Screenshot
                      </h2>
                      {screenshotData ? (
                        <img
                          src={screenshotData}
                          alt={`${shader.name} screenshot`}
                        />
                      ) : null}
                      <div className="m-top-15">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            takeScreenshot();
                          }}
                          className="buttonauto formbutton"
                        >
                          Update Screenshot
                        </button>
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
    <div
      className={cx(styles.editorContainer, {
        [styles.smallScreen]: isSmallScreen,
      })}
      onClick={onContainerClick}
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
        <SplitPane onChange={syncSceneSize} defaultSizes={defaultMainSplitSize}>
          <div className={styles.splitInner}>{editorElements}</div>
          {/* 3d display split */}
          <div ref={sceneWrapRef} className={styles.splitInner}>
            {sceneElements}
          </div>
        </SplitPane>
      )}
    </div>
  );
};

// Use React Flow Provider to get project(), to figure out the mouse position
// in the graph
const WithProvider = (props: EditorProps & EngineProps) => (
  <ReactFlowProvider>
    <Hoisty>
      <Editor {...props} />
    </Hoisty>
  </ReactFlowProvider>
);

export default WithProvider;
