import styles from '../styles/editor.module.css';
import bind from 'classnames/bind';
const cx = bind.bind(styles);

import { NodeRendererProps, Tree } from 'react-arborist';
import { useMemo } from 'react';

import { SplitPane } from '@andrewray/react-multi-split-pane';

import {
  Graph,
  SourceNode,
  findLinkedNode,
  ShaderStage,
  computeGrindex,
} from '@core/graph';

import { Engine, EngineContext } from '@core/engine';

import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import CodeEditor from './CodeEditor';

import { isMacintosh } from '@editor/util/platform';
import {
  PaneState,
  PaneType,
  useEditorStore,
  useGlslEditorTabIndex,
  useIsNodeIdOpen,
} from './flow/editor-store';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faCircleInfo,
  faClose,
  faCode,
  faGear,
  faLock,
} from '@fortawesome/free-solid-svg-icons';
import { capitalize } from '@/util/string';
import StrategyEditor from './StrategyEditor';
import { TreeProps } from 'react-arborist/dist/module/types/tree-props';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(glsl.editor)\x1b[0m', ...args);

const isReadOnly = (node: SourceNode) =>
  !!node?.config?.properties?.length || !!node?.engine;

/**
 * React-Arborist setup
 */
type TreeData = {
  id: string;
  nodeId: string;
  name: string;
  children?: TreeData[];
  type: PaneType;
  stage?: ShaderStage;
};

const TreeNode = ({
  node: treeNode,
  style,
  dragHandle,
}: NodeRendererProps<TreeData>) => {
  const node = treeNode.data;

  const { nodeId } = node;
  const { removeEditorTabPaneId, glslEditorTabs } = useEditorStore();

  const correspondingPane = glslEditorTabs.find((pane) => {
    const p = pane as PaneState;
    return p.contents?.nodeId === nodeId && p.contents?.type === node.type;
  });

  const opened = useIsNodeIdOpen(nodeId, node.type);

  return (
    <div
      style={style}
      ref={dragHandle}
      // Disabling opening/closing node trees for now
      // onClick={() => node.toggle()}
      className={cx(
        treeNode.isLeaf ? styles.treeLeaf : styles.treeFolder,
        node.stage === 'fragment'
          ? styles.treeFragment
          : node.stage === 'vertex'
          ? styles.treeVertex
          : styles.treeUnknown
      )}
    >
      {treeNode.isLeaf ? (
        <FontAwesomeIcon icon={faCode} className={styles.treeIcon} />
      ) : (
        <FontAwesomeIcon
          icon={treeNode.isOpen ? faGear : faChevronRight}
          className={styles.treeIcon}
        />
      )}
      {node.name}
      {opened ? (
        <span
          title="Close tab"
          className={styles.treeClose}
          onClick={(e) => {
            e.preventDefault();
            // Stop click from bubbling up to tab selection click!
            e.stopPropagation();
            removeEditorTabPaneId(correspondingPane!.id);
          }}
        >
          <FontAwesomeIcon icon={faClose} className="close" />
        </span>
      ) : null}
    </div>
  );
};

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

const findInTree = (
  trees: TreeData[],
  test: (test: TreeData) => boolean
): TreeData | undefined => {
  for (let node of trees) {
    if (test(node)) {
      return node;
    }
    if (node.children) {
      const found = findInTree(node.children, test);
      if (found) {
        return found;
      }
    }
  }
};

// Hard coded fake node IDs for the final output and fragment editor panes
const FINAL_VERTEX = 'output_vertex';
const FINAL_FRAGMENT = 'output_fragment';

const FileTree = (props: TreeProps<TreeData>) => {
  const { addEditorTab } = useEditorStore();
  return (
    <Tree
      disableDrag
      rowHeight={28}
      disableMultiSelection
      {...props}
      onSelect={(treeNodes) => {
        if (!treeNodes.length) {
          return;
        }
        // Warning: This gets called on mount! addEditorTab() is idempoent
        const treeNode = treeNodes[0];
        let node = treeNode?.data;

        if (node) {
          addEditorTab(
            node.nodeId,
            node.type === 'live_edit'
              ? 'live_edit'
              : treeNode.children?.length
              ? 'config'
              : 'code'
          );
        }
      }}
    >
      {TreeNode}
    </Tree>
  );
};

/**
 * GLSL Editor
 */
interface GlslEditorProps {
  engine: Engine;
  onCompile: () => void;
  onSaveOrFork: () => void;
  onGraphChange: () => void;
  setFragmentOverride: (value: string) => void;
  setVertexOverride: (value: string) => void;
}

const GlslEditor = ({
  engine,
  onCompile,
  onSaveOrFork,
  onGraphChange,
  setFragmentOverride,
  setVertexOverride,
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
    graph,
    engineContext,
  } = useEditorStore();
  const grindex = useMemo(() => computeGrindex(graph), [graph]);

  const codeEditorTabIndex = useGlslEditorTabIndex();

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
        treeNodes,
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
              {primaryNode?.config?.properties?.length ||
              primaryNode?.engine ? null : (
                <button
                  className="buttonauto formbutton size2"
                  onClick={() => onCompile()}
                  title={`${isMacintosh() ? `⌘-'` : `Ctrl+'`}`}
                >
                  Compile
                </button>
              )}
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
                    ? setVertexOverride
                    : setFragmentOverride;

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
                      engineContext!.runtime.cache.nodes[primaryNode.id]
                        ?.computedSource || primaryNode.source
                    }
                    readOnly={readOnly}
                    errors={nodeErrors[primaryNode.id]}
                    onSave={onSaveOrFork}
                    onCompile={onCompile}
                    onChange={(value) => {
                      updateGraphNode(primaryNode.id, { source: value });
                      // if (value) {
                      //   (grindex.nodes[primaryNode.id] as SourceNode).source =
                      //     value;
                      // }
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
