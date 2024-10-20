import { useCallback, useMemo } from 'react';
import { SplitPane } from '@andrewray/react-multi-split-pane';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faClose,
  faCode,
  faGear,
  faLock,
} from '@fortawesome/free-solid-svg-icons';

import {
  SourceNode,
  findLinkedNode,
  ShaderStage,
  computeGrindex,
} from '@core/graph';
import { Engine } from '@core/engine';
import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import CodeEditor from './CodeEditor';
import { isMacintosh } from '@editor/util/platform';
import {
  PaneState,
  PaneType,
  useEditorStore,
  useGlslEditorTabIndex,
} from './flow/editor-store';
import { capitalize } from '@/util/string';
import StrategyEditor from './StrategyEditor';
import debounce from 'lodash.debounce';
import { FileTree, findInTree, TreeData } from './FileTree';

import styles from '../styles/editor.module.css';
import bind from 'classnames/bind';
const cx = bind.bind(styles);

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(glsl.editor)\x1b[0m', ...args);

const isReadOnly = (node: SourceNode) =>
  !!node?.config?.properties?.length || !!node?.engine;

const tabName = (name: string, type: PaneType, stage: ShaderStage) => {
  const isConfig = type === 'config';
  const annotation = isConfig ? 'Config' : stage ? capitalize(stage) : '';
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
      {annotation ? (
        <span className={styles.tabAnnotation}>({annotation})</span>
      ) : (
        ''
      )}
    </>
  );
};

const nodeTabName = (node: SourceNode, type: PaneType) =>
  tabName(node.name, type, node.stage!);

// Hard coded fake node IDs for the final output and fragment editor panes
const FINAL_VERTEX = 'output_vertex';
const FINAL_FRAGMENT = 'output_fragment';

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
    nodeErrors,
    removeEditorTabPaneId,
    compileInfo,
    updateGraphNode,
    compileResult,
    setCompileResult,
    graph,
    engineContext,
  } = useEditorStore();
  const grindex = useMemo(() => computeGrindex(graph), [graph]);

  const codeEditorTabIndex = useGlslEditorTabIndex();

  const setVertexOverride = useCallback(
    (vertexResult: string) => {
      if (compileResult) {
        setCompileResult({
          ...compileResult,
          vertexResult,
        });
      }
    },
    [compileResult, setCompileResult]
  );
  const debouncedSetVertexOverride = useMemo(
    () => debounce(setVertexOverride, 1000),
    [setVertexOverride]
  );
  const setFragmentOverride = useCallback(
    (fragmentResult: string) => {
      if (compileResult) {
        setCompileResult({
          ...compileResult,
          fragmentResult,
        });
      }
    },
    [compileResult, setCompileResult]
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
  }, [graph]);

  const finalOutput: TreeData[] = [
    {
      id: FINAL_VERTEX,
      nodeId: FINAL_VERTEX,
      name: 'Vertex Output',
      type: 'live_edit',
    },
    {
      id: FINAL_FRAGMENT,
      nodeId: FINAL_FRAGMENT,
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
        <FileTree initialData={treeNodes} selection={selectedTreeId} />
        <FileTree
          className="m-top-25"
          initialData={finalOutput}
          selection={selectedTreeId}
        />
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
                <Tab key={pane.id}>
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
              <button
                className="buttonauto formbutton size2"
                onClick={() => onCompile()}
                title={`${isMacintosh() ? `⌘-'` : `Ctrl+'`}`}
              >
                Compile
              </button>
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
                    ? compileResult?.vertexResult
                    : compileResult?.fragmentResult;
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
                      value={result}
                      onChange={(value) => override(value)}
                    />
                  </div>
                );
              } else if (pane.contents?.type === 'code' && primaryNode) {
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
                    onCompile={onCompile}
                    onChange={(value) => {
                      updateGraphNode(primaryNode.id, { source: value });
                    }}
                  />
                );
                if (readOnly) {
                  tabContents = (
                    <div className={styles.shrinkGrowRows}>
                      <div className={cx(styles.readOnlyMsg, 'm-5')}>
                        <FontAwesomeIcon icon={faLock} />
                        Read-only: This node&apos;s source code is generated by{' '}
                        {engine.displayName}, and can&apos;t be edited directly.
                      </div>
                      {tabContents}
                    </div>
                  );
                }
              } else {
                tabContents = (
                  <StrategyEditor
                    node={primaryNode}
                    onSave={onCompile}
                    onGraphChange={onGraphChange}
                  ></StrategyEditor>
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
