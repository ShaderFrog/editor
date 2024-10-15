import styles from '../styles/editor.module.css';
import cx from 'classnames';

import { Node, useReactFlow } from 'reactflow';

import { Shader } from '@/editor/model';
import { useMemo, useState } from 'react';
import { computeGrindex, Graph, SourceNode } from '@/core';
import { FlowNodeSourceData } from './flow/FlowNode';

const log = (...args: any[]) =>
  console.log.call(console, '\x1b[37m(editor)\x1b[0m', ...args);

const MetadataEditor = ({
  graph,
  setGraph,
  flowNodes,
  shader,
  setShader,
  isOwnShader,
  isDeleting,
  onDeleteShader,
  takeScreenshot,
  screenshotData,
}: {
  graph: Graph;
  setGraph: React.Dispatch<React.SetStateAction<Graph>>;
  flowNodes: Node<any>[];
  shader: Shader;
  setShader: React.Dispatch<React.SetStateAction<Shader>>;
  isOwnShader?: boolean;
  onDeleteShader?: (shaderId: string) => Promise<void>;
  isDeleting?: boolean;
  takeScreenshot: () => void;
  screenshotData?: string;
}) => {
  const { getNode } = useReactFlow();
  const grindex = useMemo(() => computeGrindex(graph), [graph]);

  const [canDelete, setCanDelete] = useState(false);

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
      const orphanedEdgeIds = graph.edges
        .filter(
          (edge) => !(edge.to in grindex.nodes) || !(edge.from in grindex.nodes)
        )
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

  return (
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
          <img src={screenshotData} alt={`${shader.name} screenshot`} />
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
        <h2 className={cx(styles.uiHeader, 'm-top-25')}>Description</h2>
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
        <h2 className={cx(styles.uiHeader, 'm-top-25')}>Graph Integrity</h2>
        <div className="m-top-15">
          {graphIntegrity.length ? (
            <div>
              {graphIntegrity.map((t) => (
                <div className="errorText px12 m-top-5" key={t}>
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
                  onDeleteShader && onDeleteShader(shader.id!);
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
  );
};

export default MetadataEditor;
