import cx from 'classnames';
import React, { useState } from 'react';

import {
  AssignmentToStrategy,
  DeclarationOfStrategy,
  InjectStrategy,
  NamedAttributeStrategy,
  Strategy,
  StrategyType,
  UniformStrategy,
} from '@core/strategy';
import {
  SourceNode,
  SourceType,
  findLinkedNode,
  Backfillers,
} from '@core/graph';

import styles from '../styles/editor.module.css';
import { useEditorStore } from './flow/editor-store';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons';

type StrategyEditorProps<T extends { config: any } = any> = {
  config: T['config'];
  onChange: (config: T['config']) => void;
};

const VariableStrategyEditor = () => {
  return (
    <div className="secondary m-bottom-15">
      Mark <b>any</b> variable as replaceable. Warning: Creates many inputs!
    </div>
  );
};

const TextureStrategyEditor = () => {
  return (
    <div className="secondary m-bottom-15">
      Replace any call to <code>texture2D()</code>
    </div>
  );
};

const UniformStrategyEditor = () => {
  return (
    <div className="secondary m-bottom-15">Make any uniform replaceable.</div>
  );
};

const AssignmentToStrategyEditor = ({
  config,
  onChange,
}: StrategyEditorProps<AssignmentToStrategy>) => {
  return (
    <div>
      <div className="secondary m-bottom-15">
        Replace what is assigned to a varaible, at the Nth occurrence it is
        assigned to.
      </div>
      <label>
        Variable Name
        <input
          className="textinput"
          type="text"
          value={config.assignTo}
          onChange={(e) => onChange({ ...config, assignTo: e.target.value })}
        ></input>
      </label>
      <label className="block m-top-5">
        Nth
        <input
          className="textinput"
          type="number"
          step="1"
          value={config.nth}
          onChange={(e) =>
            onChange({ ...config, nth: parseInt(e.target.value, 10) })
          }
        ></input>
      </label>
    </div>
  );
};

const DeclarationOfStrategyEditor = ({
  config,
  onChange,
}: StrategyEditorProps<DeclarationOfStrategy>) => {
  return (
    <div>
      <div className="secondary m-bottom-15">
        Replace what is assigned to a varaible, when it is declared.
      </div>
      <label>
        Variable Name
        <input
          className="textinput"
          placeholder="normal"
          type="text"
          value={config.declarationOf}
          onChange={(e) =>
            onChange({ ...config, declarationOf: e.target.value })
          }
        ></input>
      </label>
    </div>
  );
};

const NamedAttributeStrategyEditor = ({
  config,
  onChange,
}: StrategyEditorProps<NamedAttributeStrategy>) => {
  return (
    <div>
      <div className="secondary m-bottom-15">
        Replace an attribute passed into a shader.
      </div>
      <label>
        Attribute Name
        <input
          className="textinput"
          type="text"
          value={config.attributeName}
          onChange={(e) =>
            onChange({ ...config, attributeName: e.target.value })
          }
        ></input>
      </label>
    </div>
  );
};

const InjectStrategyEditor = ({
  config,
  onChange,
}: StrategyEditorProps<InjectStrategy>) => {
  return (
    <div>
      <div className="secondary m-bottom-15">
        Equivalent of a string find and replace. Searches for a source code line
        matching your search, and inserts the replacement before, after, or
        replaces it.
      </div>
      <label>
        Find
        <input
          placeholder="Source code to find"
          className="textinput"
          type="text"
          value={config.find}
          onChange={(e) => onChange({ ...config, find: e.target.value })}
        ></input>
      </label>
      <label className="m-top-5 block">
        Insert
        <select
          className="select"
          value={config.insert}
          onChange={(e) =>
            onChange({
              ...config,
              insert: e.target.value as 'replace' | 'before' | 'after',
            })
          }
        >
          <option value="before">Before</option>
          <option value="after">After</option>
          <option value="replace">Replace</option>
        </select>
      </label>
      <label className="m-top-5 block">
        Nth
        <input
          className="textinput"
          type="number"
          step="1"
          value={config.count}
          onChange={(e) =>
            onChange({ ...config, count: parseInt(e.target.value, 10) })
          }
        ></input>
      </label>
    </div>
  );
};

