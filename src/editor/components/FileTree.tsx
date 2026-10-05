import { NodeRendererProps, Tree } from 'react-arborist';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faClose,
  faCode,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { TreeProps } from 'react-arborist/dist/module/types/tree-props';

import { ShaderStage } from '@core/graph';
import {
  PaneState,
  PaneType,
  useEditorStore,
  useIsNodeIdOpen,
} from './flow/editor-store';

import styles from '../styles/editor.module.css';
import bind from 'classnames/bind';
const cx = bind.bind(styles);

/**
 * React-Arborist setup
 */
export type TreeData = {
  id: string;
  nodeId: string;
  name: string;
  children?: TreeData[];
  type: PaneType;
  stage?: ShaderStage;
  errored?: boolean;
};

export const TreeNode = ({
  node: treeNode,
  style,
  dragHandle,
}: NodeRendererProps<TreeData>) => {
  const node = treeNode.data;

  const { nodeId } = node;
  const { removeEditorTabPaneId, glslEditorTabs, addConfigEditorTab } =
    useEditorStore();

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
        node.errored ? styles.treeErrored : '',
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
      {treeNode.isEditing ? (
        <input
          autoFocus
          type="text"
          className={cx('textinput', styles.treeInput)}
          defaultValue={node.name}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const name = e.currentTarget.value.trim();
            name ? treeNode.submit(name) : treeNode.reset();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              // In case a blur fires as the input unmounts, don't commit
              e.currentTarget.value = node.name;
              treeNode.reset();
            }
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            if (treeNode.isEditable && treeNode.tree.props.onRename) {
              e.stopPropagation();
              treeNode.edit();
            }
          }}
        >
          {node.name}
        </span>
      )}
      <span className={styles.treeActions}>
        {treeNode.isLeaf && node.type === 'code' && node.stage ? (
          <span
            title={`Edit ${node.stage} configuration`}
            className={styles.treeConfig}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addConfigEditorTab(nodeId);
            }}
          >
            <FontAwesomeIcon icon={faGear} />
          </span>
        ) : null}
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
      </span>
    </div>
  );
};

export const findInTree = (
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

export const FileTree = (props: TreeProps<TreeData>) => {
  const { addEditorTab, addConfigEditorTab } = useEditorStore();
  return (
    <Tree
      disableDrag
      rowHeight={28}
      padding={0}
      disableMultiSelection
      // Only node names can be renamed, not the Fragment/Vertex stage leaves
      disableEdit={(data) => data.type === 'live_edit' || !!data.stage}
      {...props}
      onSelect={(treeNodes) => {
        if (!treeNodes.length) {
          return;
        }
        // Warning: This gets called on mount! addEditorTab() is idempoent
        const treeNode = treeNodes[0];
        let node = treeNode?.data;

        if (node) {
          if (node.type === 'live_edit') {
            addEditorTab(node.nodeId, 'live_edit');
          } else if (treeNode.children?.length) {
            addConfigEditorTab(node.nodeId);
          } else {
            addEditorTab(node.nodeId, 'code');
          }
        }
      }}
    >
      {TreeNode}
    </Tree>
  );
};
