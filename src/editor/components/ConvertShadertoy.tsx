import styles from '../styles/editor.module.css';
import cx from 'classnames';
import { useRef, useState } from 'react';

import { GraphNode, Edge, sourceNode } from '@core/graph';

import { Engine } from '@core/engine';

import { count, makeId } from '../../util/id';

import { linkNodes } from './useGraph';
import { texture2DStrategy, uniformStrategy } from '@/core';
import { generate, parser } from '@shaderfrog/glsl-parser';
import { Program } from '@shaderfrog/glsl-parser/ast';

const ConvertShadertoy = ({
  engine,
  onImport,
}: {
  engine: Engine;
  onImport: (n: GraphNode[], e: Edge[]) => void;
}) => {
  const [importError, setImportError] = useState<string | null>(null);
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
      <textarea
        ref={textAreaRef}
        className="textinput"
        placeholder="Paste your ShaderToy GLSL here"
      ></textarea>
      {importError ? (
        <div className={cx(styles.errored, `m-top-10`)}>{importError}</div>
      ) : null}
      <div className="m-top-10">
        <button
          className="buttonauto formbutton size2"
          onClick={(e) => {
            e.preventDefault();
            let ast: Program;

            try {
              const value = textAreaRef.current!.value;
              // SAD HACK to catch variables in preprocessor lines
              ast = parser.parse(
                value
                  .replace(/\biTime\b/g, 'time')
                  .replace(/\biResolution\b/g, 'renderResolution')
              );
              engine.importers.shadertoy.convertAst(ast);
            } catch (e) {
              console.error('Error importing shader', e);
              setImportError(
                'Error importing shader! Check the console log, and please use the link at the top right to file a bug.'
              );
              return;
            }

            const c = count();
            const fragment = sourceNode(
              makeId(),
              'Shadertoy Import ' + c,
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
              'Shadertoy Import ' + c,
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
            onImport(newGns, newEdges);
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
