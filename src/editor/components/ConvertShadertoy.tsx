import styles from '../styles/editor.module.css';
import cx from 'classnames';
import { useRef, useState } from 'react';

import { GraphNode, Edge, sourceNode, Graph } from '@core/graph';

import { Engine } from '@core/engine';

import { count, makeId } from '../../util/id';

import { linkNodes } from './useGraph';
import { texture2DStrategy, uniformStrategy } from '@core';
import { generate, parser } from '@shaderfrog/glsl-parser';
import { Program } from '@shaderfrog/glsl-parser/ast';
import preprocess from '@shaderfrog/glsl-parser/preprocessor';
import { useEditorStore } from './flow/editor-store';
import { graphToFlowGraph } from './flow/flow-helpers';

const ConvertShadertoy = ({
  engine,
  onImport,
}: {
  engine: Engine;
  onImport: () => void;
}) => {
  const {
    sceneConfig,
    setSceneConfig,
    graph,
    setGraph,
    setFlowNodes,
    setFlowEdges,
  } = useEditorStore();

  const [importError, setImportError] = useState<string | null>(null);
  const [importType, setImportType] = useState<'uv' | 'screen'>('uv');
  const [importName, setImportName] = useState('Shadertoy Import');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div>
      <h2 className={cx(styles.uiHeader)}>
        Import from Shadertoy (experimental)
      </h2>
      <p className="blerfiarie">
        Paste your Shadertoy code below. The following are <b>not</b> currently
        supported:
      </p>
      <ul className="blerfiarie">
        <li>Multiple buffers</li>
        <li>Mouse input</li>
        <li>Audio input</li>
      </ul>
      <div className="m-top-10">
        <label>
          Node Name
          <input
            type="text"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
          />
        </label>
      </div>
      <textarea
        ref={textAreaRef}
        className="textinput"
        placeholder="Paste your ShaderToy GLSL here"
      ></textarea>
      {importError ? (
        <div className={cx(styles.errored, `m-top-10`)}>{importError}</div>
      ) : null}
      <div className="m-top-10">
        <div className="grid col2 shrinkGrow gap25">
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="importType"
              checked={importType === 'uv'}
              onChange={(e) => setImportType('uv')}
            />
            UV Plane
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="importType"
              checked={importType === 'screen'}
              onChange={(e) => setImportType('screen')}
            />
            Screen
          </label>
        </div>
      </div>
      <div className="m-top-10">
        <button
          className="buttonauto formbutton size2"
          onClick={(e) => {
            e.preventDefault();
            setSceneConfig({
              ...sceneConfig,
              previewObject: 'plane',
            });
            let ast: Program;

            try {
              const value = textAreaRef.current!.value;
              ast = parser.parse(preprocess(value, {}));
              engine.importers.shadertoy.convertAst(ast, { importType });
            } catch (e) {
              console.error('Error importing shader', e);
              setImportError(
                'Error importing shader! Check the console log, and please use the link at the top right to file a bug.'
              );
              return;
            }

            const outputFrag = graph.nodes.find(
              (node) => node.type === 'output' && node.stage === 'fragment'
            )!;
            const outputVert = graph.nodes.find(
              (node) => node.type === 'output' && node.stage === 'vertex'
            )!;

            const c = count();
            const fragment = sourceNode(
              makeId(),
              importName || 'Shadertoy Import ' + c,
              { x: 0, y: 0 },
              {
                version: 2,
                preprocess: true,
                strategies: [uniformStrategy(), texture2DStrategy()],
                uniforms: [],
              },
              generate(ast),
              'fragment',
              engine.name
            );
            const vertex = sourceNode(
              makeId(),
              importName || 'Shadertoy Import ' + c,
              { x: 0, y: 299 },
              {
                version: 2,
                preprocess: true,
                strategies: [uniformStrategy()],
                uniforms: [],
              },
              engine.importers.shadertoy.code!.defaultShadertoyVertex,
              'vertex',
              engine.name
            );
            const [newEdges, newGns] = linkNodes(fragment, vertex);

            const newGraph: Graph = {
              nodes: graph.nodes.concat(newGns).flat(2),
              edges: graph.edges
                .filter(
                  (edge) =>
                    edge.to === outputFrag.id || edge.to === outputVert.id
                )
                .concat(newEdges)
                .flat(2),
            };

            const newFlowGraph = graphToFlowGraph(newGraph);

            setFlowNodes(newFlowGraph.nodes);
            setFlowEdges(newFlowGraph.edges);
            setGraph(newGraph);

            onImport();
          }}
          title="Import"
        >
          Import
        </button>
      </div>
    </div>
  );
};

export default ConvertShadertoy;
