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

import { Engine } from '@core/engine';

import { Tabs, Tab, TabGroup, TabPanel, TabPanels } from './tabs/Tabs';
import CodeEditor from './CodeEditor';

import { Hoisty } from '../hoistedRefContext';

import { isMacintosh } from '@editor/util/platform';
import { useEditorStore, useGlslEditorTabIndex } from './flow/useEditorStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faChevronRight,
  faClose,
  faCode,
} from '@fortawesome/free-solid-svg-icons';
import { capitalize } from '@/util/string';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(glsl.editor)\x1b[0m', ...args);

/**
 * React-Arborist setup
 */
type TreeData = {
  id: string;
  name: string;
  children?: TreeData[];
  stage?: ShaderStage;
};

const TreeNode = ({
  node: treeNode,
  style,
  dragHandle,
}: NodeRendererProps<TreeData>) => {
  const node = treeNode.data;

  const glslEditorNodeIds = useEditorStore((state) => state.glslEditorNodeIds);
  const glslEditorActiveNodeId = useEditorStore(
    (state) => state.glslEditorActiveNodeId
  );
  const { removeEditorTabByNodeId } = useEditorStore();
  const opened = glslEditorNodeIds.has(node.id);

  return (
    <div
      style={style}
      ref={dragHandle}
      // Disabling opening/closing node trees for now
      // onClick={() => node.toggle()}
      className={
        (glslEditorActiveNodeId !== node.id && opened ? 'opened' : '') +
        ' ' +
        cx(
          treeNode.isLeaf ? styles.treeLeaf : styles.treeFolder,
          node.stage === 'fragment'
            ? styles.treeFragment
            : node.stage === 'vertex'
            ? styles.treeVertex
            : styles.treeUnknown
        )
      }
    >
      {treeNode.isLeaf ? (
        <FontAwesomeIcon icon={faCode} className={styles.treeIcon} />
      ) : (
        <FontAwesomeIcon
          icon={treeNode.isOpen ? faChevronDown : faChevronRight}
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
            removeEditorTabByNodeId(node.id);
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
  onCompile: () => void;
  onSaveOrFork: () => void;
}

const GlslEditor = ({
  graph,
  engine,
  onCompile,
  onSaveOrFork,
}: GlslEditorProps) => {
  const grindex = useMemo(() => computeGrindex(graph), [graph]);
  const {
    glslEditorActiveNodeId,
    setGlslEditorActiveNodeId,
    addEditorTab,
    glslEditorTabs,
    nodeErrors,
    removeEditorTabPaneId,
  } = useEditorStore();

  const codeEditorTabIndex = useGlslEditorTabIndex();
  const primaryNode = grindex.nodes[glslEditorActiveNodeId!] as SourceNode;

  const findNodeIdAtIndex = (index: number) => {
    const pane = glslEditorTabs[index];
    if (pane?.type === 'pane') {
      return pane.contents.nodeId;
    }
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
            name: node.name,
            children: [
              {
                id: node.id,
                name: node.stage ? capitalize(node.stage) : node.name,
                stage: node.stage,
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
                name: stage ? capitalize(stage) : node.name,
                stage: (node as SourceNode).stage,
              }),
            },
          };
        }
        return {
          ...acc,
          [node.id]: {
            id: node.id,
            name: node.name,
            stage,
            children: [],
          },
        };
      }, fragmentFolders);
  }, [graph]);

  return (
    <SplitPane split="vertical" defaultSizes={[0.2]} minSize={200}>
      <div className={styles.treePanel}>
        <Tree
          rowHeight={28}
          initialData={Object.values(treeData)}
          selection={glslEditorActiveNodeId}
          disableMultiSelection
          onSelect={(treeNodes) => {
            if (!treeNodes.length) {
              return;
            }
            // Warning: This gets called on mount! addEditorTab is idempoent
            const treeNode = treeNodes[0];
            let node = treeNode?.data;

            // For now, if selecting a parent folder, select the first child
            // if (treeNode.children?.length) {
            //   node = treeNode.children[0].data;
            // }
            if (node) {
              addEditorTab(
                node.id,
                treeNode.children?.length ? 'config' : 'code'
              );
              setGlslEditorActiveNodeId(node.id);
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
            setGlslEditorActiveNodeId(findNodeIdAtIndex(idx));
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
              <TabPanel key={pane.id}>
                {primaryNode ? (
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
                  <>No node selected</>
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
