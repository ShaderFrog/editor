import styles from '../styles/editor.module.css';
import bind from 'classnames/bind';
const cx = bind.bind(styles);

import { NodeRendererProps, Tree } from 'react-arborist';
import { DndContext, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
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

import { Hoisty } from '../hoistedRefContext';

import { isMacintosh } from '@editor/util/platform';
import {
  PaneState,
  PaneType,
  useEditorStore,
  useGlslEditorTabIndex,
  useIsNodeIdOpen,
} from './flow/useEditorStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
  faClose,
  faCode,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { capitalize } from '@/util/string';
import StrategyEditor from './StrategyEditor';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(glsl.editor)\x1b[0m', ...args);

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
  const { removeEditorTabByNodeId, glslEditorActivePaneId, glslEditorTabs } =
    useEditorStore();

  // const activePane = glslEditorTabs.find(
  //   (tab) => tab.id === glslEditorActivePaneId
  // ) as PaneState | undefined;

  // const isSelected =
  //   node.type === activePane?.contents?.type &&
  //   node.nodeId === activePane?.contents?.nodeId;

  // const activeNodeId =
  //   activePane?.type === 'pane' ? activePane?.contents?.nodeId : undefined;

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
            removeEditorTabByNodeId(nodeId);
          }}
        >
          <FontAwesomeIcon icon={faClose} className="close" />
        </span>
      ) : null}
    </div>
  );
};

const nodeTabName = (node: SourceNode) => (
  <>
    <FontAwesomeIcon
      icon={faCode}
      className={cx(styles.tabIcon, {
        [styles.tabFragment]: node.stage === 'fragment',
        [styles.tabVertex]: node.stage === 'vertex',
      })}
    />
    {node.name}
    {'stage' in node ? (
      <span className={styles.tabAnnotation}>({capitalize(node.stage!)})</span>
    ) : (
      ''
    )}
  </>
);

/**
 * GLSL Editor
 */
interface GlslEditorProps {
  graph: Graph;
  engine: Engine;
  ctx: EngineContext;
  onCompile: () => void;
  onSaveOrFork: () => void;
  onGraphChange: () => void;
}

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

const GlslEditor = ({
  graph,
  engine,
  ctx,
  onCompile,
  onSaveOrFork,
  onGraphChange,
}: GlslEditorProps) => {
  const grindex = useMemo(() => computeGrindex(graph), [graph]);
  const {
    // glslEditorActiveNodeId,
    // setGlslEditorActiveNodeId,
    setGlslEditorActivePaneId,
    glslEditorActivePaneId,
    addEditorTab,
    glslEditorTabs,
    nodeErrors,
    removeEditorTabPaneId,
  } = useEditorStore();

  const codeEditorTabIndex = useGlslEditorTabIndex();

  const activePane = glslEditorTabs.find(
    (tab) => tab.id === glslEditorActivePaneId
  );

  const activeNodeId =
    activePane?.type === 'pane' ? activePane?.contents?.nodeId : undefined;
  const primaryNode = grindex.nodes[activeNodeId!] as SourceNode;

  const findPaneIdAtIndex = (index: number) => {
    const pane = glslEditorTabs[index];
    return pane.id;
  };

  // Calculate the left sidebar entries based on the graph nodes
  const treeData = useMemo(() => {
    const fragmentFolders = graph.nodes
      .filter(
        (node): node is SourceNode =>
          'stage' in node && node.stage === 'fragment'
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
          node.type === 'source' &&
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

  const topLevelVisiblePane = glslEditorTabs.find(
    (tab) => tab.id === glslEditorActivePaneId
  ) as PaneState;
  // const selectedTreeId =
  //   topLevelVisiblePane?.type === 'pane'
  //     ? topLevelVisiblePane?.contents?.type === 'config'
  //       ? `${topLevelVisiblePane.contents.nodeId}_folder`
  //       : topLevelVisiblePane.contents.nodeId
  //     : undefined;

  const treeNodes = Object.values(treeData);

  // console.log({ glslEditorActivePaneId, topLevelVisiblePane, selectedTreeId });
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
        <Tree
          disableDrag
          rowHeight={28}
          initialData={treeNodes}
          selection={selectedTreeId}
          disableMultiSelection
          onSelect={(treeNodes) => {
            if (!treeNodes.length) {
              return;
            }
            // Warning: This gets called on mount! addEditorTab is idempoent
            const treeNode = treeNodes[0];
            let node = treeNode?.data;

            if (node) {
              addEditorTab(
                node.nodeId,
                treeNode.children?.length ? 'config' : 'code'
              );
              // setGlslEditorActivePaneId(node.nodeId);
            }
          }}
        >
          {TreeNode}
        </Tree>
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
            {glslEditorTabs.map((pane) => (
              <Tab key={pane.id}>
                {pane.type === 'pane'
                  ? nodeTabName(
                      grindex.nodes[pane.contents.nodeId] as SourceNode
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
            ))}

            <div className={styles.tabControls}>
              {primaryNode?.config?.properties?.length ||
              primaryNode?.engine ? (
                <div className={styles.infoMsg}>
                  Read-only: This node&apos;s source code is generated by{' '}
                  {engine.displayName}, and can&apos;t be edited directly.
                </div>
              ) : (
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
            {glslEditorTabs.map((pane) => (
              <TabPanel
                key={pane.id}
                className={
                  (pane as PaneState).contents?.type === 'config'
                    ? 'y-scroll'
                    : ''
                }
              >
                {primaryNode ? (
                  (pane as PaneState).contents?.type === 'code' ? (
                    <CodeEditor
                      engine={engine}
                      identity={primaryNode.id}
                      defaultValue={primaryNode.source}
                      errors={nodeErrors[primaryNode.id]}
                      onSave={onSaveOrFork}
                      onCompile={onCompile}
                      onChange={(value) => {
                        if (value) {
                          (grindex.nodes[primaryNode.id] as SourceNode).source =
                            value;
                        }
                      }}
                    />
                  ) : (
                    <StrategyEditor
                      ctx={ctx}
                      node={primaryNode}
                      graph={graph}
                      onSave={onCompile}
                      onGraphChange={onGraphChange}
                    ></StrategyEditor>
                  )
                ) : (
                  <>
                    No node selected for activeNodeId &quot;{activeNodeId}
                    &quot;. This should not happen!
                  </>
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </div>
    </SplitPane>
  );
};

const GlslEditorWithProviders = (props: GlslEditorProps) => {
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
      <Hoisty>
        <GlslEditor {...props} />
      </Hoisty>
    </DndContext>
  );
};

export default GlslEditorWithProviders;
