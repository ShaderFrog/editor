import React, { memo, MouseEventHandler, useMemo } from 'react';
import classnames from 'classnames/bind';
import groupBy from 'lodash.groupby';
import { Handle, Position } from 'reactflow';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faRightLong,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';

import {
  ShaderStage,
  GraphDataType,
  Vector2,
  Vector3,
  Vector4,
  InputCategory,
  LinkHandle,
} from '@core/graph';

import { ChangeHandler, useFlowEventHack } from '../../flowEventHack';
import { replaceAt } from '@editor/util/replaceAt';
import { useFlowEditorContext } from '@editor/editor/flowEditorContext';
import { useFlowGraphContext } from '@editor/editor/flowGraphContext';
import { useEditorStore } from './FlowEditor';
import { useAssetsAndGroups } from '@editor/api';

import styles from './flownode.module.css';
const cx = classnames.bind(styles);

const headerHeight = 30;
const labelHeight = 44;
const inputHeight = 22;
const outputHandleTopWithLabel = 38;
const INPUT_LABEL_START_OFFSET = 4;
// If there are no labeled input sections, move the output handle top higher up
const outputHandleTopWithoutLabel = 24;

export type InputNodeHandle = {
  name: string;
  id: string;
  type: string;
  dataType?: GraphDataType;
  validTarget: boolean;
  connected: boolean;
  accepts?: InputCategory[];
  baked?: boolean;
  bakeable: boolean;
};

type OutputNodeHandle = {
  validTarget: boolean;
  connected: boolean;
  category?: InputCategory;
  id: string;
  name: string;
};

export const flowOutput = (name: string, id?: string): OutputNodeHandle => ({
  connected: false,
  validTarget: false,
  id: id || name,
  name,
});

export interface CoreFlowNode {
  label: string;
  ghost?: boolean;
  outputs: OutputNodeHandle[];
  inputs: InputNodeHandle[];
}
export interface FlowNodeDataData extends CoreFlowNode {
  type: GraphDataType;
  value: any;
  config: Record<string, any>;
}
export interface FlowNodeSourceData extends CoreFlowNode {
  stage?: ShaderStage;
  category?: InputCategory;
  active: boolean;
  /**
   * Whether or not this node can be used for both shader fragment and vertex
   */
  biStage: boolean;
  glslError?: boolean;
}
export type FlowNodeData = FlowNodeSourceData | FlowNodeDataData;

const showPosition = (id: any, xPos: number, yPos: number) =>
  window.location.search.indexOf('debug') > -1 ? (
    <>
      ({id}) {Math.round(xPos)}, {Math.round(yPos)}
    </>
  ) : null;

// interface NodeProp {
//   nodeId: string;
// }
// interface CustomHandleProps extends HandleProps, NodeProp {}

// const CustomHandle = ({ nodeId, id, handleIndex, ...props }: any) => {
//   // const updateNodeInternals = useUpdateNodeInternals();
//   // useEffect(() => {
//   //   // Hack for handle updating
//   //   setTimeout(() => {
//   //     updateNodeInternals(nodeId);
//   //   }, 0);
//   // }, [nodeId, updateNodeInternals, handleIndex, id]);

//   return <Handle id={id} {...props} />;
// };

// const computeIOKey = (arr: NodeHandle[]) => arr.map((a) => a.name).join(',');

const InputHandle = ({
  input,
  top,
  onClick,
}: {
  input: InputNodeHandle;
  top: number;
  onClick?: MouseEventHandler<HTMLDivElement>;
}) => (
  <Handle
    key={input.id}
    isConnectable
    id={input.id}
    type="target"
    className={cx({
      validTarget: input.validTarget,
      connected: input.connected,
    })}
    position={Position.Left}
    style={{
      top: `${top}px`,
    }}
  >
    <div className="react-flow_handle_label">
      {input.bakeable ? (
        <div
          className={cx('switch', { baked: input.baked })}
          title={
            input.baked
              ? 'This input is currently hard coded into the shader source code. Switch it to a property of the material?'
              : 'This input is currently a property of the material. Switch it to a value hard coded in the shader source code?'
          }
          onClick={onClick}
        >
          {input.baked ? (
            <FontAwesomeIcon icon={faTerminal} />
          ) : (
            <FontAwesomeIcon icon={faRightLong} />
          )}
        </div>
      ) : null}
      {input.name}
      {input.dataType ? (
        <span className={styles.dataType}>{input.dataType}</span>
      ) : null}
    </div>
  </Handle>
);

