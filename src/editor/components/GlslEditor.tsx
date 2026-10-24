import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SplitPane } from '@andrewray/react-multi-split-pane';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faClose,
  faCode,
  faGear,
  faLock,
  faBolt,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';

import {
  SourceNode,
  findLinkedNode,
  ShaderStage,
  computeGrindex,
  NodeErrors,
} from '@core/graph';
import { Engine } from '@core/engine';
import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import CodeEditor from './CodeEditor';
import SplitButton, { SplitButtonOption } from './SplitButton';
import { isMacintosh } from '@editor/util/platform';
import {
  PaneState,
  PaneType,
  useEditorStore,
  useGlslEditorTabIndex,
} from './flow/editor-store';
import { capitalize } from '@editor/util/string';
import NodeConfigEditor from './StrategyEditor';
import debounce from 'lodash.debounce';
import { FileTree, findInTree, TreeData } from './FileTree';

import styles from '../styles/editor.module.css';
import bind from 'classnames/bind';
import Link from 'next/link';
const cx = bind.bind(styles);

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(glsl.editor)\x1b[0m', ...args);

const isReadOnly = (node: SourceNode) =>
  !!node?.config?.properties?.length || !!node?.engine;

const tabName = (name: string, type: PaneType, stage: ShaderStage) => {
  const isConfig = type === 'config';
  const annotation = isConfig
    ? 'Conf'
    : stage
    ? stage === 'vertex'
      ? 'Vert'
      : 'Frag'
    : '';
  return (
    <>
      <FontAwesomeIcon
        icon={isConfig ? faGear : faCode}
        className={cx(
          styles.tabIcon,
          !isConfig && {
            [styles.tabFragment]: stage === 'fragment',
            [styles.tabVertex]: stage === 'vertex',
          }
        )}
      />
      {name}
      {/* {annotation ? (
        <span
          className={cx(styles.tabAnnotation, {
            [styles.fragAnnote]: !isConfig && stage === 'fragment',
            [styles.vertAnnote]: !isConfig && stage === 'vertex',
          })}
        >
          ({annotation})
        </span>
      ) : (
        ''
      )} */}
    </>
  );
};

// The node can be missing if a tab outlived its node, like after replacing the
// node in the graph. Show a placeholder rather than crash the editor.
const nodeTabName = (node: SourceNode | undefined, type: PaneType) =>
  node
    ? tabName(node.name, type, node.stage!)
    : tabName('Removed node', type, 'fragment');

// Hard coded fake node IDs for the final output and fragment editor panes
const FINAL_VERTEX = 'output_vertex';
const FINAL_FRAGMENT = 'output_fragment';

// When auto compiling, how long after the last keystroke to compile, and how
// long to wait before showing errors, so errors don't flash while typing
const AUTO_COMPILE_DELAY_MS = 1000;
const SHOW_ERRORS_DELAY_MS = 3000;

const COMPILE_MODE_OPTIONS: SplitButtonOption<boolean>[] = [
  {
    value: true,
    icon: faBolt,
    label: 'Auto',
    description: 'Compile as you type',
  },
  {
    value: false,
    icon: faPlay,
    label: 'Manual',
    description: 'Compile only when you click Compile',
  },
];

const AUTO_COMPILE_KEY = 'shaderfrog-auto-compile';
const NO_ERRORS: Record<string, NodeErrors> = {};

// Defaults to auto. localStorage can throw in private windows or be missing
// during server rendering.
const loadAutoCompile = () => {
  try {
    return window.localStorage.getItem(AUTO_COMPILE_KEY) !== 'false';
  } catch (e) {
    return true;
  }
};
const saveAutoCompile = (autoCompile: boolean) => {
  try {
    window.localStorage.setItem(AUTO_COMPILE_KEY, String(autoCompile));
  } catch (e) {}
};

/**
 * GLSL Editor
 */
interface GlslEditorProps {
  engine: Engine;
  onCompile: () => void;
  onSaveOrFork: () => void;
  onGraphChange: () => void;
}

const GlslEditor = ({
  engine,
  onCompile,
  onSaveOrFork,
  onGraphChange,
}: GlslEditorProps) => {
  const {
    setGlslEditorActivePaneId,
    glslEditorActivePaneId,
    glslEditorTabs,
    nodeErrors: allNodeErrors,
    removeEditorTabPaneId,
    compileInfo,
    setCompileInfo,
    updateGraphNode,
    renameGraphNode,
    compileResult,
    graph,
    engineContext,
    hideErrors,
    setHideErrors,
  } = useEditorStore();
  const grindex = useMemo(() => computeGrindex(graph), [graph]);

  const codeEditorTabIndex = useGlslEditorTabIndex();

  // Auto compile mode compiles while the user types, and hides errors until
  // they stop typing for a bit. Manual mode only compiles on request.
  const [autoCompile, setAutoCompile] = useState(true);
  useEffect(() => {
    setAutoCompile(loadAutoCompile());
  }, []);
  const compileTimer = useRef<ReturnType<typeof setTimeout>>();
  const showErrorsTimer = useRef<ReturnType<typeof setTimeout>>();

  const cancelTimers = useCallback(() => {
    clearTimeout(compileTimer.current);
    clearTimeout(showErrorsTimer.current);
  }, []);
  useEffect(
    () => () => {
      cancelTimers();
      setHideErrors(false);
    },
    [cancelTimers, setHideErrors]
  );

  // Compile right away, for the compile button and keyboard shortcut. This
  // cancels any pending auto compile and shows errors immediately.
  const compileNow = useCallback(() => {
    cancelTimers();
    setHideErrors(false);
    onCompile();
  }, [cancelTimers, onCompile, setHideErrors]);

  const onSourceChange = useCallback(
    (nodeId: string, source: string) => {
      updateGraphNode(nodeId, { source });
      if (!autoCompile) {
        return;
      }
      cancelTimers();
      setHideErrors(true);
      compileTimer.current = setTimeout(onCompile, AUTO_COMPILE_DELAY_MS);
      showErrorsTimer.current = setTimeout(
        () => setHideErrors(false),
        SHOW_ERRORS_DELAY_MS
      );
    },
    [autoCompile, cancelTimers, onCompile, setHideErrors, updateGraphNode]
  );

  const onAutoCompileChange = (value: boolean) => {
    setAutoCompile(value);
    saveAutoCompile(value);
    // Switching to manual drops a pending auto compile, but shows its errors
    if (!value) {
      cancelTimers();
      setHideErrors(false);
    }
  };

  const nodeErrors = hideErrors ? NO_ERRORS : allNodeErrors;
  const vertError = hideErrors ? null : compileInfo.vertError;
  const fragError = hideErrors ? null : compileInfo.fragError;

  const setVertexOverride = useCallback(
    (vertexShader: string) => {
      setCompileInfo({ vertexShader });
    },
    [setCompileInfo]
  );
  const debouncedSetVertexOverride = useMemo(
    () => debounce(setVertexOverride, 1000),
    [setVertexOverride]
  );
  const setFragmentOverride = useCallback(
    (fragmentShader: string) => {
      setCompileInfo({ fragmentShader });
    },
    [setCompileInfo]
  );
  const debouncedSetFragmentOverride = useMemo(
    () => debounce(setFragmentOverride, 1000),
    [setFragmentOverride]
  );

  const activePane = glslEditorTabs.find(
    (tab) => tab.id === glslEditorActivePaneId
  );

  const activeNodeId =
    activePane?.type === 'pane' && activePane?.contents?.type !== 'live_edit'
      ? activePane?.contents?.nodeId
      : undefined;
  const primaryNode = grindex.nodes[activeNodeId!] as SourceNode;

  const findPaneIdAtIndex = (index: number) => {
    const pane = glslEditorTabs[index];
    return pane.id;
  };

  // Calculate the file tree entries based on the graph nodes
  const treeData = useMemo(() => {
    const fragmentFolders = graph.nodes
      .filter(
        (node): node is SourceNode =>
          (node.type === 'source' || ('engine' in node && node.engine)) &&
          'stage' in node &&
          node.stage === 'fragment'
      )
      .reduce(
        (acc, node) => ({
          ...acc,
          [node.id]: {
            id: `${node.id}_folder`,
            nodeId: node.id,
            name: node.name,
            type: 'config' as PaneType,
            children: [
              {
                id: `${node.id}_${node.stage}`,
                errored: node.id in nodeErrors,
                nodeId: node.id,
                name: node.stage ? capitalize(node.stage) : node.name,
                stage: node.stage,
                type: 'code' as PaneType,
              },
            ],
          },
        }),
        {} as Record<string, TreeData>
      );

    return graph.nodes
      .filter(
        (node) =>
          (node.type === 'source' || ('engine' in node && node.engine)) &&
          (!('stage' in node) || node.stage !== 'fragment')
      )
      .reduce((acc, node) => {
        const linked = findLinkedNode(graph, node.id);
        const stage = 'stage' in node ? node.stage : undefined;
        if (linked && linked.id in acc) {
          return {
            ...acc,
            [linked.id]: {
              ...acc[linked.id],
              children: (acc[linked.id].children || []).concat({
                id: node.id,
                nodeId: node.id,
                name: stage ? capitalize(stage) : node.name,
                stage: (node as SourceNode).stage,
                type: 'code' as PaneType,
              }),
            },
          };
        }
        // Vertex nodes without a linked fragment node get their own folder,
        // so their config is reachable from the tree too
        if (stage) {
          return {
            ...acc,
            [node.id]: {
              id: `${node.id}_folder`,
              nodeId: node.id,
              name: node.name,
              type: 'config' as PaneType,
              children: [
                {
                  id: node.id,
                  nodeId: node.id,
                  name: capitalize(stage),
                  stage,
                  type: 'code' as PaneType,
                },
              ],
            },
          };
        }
        return {
          ...acc,
          [node.id]: {
            id: node.id,
            nodeId: node.id,
            name: node.name,
            type: 'code' as PaneType,
            stage,
            children: [],
          },
        };
      }, fragmentFolders);
  }, [graph, nodeErrors]);

  const finalOutput: TreeData[] = [
    {
      id: FINAL_VERTEX,
      nodeId: FINAL_VERTEX,
      errored: !!vertError,
      stage: 'vertex',
      name: 'Vertex Output',
      type: 'live_edit',
    },
    {
      id: FINAL_FRAGMENT,
      nodeId: FINAL_FRAGMENT,
      errored: !!fragError,
      stage: 'fragment',
      name: 'Fragment Output',
      type: 'live_edit',
    },
  ];

  const topLevelVisiblePane = glslEditorTabs.find(
    (tab) => tab.id === glslEditorActivePaneId
  ) as PaneState;

  const treeNodes = Object.values(treeData);

  const selectedTreeId = topLevelVisiblePane
    ? findInTree(
        [...treeNodes, ...finalOutput],
        (node) =>
          node.type === topLevelVisiblePane?.contents?.type &&
          node.nodeId === topLevelVisiblePane?.contents?.nodeId
      )?.id
    : undefined;

  return (
    <SplitPane split="vertical" defaultSizes={[0.2]} minSize={200}>
      <div className={styles.treePanel}>
        <div className={styles.labeledSection}>
          <h3>Module Browser</h3>
          <FileTree
            data={treeNodes}
            selection={selectedTreeId}
            onRename={({ node, name }) =>
              renameGraphNode(node.data.nodeId, name)
            }
          />
        </div>
        <div className={styles.labeledSection}>
          <h3>Compiled GLSL</h3>
          <FileTree data={finalOutput} selection={selectedTreeId} />
        </div>
      </div>
      <div className="wFull relative">
        {/* Monaco split */}
        <Tabs
          onTabSelect={(idx) => {
            setGlslEditorActivePaneId(findPaneIdAtIndex(idx));
          }}
          selected={codeEditorTabIndex}
          className={styles.shrinkGrowRows}
        >
          <TabGroup className={styles.tabBar}>
            {!glslEditorTabs.length ? (
              <span className="secondary p-5-10">
                Select a node on the left to get started!
              </span>
            ) : null}
            {glslEditorTabs.map((p) => {
              const pane = p as PaneState;
              return (
                <Tab
                  key={pane.id}
                  className={{
                    [styles.errored]:
                      pane.contents.nodeId in nodeErrors ||
                      (pane.contents.nodeId === FINAL_VERTEX && vertError) ||
                      (pane.contents.nodeId === FINAL_FRAGMENT && fragError),
                  }}
                >
                  {pane.contents.type === 'live_edit'
                    ? pane.contents.nodeId === FINAL_VERTEX
                      ? tabName('Vertex Output', 'live_edit', 'vertex')
                      : tabName('Fragment Output', 'live_edit', 'fragment')
                    : pane.type === 'pane'
                    ? nodeTabName(
                        grindex.nodes[pane.contents.nodeId] as SourceNode,
                        pane.contents.type
                      )
                    : 'Split'}
                  <span
                    title="Close tab"
                    onClick={(e) => {
                      e.preventDefault();
                      // Stop click from bubbling up to tab selection click!
                      e.stopPropagation();
                      removeEditorTabPaneId(pane.id);
                    }}
                  >
                    <FontAwesomeIcon icon={faClose} className="close" />
                  </span>
                </Tab>
              );
            })}

            <div className={styles.tabControls}>
              <SplitButton
                label={`Compile (${autoCompile ? 'Auto' : 'Manual'})`}
                title={`Compile (${isMacintosh() ? `⌘-'` : `Ctrl+'`})`}
                options={COMPILE_MODE_OPTIONS}
                selected={autoCompile}
                onSelect={onAutoCompileChange}
                onClick={compileNow}
              />
            </div>
          </TabGroup>
          <TabPanels>
            {glslEditorTabs.map((p) => {
              const pane = p as PaneState;
              let tabContents;

              if (pane.contents?.type === 'live_edit') {
                const error =
                  pane.contents.nodeId === FINAL_VERTEX
                    ? compileInfo.vertError
                    : compileInfo.fragError;
                const result =
                  pane.contents.nodeId === FINAL_VERTEX
                    ? compileInfo.vertexShader
                    : compileInfo.fragmentShader;
                const override =
                  pane.contents.nodeId === FINAL_VERTEX
                    ? debouncedSetVertexOverride
                    : debouncedSetFragmentOverride;

                tabContents = (
                  <div className={styles.shrinkGrowRows}>
                    <div>
                      <div className={cx(styles.readOnlyMsg, 'm-5')}>
                        <FontAwesomeIcon icon={faCircleInfo} />
                        This is the final generated GLSL code. You can edit the
                        code live, but it will be overwritten when you compile
                        the graph.
                      </div>

                      {error && (
                        <div className={styles.codeError} title={error}>
                          {(error || '').substring(0, 500)}
                        </div>
                      )}
                    </div>
                    <CodeEditor
                      engine={engine}
                      value={result || ''}
                      onChange={(value) => override(value)}
                    />
                  </div>
                );
              } else if (
                pane.contents?.type === 'code' &&
                primaryNode &&
                engineContext?.nodes
              ) {
                const readOnly = isReadOnly(primaryNode);
                tabContents = (
                  <CodeEditor
                    engine={engine}
                    identity={primaryNode.id}
                    defaultValue={
                      engineContext!.nodes[primaryNode.id]?.computedSource ||
                      primaryNode.source
                    }
                    readOnly={readOnly}
                    errors={nodeErrors[primaryNode.id]}
                    onSave={onSaveOrFork}
                    onCompile={compileNow}
                    onChange={(value) => onSourceChange(primaryNode.id, value)}
                  />
                );
                if (readOnly) {
                  tabContents = (
                    <div className={styles.shrinkGrowRows}>
                      <div className={cx(styles.readOnlyMsg, 'm-5')}>
                        <FontAwesomeIcon icon={faLock} />
                        Read-only: This node&apos;s source code is generated by{' '}
                        {engine.displayName}, and can&apos;t be edited directly.
                        <br />
                        <br />
                        You can experiment with full Three.js source code at the{' '}
                        <Link href="/shader-explorer" target="_blank">
                          Shader Explorer
                        </Link>
                        .
                      </div>
                      {tabContents}
                    </div>
                  );
                }
              } else {
                tabContents = (
                  <NodeConfigEditor
                    node={primaryNode}
                    onSave={compileNow}
                    onGraphChange={onGraphChange}
                  />
                );
              }
              return (
                <TabPanel
                  key={pane.id}
                  className={pane.contents?.type === 'config' ? 'y-scroll' : ''}
                >
                  {tabContents}
                </TabPanel>
              );
            })}
          </TabPanels>
        </Tabs>
      </div>
    </SplitPane>
  );
};

export default GlslEditor;
