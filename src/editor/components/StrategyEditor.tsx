import styles from '../styles/editor.module.css';

import cx from 'classnames';
import React from 'react';

import { EngineContext } from '@core/engine';

import { Strategy, StrategyType } from '@core/strategy';

import { SourceNode, SourceType } from '@core/graph';

const StrategyEditor = ({
  node,
  onSave,
  onGraphChange,
  ctx,
}: {
  node: SourceNode;
  onSave: () => void;
  onGraphChange: () => void;
  ctx?: EngineContext;
}) => {
  if (!ctx || !node.config) {
    return null;
  }
  const { inputs } = node;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    node.sourceType = event.target.value as typeof node.sourceType;
    onSave();
  };

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
        <div className="m-top-25 secondary">
          Node configuration. Define how Shaderfrog finds the inputs and outputs
          from the GLSL of this node.
        </div>
        <h2 className={cx(styles.uiHeader, 'm-top-15')}>Node Strategies</h2>
        <div className={styles.autocolmax}>
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
      <div className={styles.uiGroup}>
        <h2 className={styles.uiHeader}>Source Code Type</h2>
        {Object.values(SourceType).map((value) => (
          <label key={value}>
            <input
              type="radio"
              value={value}
              checked={node.sourceType === value}
              onChange={handleChange}
            />
            {value}
          </label>
        ))}
      </div>

      <div className={styles.uiGroup}>
        <h2 className={styles.uiHeader}>Node Inputs</h2>
        {inputs.length ? inputs.map((i) => i.id).join(', ') : 'No inputs found'}
      </div>
    </>
  );
};

export default StrategyEditor;