const FlowWrap = ({
  children,
  data,
  height,
  className,
}: {
  children: React.ReactNode;
  height?: number;
  data: FlowNodeData;
  className: any;
}) => (
  <div
    className={cx('flownode', className, { ghost: data.ghost })}
    style={{
      height:
        height ||
        `${
          (data as any).type === 'texture'
            ? 210
            : outputHandleTopWithLabel +
              Math.min(Math.max(data.inputs.length, 1) * inputHeight, 100)
        }px`,
      zIndex: 0,
    }}
  >
    <div className="contents">{children}</div>
  </div>
);

const vectorComponents = 'xyzw';
const VectorEditor = ({
  id,
  data,
  onChange,
}: {
  id: string;
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => {
  const onComponentChange = (component: number, n: string) => {
    onChange(id, replaceAt(data.value, component, n));
  };
  return (
    <div className={styles.grid}>
      {(data.value as Vector2 | Vector3 | Vector4).map((_, index) => (
        <div key={index}>
          <label className={styles.vectorLabel}>
            {vectorComponents.charAt(index)}
            <input
              className="nodrag"
              type="text"
              onChange={(e) => onComponentChange(index, e.currentTarget.value)}
              value={data.value[index]}
            />
          </label>
        </div>
      ))}
    </div>
  );
};

const componentToHex = (c: number) => {
  var hex = (c * 255).toString(16);
  return hex.length == 1 ? '0' + hex : hex;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        (parseInt(result[1], 16) / 255).toString(),
        (parseInt(result[2], 16) / 255).toString(),
        (parseInt(result[3], 16) / 255).toString(),
      ]
    : [];
};

const colorComponents = 'rgba';
const ColorEditor = ({
  id,
  data,
  onChange,
}: {
  id: string;
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => {
  const value = data.value as Vector3 | Vector4;
  const onComponentChange = (component: number, n: string) => {
    onChange(id, replaceAt(value, component, n));
  };
  return (
    <div className={styles.grid}>
      <div>
        <label className={styles.vectorLabel}>
          rgb
          <div>
            <input
              type="color"
              value={rgbToHex(
                parseFloat(value[0]),
                parseFloat(value[1]),
                parseFloat(value[2])
              )}
              onChange={(e) => {
                onChange(id, hexToRgb(e.target.value));
              }}
            />
          </div>
        </label>
      </div>
      {value.map((_, index) => (
        <div key={index}>
          <label className={styles.vectorLabel}>
            {colorComponents.charAt(index)}
            <input
              className="nodrag"
              type="text"
              onChange={(e) => onComponentChange(index, e.currentTarget.value)}
              value={value[index]}
            />
          </label>
        </div>
      ))}
    </div>
  );
};

const NumberEditor = ({
  id,
  data,
  onChange,
}: {
  id: string;
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => (
  <>
    <input
      className="nodrag"
      type="text"
      onChange={(e) => onChange(id, e.currentTarget.value)}
      value={data.value}
    />
    <input
      className="nodrag"
      type="range"
      min={data.config.range?.[0] || '0'}
      max={data.config.range?.[1] || '1'}
      step={data.config.stepper || '0.001'}
      onChange={(e) => onChange(id, e.currentTarget.value)}
      value={data.value}
    ></input>
  </>
);

const textures: Record<'texture' | 'samplerCube', [string, string][]> = {
  texture: [
    ['grayscale-noise', 'Grayscale Noise'],
    ['patternedBrickDiff', 'Brown Bricks'],
    ['patternedBrickNormal', 'Brown Bricks Normal'],
    ['patternedBrickDisplacement', 'Brown Bricks Displacement'],
    ['brick', 'Red Bricks'],
    ['brickNormal', 'Red Brick Normal Map'],
    ['pebbles', 'Pebbbles'],
    ['pebblesNormal', 'Pebbbles Normal Map'],
    ['pebblesBump', 'Pebbbles Bump Map'],
    ['testNormal', 'Test Normal Map'],
    ['testBump', 'Test Bump Map'],
    ['threeTone', 'Three Tone'],
    ['explosion', 'Yellow Gradient'],
  ],
  samplerCube: [
    ['warehouseEnvTexture', 'Warehouse Env Map'],
    ['pondCubeMap', 'Pond Cube Map'],
    ['cubeCamera', 'Cube Camera'],
  ],
};

const TextureEditor = ({
  id,
  data,
  onChange,
}: {
  id: string;
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => {
  const { assets } = useAssetsAndGroups();
  console.log('assets', assets);
  const { openTextureBrowser } = useEditorStore();
  return (
    <div className={styles.textureSelect} onClick={openTextureBrowser}>
      {data.value in assets ? (
        // TODO: NEED TO PICK THE RIGHT VERSION HERE
        <img
          src={assets[data.value].versions[0].thumbnail}
          alt={assets[data.value].name}
          style={{ height: '128px' }}
        />
      ) : null}
      <div className={cx('flexcenter', styles.textureBtn)}>
        Choose a texture
      </div>
    </div>
  );
  /* <select
        className="nodrag select"
        style={{ width: '100%' }}
        onChange={(e) => onChange(id, e.currentTarget.value)}
        value={data.value}
      >
        <option>Choose a texture</option>
        {textures.texture.map((t) => (
          <option key={t[0]} value={t[0]}>
            {t[1]}
          </option>
        ))}
        {Object.values(assets).map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.subtype ? ` (${a.subtype})` : null}
          </option>
        ))}
      </select> */
};

const SamplerEditor = ({
  id,
  data,
  tex,
  onChange,
}: {
  id: string;
  tex: (typeof textures)['samplerCube'];
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => (
  <>
    <select
      className="nodrag select"
      style={{ width: 'auto' }}
      onChange={(e) => onChange(id, e.currentTarget.value)}
      value={data.value}
    >
      {tex.map((t) => (
        <option key={t[0]} value={t[0]}>
          {t[1]}
        </option>
      ))}
    </select>
  </>
);

const DataNodeComponent = memo(
  ({
    id,
    data,
    xPos,
    yPos,
  }: {
    id: string;
    data: FlowNodeDataData;
    xPos: number;
    yPos: number;
  }) => {
    const onChange = useFlowEventHack();
    const { openNodeContextMenu } = useFlowEditorContext();

    return (
      <FlowWrap data={data} className={cx('flow-node_data', data.type)}>
        <div className="flowlabel">
          <div className="title">
            {data.label}
            {showPosition(id, xPos, yPos)}
          </div>
          <div className="dataType">{data.type}</div>
          <button
            className="nodeConfig"
            onClick={(e) => {
              e.preventDefault();
              openNodeContextMenu?.(id);
            }}
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>
        <div className="flowInputs">
          {data.inputs.map((input, index) => (
            <InputHandle
              key={input.id}
              input={input}
              top={outputHandleTopWithLabel + index * inputHeight}
            />
          ))}
        </div>

        <div className="body">
          {data.type === 'number' ? (
            <NumberEditor id={id} data={data} onChange={onChange} />
          ) : data.type === 'array' ||
            data.type === 'vector2' ||
            data.type === 'vector3' ||
            data.type === 'vector4' ? (
            <VectorEditor id={id} data={data} onChange={onChange} />
          ) : data.type === 'rgb' || data.type === 'rgba' ? (
            <ColorEditor id={id} data={data} onChange={onChange} />
          ) : data.type === 'texture' ? (
            <TextureEditor id={id} data={data} onChange={onChange} />
          ) : data.type === 'samplerCube' ? (
            <SamplerEditor
              id={id}
              data={data}
              onChange={onChange}
              tex={textures.samplerCube}
            />
          ) : (
            <div>NOOOOOO FlowNode for {data.type}</div>
          )}
        </div>

        <div className={styles.outputs}>
          {data.outputs.map((output, index) => (
            <Handle
              key={output.name}
              isConnectable
              id={output.id}
              className={cx({
                validTarget: output.validTarget,
                connected: output.connected,
              })}
              type="source"
              position={Position.Right}
              style={{
                top: `${outputHandleTopWithLabel + index * inputHeight}px`,
              }}
            >
              <div
                className={cx('react-flow_handle_label', styles.outputLabel)}
              >
                {output.name}
              </div>
            </Handle>
          ))}
        </div>
      </FlowWrap>
    );
  }
);
DataNodeComponent.displayName = 'DataNodeComponent';

const SourceNodeComponent = memo(
  ({
    id,
    data,
    xPos,
    yPos,
  }: {
    xPos: number;
    yPos: number;
    id: string;
    data: FlowNodeSourceData;
  }) => {
    const { onInputBakedToggle, jumpToError } = useFlowGraphContext();
    const { openNodeContextMenu } = useFlowEditorContext();
    // const updateNodeInternals = useUpdateNodeInternals();
    // const key = `${computeIOKey(data.inputs)}${computeIOKey(data.outputs)}`;

    // useEffect(() => {
    //   console.log('Effect running', { id });
    //   updateNodeInternals(id);
    //   return () => {
    //     updateNodeInternals(id);
    //   };
    // }, [id, updateNodeInternals, key]);

    const [groups, height] = useMemo<
      [{ name: string; inputs: InputNodeHandle[]; offset: number }[], number]
    >(() => {
      const labels: Record<string, string> = {
        property: 'Properties',
        uniform: 'Uniforms',
        filler: 'Code',
      };
      const group = groupBy<InputNodeHandle>(data.inputs, 'type');
      let offset = 0;

      return [
        Object.entries(labels)
          .filter(([key]) => group[key])
          .map(([key, name]) => {
            const inputs = group[key];
            const result = {
              name,
              inputs,
              offset,
            };
            offset += labelHeight + inputs.length * inputHeight;
            return result;
          }),
        offset,
      ];
    }, [data.inputs]);

    return (
      <FlowWrap
        data={data}
        height={height + headerHeight}
        className={cx(data.stage, data.category, { inactive: !data.active })}
      >
        {data.glslError ? (
          <div className="glslError" onClick={() => jumpToError(id)}>
            GLSL Error!
          </div>
        ) : null}
        <div className={cx('flowlabel', { three: !!data.stage })}>
          <div className="title">
            {data.label} {showPosition(id, xPos, yPos)}
          </div>
          {data.stage ? (
            <div className="stage">
              {data.stage === 'fragment' ? 'FRAG' : 'VERT'}
            </div>
          ) : null}
          <button
            className="nodeConfig"
            onClick={(e) => {
              e.preventDefault();
              openNodeContextMenu(id);
            }}
          >
            <FontAwesomeIcon icon={faGear} />
          </button>
        </div>
        <div className="flowInputs">
          {groups.map((group) => (
            <React.Fragment key={group.name}>
              <div
                className={styles.inputSection}
                style={{
                  top: `${INPUT_LABEL_START_OFFSET + group.offset}px`,
                }}
              >
                {group.name}
              </div>
              {group.inputs.map((input, index) => (
                <InputHandle
                  key={input.id}
                  input={input}
                  top={group.offset + labelHeight + index * inputHeight}
                  onClick={(e) => (
                    e.preventDefault(),
                    onInputBakedToggle(id, input.id, !input.baked)
                  )}
                />
              ))}
            </React.Fragment>
          ))}

          <div className={cx(styles.outputs)}>
            {data.outputs.map((output, index) => (
              <Handle
                key={output.id}
                isConnectable
                id={output.id}
                className={cx({
                  validTarget: output.validTarget,
                  connected: output.connected,
                })}
                style={{
                  top: `${
                    (height
                      ? outputHandleTopWithLabel
                      : outputHandleTopWithoutLabel) +
                    index * inputHeight
                  }px`,
                }}
                type="source"
                position={Position.Right}
              >
                <div
                  className={cx('react-flow_handle_label', styles.outputLabel)}
                >
                  {output.name}
                </div>
              </Handle>
            ))}
          </div>
        </div>

        <Handle
          id={LinkHandle.NEXT_STAGE}
          position={Position.Bottom}
          className="linkHandle"
          type="source"
        />
        <Handle
          id={LinkHandle.PREVIOUS_STAGE}
          position={Position.Top}
          className="linkHandle"
          type="target"
        />
      </FlowWrap>
    );
  }
);
SourceNodeComponent.displayName = 'SourceNodeComponent';

export { DataNodeComponent, SourceNodeComponent };
