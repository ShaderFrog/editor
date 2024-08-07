import cx from 'classnames';
import React from 'react';

import { EngineContext } from '@core/engine';
import { Strategy, StrategyType } from '@core/strategy';
import {
  SourceNode,
  SourceType,
  Graph,
  findLinkedNode,
  Backfillers,
} from '@core/graph';

import styles from '../styles/editor.module.css';

const sourceTypeText: Record<SourceType, any> = {
  Expression: (
    <>A GLSL expression. It will be inlined into other nodes exactly as is.</>
  ),
  'Function Body Fragment': (
    <>
      A snippet of code that&apos;s valid inside of a function body, but not at
      the top level scope.
    </>
  ),
  'Shader Program': <>A full shader program (default).</>,
};

const StrategyEditor = ({
  node,
  graph,
  onSave,
  onGraphChange,
  ctx,
}: {
  node: SourceNode;
  graph: Graph;
  onSave: () => void;
  onGraphChange: () => void;
  ctx?: EngineContext;
}) => {
  if (!ctx || !node.config) {
    return null;
  }
  const { inputs } = node;

  const handleSourceTypeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    node.sourceType = event.target.value as typeof node.sourceType;
  };

  const sibling = findLinkedNode(graph, node.id);

  const otherNodes = (stage: 'fragment' | 'vertex') => {
    return (
      <select
        name="strategy"
        className="select"
        value={sibling?.id}
        onChange={(e) => {
          const otherId = e.target.value;
          // TODO: Need to manipulate edges here to create link
          if (stage === 'vertex') {
          } else {
          }
          onSave();
        }}
      >
        <option>None</option>
        {graph.nodes
          .filter(
            (n) =>
              n.id !== node.id &&
              'stage' in n &&
              n.stage !== stage &&
              !node.engine
          )
          .map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} ({(n as SourceNode).stage})
            </option>
          ))}
      </select>
    );
  };

  const backfillers: Backfillers = node.backfillers || {};

  return (
    <>
      <div className={styles.uiGroup}>
        <div>
          <h2 className={styles.uiHeader}>Node Name</h2>
          <input
            className="textinput"
            type="text"
            value={node.name}
            onChange={(e) => {
              node.name = e.target.value;
              onGraphChange();
            }}
          ></input>
        </div>
      </div>

      <div className={styles.uiGroup}>
        <h2 className={styles.uiHeader}>Node Strategies</h2>
        <div className="secondary">
          A &quot;strategy&quot; is a searching function applied to your
          node&apos;s source code. The strategy finds parts of your GLSL program
          matching the strategy criteria, and makes them available in the graph
          as inputs to this node.
        </div>
        <h2 className={cx(styles.uiHeader, 'm-top-15')}>Current Strategies</h2>
        <div className={cx(styles.autocolmax, 'm-top-15')}>
          {node.config.strategies.map((strategy, index) => (
            <React.Fragment key={strategy.type}>
              <div>{strategy.type}</div>
              <div>
                <input
                  className="textinput"
                  type="text"
                  readOnly
                  value={JSON.stringify(strategy.config)}
                ></input>
              </div>
              <div>
                <button
                  className="buttonauto formbutton"
                  onClick={() => {
                    node.config.strategies = [
                      ...node.config.strategies.slice(0, index),
                      ...node.config.strategies.slice(index + 1),
                    ];
                    onSave();
                  }}
                >
                  &times; Remove Strategy
                </button>
              </div>
            </React.Fragment>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(
              new FormData(event.target as HTMLFormElement).entries()
            );
            node.config.strategies = [
              ...node.config.strategies,
              {
                type: data.strategy,
                config: JSON.parse(data.config as string),
              } as Strategy,
            ];
            onSave();
          }}
        >
          <h2 className={cx(styles.uiHeader, 'm-top-15')}>Add Strategy</h2>
          <div className={styles.colcolauto}>
            <div>
              <select name="strategy" className="select">
                {Object.entries(StrategyType).map(([name, value]) => (
                  <option key={name} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                className="textinput"
                type="text"
                name="config"
                defaultValue="{}"
              ></input>
            </div>
            <div>
              <button className="buttonauto formbutton" type="submit">
                Add
              </button>
            </div>
          </div>
        </form>
      </div>

      {node.stage ? (
        <div className={styles.uiGroup}>
          <h2 className={styles.uiHeader}>Linked Node</h2>
          <div className="secondary">
            Enable varyings to connect between vertex and fragment nodes. For
            vertex nodes, set which fragment node this vertex node, if any, is
            &quot;linked&quot; to. Without setting this, varyings are always
            renamed to be unique, so they won&apos;t have the same name as other
            nodes.
          </div>
          <div className={cx(styles.colcolauto, 'm-top-15')}>
            <div>{otherNodes(node.stage)}</div>
          </div>
        </div>
      ) : null}

      <div className={styles.uiGroup}>
        <h2 className={styles.uiHeader}>Source Code Type</h2>
        <div className="secondary m-bottom-25">
          What type of code is in this node.
        </div>
        {Object.values(SourceType).map((value) => (
          <div key={value} className="m-top-5">
            <label>
              <input
                type="radio"
                value={value}
                checked={node.sourceType === value || !node.sourceType}
                onChange={handleSourceTypeChange}
              />
              <b>{value}</b>
              <span className="secondary m-left-5">
                {sourceTypeText[value]}
              </span>
            </label>
          </div>
        ))}
      </div>

      <div className={styles.uiGroup}>
        <h2 className={styles.uiHeader}>Node Inputs ({inputs.length})</h2>
        <div className="secondary m-bottom-15">
          The names of the inputs found by the node strategies. For debugging
          only.
        </div>
        {inputs.length
          ? inputs.map((i) => (
              <div key={i.id} className={cx('divide-b-10')}>
                {backfillers[i.id] ? (
                  <form
                    className={cx('grid growGrowGrowShrink gap25')}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(
                        event.target as HTMLFormElement
                      );

                      (backfillers[i.id][0] = {
                        argType: data.get('argType') as string,
                        targetVariable: data.get('targetVariable') as string,
                      }),
                        onSave();
                    }}
                  >
                    <div>{i.id}</div>
                    <label>
                      Arg Type
                      <input
                        className="textinput m-top-10"
                        type="text"
                        defaultValue={backfillers[i.id][0].argType}
                      />
                    </label>
                    <label>
                      Target Variable
                      <input
                        className="textinput m-top-10"
                        type="text"
                        defaultValue={backfillers[i.id][0].targetVariable}
                      />
                    </label>
                    <div>
                      <button
                        className="buttonauto formbutton m-top-20"
                        onClick={(e) => {
                          e.preventDefault();
                          delete backfillers[i.id];
                          onSave();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </form>
                ) : (
                  <span className={cx('grid', 'growShrink', 'gap25')}>
                    <div>{i.id}</div>
                    <button
                      className="buttonauto formbutton"
                      onClick={() => {
                        node.backfillers = {
                          ...(node.backfillers || {}),
                          [i.id]: [{ argType: 'vec2', targetVariable: 'vUv' }],
                        };
                        onSave();
                      }}
                    >
                      Backfill
                    </button>
                  </span>
                )}
              </div>
            ))
          : 'No inputs found'}
      </div>
    </>
  );
};

export default StrategyEditor;
