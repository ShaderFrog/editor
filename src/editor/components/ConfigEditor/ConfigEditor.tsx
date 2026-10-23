import {
  BinaryNode,
  BinaryNodeType,
  binaryNodeType,
  binaryNodeTypes,
  GraphNode,
  NodeType,
  NumberNode,
  Vector2Node,
} from '@core/graph';
import ClearableInput from '../ClearableInput';
import LabeledInput from '../LabeledInput';
import React from 'react';

const vectorComponents = 'xyzw';

const replaceAt = (arr: string[], index: number, value: string) => {
  const copy = [...arr];
  copy[index] = value;
  return copy;
};

const Vector2ConfigEditor = ({
  node,
  onChange,
}: {
  node: Vector2Node;
  onChange: (data: Record<string, any>) => void;
}) => {
  const range = node.range || ['-1', '1', '-1', '1'];
  return (
    <div className="grid gap-s col2 m-top-10">
      {node.value.map((_, index) => (
        <div key={vectorComponents.charAt(index)}>
          <label className="label">
            {vectorComponents.charAt(index)} range
          </label>
          <div className="grid">
            <LabeledInput
              label="min"
              className="label-med"
              value={range[index * 2] as string}
              onChange={(event) => {
                onChange({
                  range: replaceAt(range, index * 2, '' + event.target.value),
                });
              }}
            />
            <LabeledInput
              label="max"
              className="label-med"
              value={range[index * 2 + 1] as string}
              onChange={(event) =>
                onChange({
                  range: replaceAt(
                    range,
                    index * 2 + 1,
                    '' + event.target.value
                  ),
                })
              }
            />
          </div>
        </div>
      ))}
      <label className="label">
        step
        <ClearableInput
          placeholder="Slider step increment. Requires range."
          value={node.stepper as string}
          onChange={(value) => onChange({ stepper: '' + value })}
        ></ClearableInput>
      </label>
      <label className="label">
        Lock x &amp; y
        <input
          className="checkbox"
          type="checkbox"
          checked={!!node.locked}
          onChange={(e) => onChange({ locked: e.target.checked })}
        ></input>
      </label>
    </div>
  );
};

const NumberConfigEditor = ({
  node,
  onChange,
}: {
  node: NumberNode;
  onChange: (data: Record<string, any>) => void;
}) => {
  return (
    <div className="grid gap-s col2 m-top-10">
      <label className="label">
        min
        <ClearableInput
          placeholder="Minimum value of range"
          value={node.range?.[0] as string}
          tooltip="Clear range"
          onClear={() => onChange({ range: undefined, stepper: undefined })}
          onChange={(value) =>
            onChange({
              range: [
                '' + value,
                typeof node.range?.[1] == 'string' ? node.range?.[1] : '1',
              ],
            })
          }
        ></ClearableInput>
      </label>
      <label className="label">
        max
        <ClearableInput
          placeholder="Maximum value of range"
          value={node.range?.[1] as string}
          tooltip="Clear range"
          onClear={() => onChange({ range: undefined, stepper: undefined })}
          onChange={(value) =>
            onChange({
              range: [
                typeof node.range?.[0] == 'string' ? node.range?.[0] : '0',
                '' + value,
              ],
            })
          }
        ></ClearableInput>
      </label>
      <label className="label">
        step
        <ClearableInput
          placeholder="Slider step increment. Requires min and max."
          value={node.stepper as string}
          onChange={(value) =>
            onChange({
              stepper: '' + value,
            })
          }
        ></ClearableInput>
      </label>
      <label className="label">
        random?
        <input
          className="checkbox"
          type="checkbox"
          checked={node.isRandom}
          onChange={(e) =>
            onChange({
              isRandom: e.target.checked,
            })
          }
        ></input>
      </label>
    </div>
  );
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const BinaryTypeEditor = ({
  node,
  onChangeBinaryNodeType,
}: {
  node: BinaryNode;
  onChangeBinaryNodeType: (type: BinaryNodeType) => void;
}) => {
  const currentType = binaryNodeType(node);
  return (
    <div className="grid col3 m-top-15">
      <label className="label">
        Change Node Type
        <select
          className="select"
          value=""
          onChange={(e) =>
            onChangeBinaryNodeType(e.target.value as BinaryNodeType)
          }
        >
          <option value="" disabled>
            {currentType ? capitalize(currentType) : 'Select a type'}
          </option>
          {binaryNodeTypes
            .filter((type) => type !== currentType)
            .map((type) => (
              <option key={type} value={type}>
                {capitalize(type)}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
};

const ConfigEditor = ({
  node,
  onChange,
  onChangeBinaryNodeType,
}: {
  node: GraphNode;
  onChange: (data: Record<string, any>) => void;
  onChangeBinaryNodeType: (type: BinaryNodeType) => void;
}) => {
  return (
    <>
      <label className="label">
        Node Name
        <input
          className="textinput"
          type="text"
          value={node.name}
          onChange={(e) => onChange({ name: e.target.value })}
        ></input>
      </label>
      {node.type === 'number' ? (
        <NumberConfigEditor node={node as NumberNode} onChange={onChange} />
      ) : node.type === 'vector2' ? (
        <Vector2ConfigEditor node={node as Vector2Node} onChange={onChange} />
      ) : node.type === NodeType.BINARY ? (
        <BinaryTypeEditor
          node={node as BinaryNode}
          onChangeBinaryNodeType={onChangeBinaryNodeType}
        />
      ) : null}
    </>
  );
};

export default ConfigEditor;