const strategyEditors: {
  [key in StrategyType]?: React.FC<StrategyEditorProps>;
} = {
  [StrategyType.VARIABLE]: VariableStrategyEditor,
  [StrategyType.TEXTURE_2D]: TextureStrategyEditor,
  [StrategyType.UNIFORM]: UniformStrategyEditor,
  [StrategyType.ASSIGNMENT_TO]: AssignmentToStrategyEditor,
  [StrategyType.DECLARATION_OF]: DeclarationOfStrategyEditor,
  [StrategyType.NAMED_ATTRIBUTE]: NamedAttributeStrategyEditor,
  [StrategyType.INJECT]: InjectStrategyEditor,
};

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
  onSave,
  onGraphChange,
}: {
  node: SourceNode;
  onSave: () => void;
  onGraphChange: () => void;
}) => {
  const { graph, engineContext } = useEditorStore();

  const [selectedStrategy, setSelectedStrategy] = useState(
    StrategyType.VARIABLE
  );
  const [strategyConfig, setStrategyConfig] = useState({});
  const StrategyEditor = strategyEditors[selectedStrategy];

  if (!engineContext || !node.config) {
    return null;
  }
  const { inputs } = node;

  const handleSourceTypeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    node.sourceType = event.target.value as typeof node.sourceType;
    // With an expression it can be any type - so remove the type, otherwise
    // assume main function with vec4 output
    node.outputs[0].dataType =
      node.sourceType === 'Expression' ? undefined : 'vector4';
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
                  className="buttonauto formbutton secondary"
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
                config: strategyConfig,
              } as Strategy,
            ];
            onSave();
          }}
        >
          <h2 className={cx(styles.uiHeader, 'm-top-15')}>Add Strategy</h2>
          <div className={cx('grid col2 gap50')}>
            <div>
              <select
                name="strategy"
                className="select"
                value={selectedStrategy}
                onChange={(e) =>
                  setSelectedStrategy(e.target.value as StrategyType)
                }
              >
                {Object.entries(StrategyType)
                  .filter(([name]) => name !== 'HARD_CODE_INPUTS')
                  .map(([name, value]) => (
                    <option key={name} value={value}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              {StrategyEditor ? (
                <StrategyEditor
                  config={strategyConfig}
                  onChange={setStrategyConfig}
                />
              ) : null}

              <button className="buttonauto formbutton m-top-15 " type="submit">
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
          Inputs found by the node strategies. You can backfill any of these
          inputs, or remove them.
        </div>
        {inputs.length
          ? inputs.map((i) => (
              <div key={i.id} className={cx('divide-b-10')}>
                <div
                  className={cx(
                    'grid gap25',
                    backfillers[i.id] ? 'growGrowShrink' : 'growShrinkShrink'
                  )}
                >
                  <div>{i.id}</div>
                  {backfillers[i.id] ? (
                    <form
                      className={cx('grid growGrowShrink gap25')}
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
                          className="buttonauto formbutton secondary m-top-20"
                          onClick={(e) => {
                            e.preventDefault();
                            delete backfillers[i.id];
                            onSave();
                          }}
                        >
                          Unbackfill
                        </button>
                      </div>
                    </form>
                  ) : (
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
                  )}
                  <div className="flexEnd">
                    <FontAwesomeIcon
                      title="Delete input"
                      icon={faCircleXmark}
                      className={styles.inlineClose}
                      onClick={() => {
                        node.inputs = node.inputs.filter(
                          ({ id }) => id !== i.id
                        );
                        onSave();
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          : 'No inputs found'}
      </div>
    </>
  );
};

export default StrategyEditor;
