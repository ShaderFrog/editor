import { GraphNode, NumberNode } from '@core/graph';
import ClearableInput from '../ClearableInput';

const ConfigEditor = ({
  node,
  onChange,
}: {
  node: GraphNode;
  onChange: (data: Record<string, any>) => void;
}) => {
  if (node.type === 'number') {
    const n = node as NumberNode;
    return (
      <>
        <label className="label">
          Node Name
          <input
            className="textinput"
            type="text"
            value={n.name}
            onChange={(e) => onChange({ name: e.target.value })}
          ></input>
        </label>
        <div className="grid gap-s col2 m-top-10">
          <label className="label">
            min
            <ClearableInput
              placeholder="Minimum value of range"
              value={n.range?.[0] as string}
              tooltip="Clear range"
              onClear={() => onChange({ range: undefined, stepper: undefined })}
              onChange={(value) =>
                onChange({
                  range: [
                    value,
                    typeof n.range?.[1] == 'string' ? n.range?.[1] : 1,
                  ],
                })
              }
            ></ClearableInput>
          </label>
          <label className="label">
            max
            <ClearableInput
              placeholder="Maximum value of range"
              value={n.range?.[1] as string}
              tooltip="Clear range"
              onClear={() => onChange({ range: undefined, stepper: undefined })}
              onChange={(value) =>
                onChange({
                  range: [
                    typeof n.range?.[0] == 'string' ? n.range?.[0] : 0,
                    value,
                  ],
                })
              }
            ></ClearableInput>
          </label>
          <label className="label">
            step
            <ClearableInput
              placeholder="Slider step increment. Requires min and max."
              value={n.stepper as string}
              onChange={(value) =>
                onChange({
                  stepper: value,
                })
              }
            ></ClearableInput>
          </label>
          <label className="label">
            random?
            <input
              className="checkbox"
              type="checkbox"
              checked={n.isRandom}
              onChange={(e) =>
                onChange({
                  isRandom: e.target.checked,
                })
              }
            ></input>
          </label>
        </div>
      </>
    );
  } else {
    return <>Not a number lol</>;
  }
};

export default ConfigEditor;
