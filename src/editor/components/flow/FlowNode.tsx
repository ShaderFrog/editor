import React, {
  memo,
  MouseEventHandler,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import classnames from 'classnames/bind';
import groupBy from 'lodash.groupby';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faRightLong,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';

import {
  ShaderStage,
  GraphDataType,
  Vector3,
  Vector4,
  InputCategory,
  LinkHandle,
} from '@core/graph';

import { ChangeHandler, useFlowEventHack } from '../../flowEventHack';
import { replaceAt } from '@editor/util/replaceAt';
import { useFlowEditorContext } from '@editor/editor/flowEditorContext';
import { useFlowGraphContext } from '@editor/editor/flowGraphContext';
import { useAssetsAndGroups } from '@editor/api';

import editorStyles from '../../styles/editor.module.css';
import styles from './flownode.module.css';
import { TextureNodeValueData } from '@core/graph';
import { randomBetween } from '@editor/util/math';
import { restrictToParentElement } from '@dnd-kit/modifiers';

import { useDraggable, DndContext, useDndMonitor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { NODRAG_CLASS } from '../editorTypes';
import LabeledInput from '../LabeledInput';
import clamp from '@editor/util/clamp';
import { EDITOR_BOTTOM_PANEL, useEditorStore } from './editor-store';
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

export type CoreFlowNode = {
  label: string;
  ghost?: boolean;
  outputs: OutputNodeHandle[];
  inputs: InputNodeHandle[];
};
export type FlowNodeDataData = {
  type: GraphDataType;
  value: any;
  config: Record<string, any>;
} & CoreFlowNode;

export type FlowNodeSourceData = {
  stage?: ShaderStage;
  category?: InputCategory;
  active: boolean;
  /**
   * Whether or not this node can be used for both shader fragment and vertex
   */
  biStage: boolean;
  glslError?: boolean;
} & CoreFlowNode;

export type FlowNodeData = FlowNodeSourceData | FlowNodeDataData;

const showPosition = (id: any, xPos: number, yPos: number) =>
  global?.location?.search?.indexOf('debug') > -1 ? (
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

const InputHande = ({
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
          // Nodes where there is no chance the inputs will be taller than the
          // node contents itself, let it auto height
          [
            'number',
            'texture',
            'vector2',
            'vector3',
            'vector4',
            'rgb',
            'rgba',
          ].includes((data as any).type)
            ? null
            : // The problem with other nodes is they have the aboslutely
              // positioned inputs/outputs which have variable height, so we do
              // need to explicitly set height here
              outputHandleTopWithLabel +
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
    <div className={cx(styles.grid, 'm-top-20 gap-5')}>
      {(data.value as Vector3 | Vector4).map((_, index) => (
        <LabeledInput
          key={index}
          label={vectorComponents.charAt(index)}
          type="text"
          onChange={(e) => onComponentChange(index, e.currentTarget.value)}
          value={data.value[index]}
        />
      ))}
    </div>
  );
};

const GRID_DIMENSION = 128;
const HANDLE_DIMENSION = 15;
const maxGridCursor = GRID_DIMENSION - HANDLE_DIMENSION;
const normalizeToGrid = (value: number) => {
  if (value < 0.1) {
    value = 0;
  }
  if (value >= maxGridCursor - 1) {
    value = maxGridCursor;
  }
  return value / maxGridCursor;
};
const percentBetween = (low: number, high: number, percent: number) =>
  low + (high - low) * percent;

const Vector2Editor = (props: {
  id: string;
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => {
  const { id, data, onChange } = props;

  // DndContext is used in a higher component in this file, so that the
  // modifiers in DndContext apply to these calls
  const {
    attributes,
    listeners,
    transform,
    setNodeRef: draggableRef,
  } = useDraggable({
    id: `handle_${id}`,
  });

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const [initialCoords, setInitialCoords] = useState<[number, number]>();

  const reactFlowInstance = useReactFlow();
  const zoom = reactFlowInstance.getZoom() || 1;
  const range = useMemo(
    () =>
      ((data.config?.range as string[]) || ['-1', '1', '-1', '1']).map(
        parseFloat
      ),
    [data.config]
  );
  const value = useMemo(
    () => (data.value as string[]).map(parseFloat),
    [data.value]
  );
  const rangeScale = useMemo(() => {
    return {
      x: range[1] - range[0],
      y: range[3] - range[2],
    };
  }, [range]);

  const onDragStart = () => {
    setInitialCoords([
      clamp(
        ((value[0] - range[0]) / rangeScale.x) * maxGridCursor,
        0,
        maxGridCursor
      ),
      clamp(
        ((value[1] - range[2]) / rangeScale.y) * maxGridCursor,
        0,
        maxGridCursor
      ),
    ]);
  };

  const onDragEnd = useCallback(() => {
    setInitialCoords(undefined);
  }, []);

  const onDragMove = useCallback(() => {
    if (transformRef.current && initialCoords) {
      onChange(id, [
        '' +
          percentBetween(
            range[0],
            range[1],
            normalizeToGrid(initialCoords[0] + transformRef.current.x / zoom)
          ),
        '' +
          percentBetween(
            range[2],
            range[3],
            normalizeToGrid(initialCoords[1] + transformRef.current.y / zoom)
          ),
      ]);
    }
  }, [id, initialCoords, onChange, zoom, range]);

  useDndMonitor({
    onDragEnd,
    onDragStart,
    onDragMove,
  });

  /**
   * When dragging, dnd-kit produces an offset (the css translate) from the
   * original drag position (the lefft/top). So when dragging, we need to add
   * the offset to the initial position. On every drag, we update the value with
   * onChange(), but we need to ignore that value for the handle position, until
   * the drag ends. Then we set the handle to the final position without any
   * more css transform.
   */
  const style = {
    transform: transform
      ? CSS.Translate.toString({
          ...transform,
          x: (transform?.x || 1) / zoom,
          y: (transform?.y || 1) / zoom,
        })
      : undefined,
    ...(initialCoords
      ? {
          left: `${initialCoords[0]}px`,
          top: `${initialCoords[1]}px`,
        }
      : {
          left: `${clamp(
            ((value[0] - range[0]) / rangeScale.x) * maxGridCursor,
            0,
            maxGridCursor
          )}px`,
          top: `${clamp(
            ((value[1] - range[2]) / rangeScale.y) * maxGridCursor,
            0,
            maxGridCursor
          )}px`,
        }),
  };

  return (
    <>
      <div className={`gridHelper ${NODRAG_CLASS}`}>
        <div
          className="dragHandle"
          ref={draggableRef}
          style={style}
          {...listeners}
          {...attributes}
        ></div>
      </div>
      <VectorEditor {...props} />
    </>
  );
};

const componentToHex = (c: number) => {
  var hex = (c * 255).toString(16);
  return hex.length == 1 ? '0' + hex : hex;
};

const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

const rgbaToHex = (r: number, g: number, b: number, a: number) => {
  return (
    '#' +
    componentToHex(r) +
    componentToHex(g) +
    componentToHex(b) +
    componentToHex(a)
  );
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
const hexToRgba = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
    hex
  );
  return result
    ? [
        (parseInt(result[1], 16) / 255).toString(),
        (parseInt(result[2], 16) / 255).toString(),
        (parseInt(result[3], 16) / 255).toString(),
        (parseInt(result[4], 16) / 255).toString(),
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
  const isRgb = value.length === 3;
  const onComponentChange = (component: number, n: string) => {
    onChange(id, replaceAt(value, component, n));
  };
  return (
    <>
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
                onChange(
                  id,
                  isRgb
                    ? hexToRgb(e.target.value)
                    : hexToRgba(e.target.value + 'ff')
                );
              }}
            />
          </div>
        </label>
      </div>
      <div className="grid gap-5 m-top-10">
        {value.map((_, index) => (
          <LabeledInput
            key={index}
            label={colorComponents.charAt(index)}
            className="nodrag"
            type="text"
            onChange={(e) => onComponentChange(index, e.currentTarget.value)}
            value={value[index]}
          />
        ))}
      </div>
    </>
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
      className="nodrag textinput"
      type="text"
      onChange={(e) => onChange(id, e.currentTarget.value)}
      value={data.value}
    />
    {data.config.isRandom ? (
      <button
        className="buttonauto formbutton nodeButton size2 m-left-5"
        onClick={(e) => {
          e.preventDefault();
          onChange(
            id,
            data.config.range
              ? randomBetween(data.config.range[0], data.config.range[1])
              : Math.random()
          );
        }}
      >
        Rand
      </button>
    ) : null}
    {data.config.range ? (
      <input
        className="nodrag"
        type="range"
        min={data.config.range[0] || '0'}
        max={data.config.range[1] || '1'}
        step={data.config.stepper || '0.001'}
        onChange={(e) => onChange(id, e.currentTarget.value)}
        value={data.value}
      ></input>
    ) : null}
  </>
);

const samplerCubes: [string, string][] = [
  ['warehouseEnvTexture', 'Warehouse Env Map'],
  ['pondCubeMap', 'Pond Cube Map'],
  ['cubeCamera', 'Cube Camera'],
];

const TextureEditor = ({
  id,
  data,
  onChange,
}: {
  id: string;
  data: FlowNodeDataData;
  onChange: ChangeHandler;
}) => {
  const { currentUser } = useFlowGraphContext();
  const hasHighRes = currentUser?.isPro;
  const { assets } = useAssetsAndGroups();
  const { openEditorBottomPanel } = useEditorStore();
  const tData = data.value as TextureNodeValueData;
  const assetId = tData?.assetId;
  const properties = tData?.properties;

  const asset = assetId !== undefined ? assets[assetId] : null;
  const versions = asset?.versions || [];
  const version = versions.find((v) => v.id === tData?.versionId);
  return (
    <>
      <div
        className={cx(styles.textureSelect, { [styles.hasImg]: !!asset })}
        onClick={() =>
          openEditorBottomPanel(EDITOR_BOTTOM_PANEL.TEXTURE_BROWSER)
        }
      >
        {version ? (
          <div
            className={styles.textureImg}
            style={{
              backgroundImage: `url(${version.thumbnail})`,
            }}
          />
        ) : null}
        <div className={cx('flexCentered center', styles.textureBtn)}>
          {asset ? 'Replace' : 'Choose a texture'}
        </div>
      </div>

      <div className={cx(editorStyles.controlGrid, 'm-top-5')}>
        <div>
          <input
            className="checkbox"
            id={`repeat_tex_${id}`}
            type="checkbox"
            checked={properties?.repeatTexure}
            onChange={(e) =>
              onChange(id, {
                ...tData,
                properties: {
                  ...(properties || {}),
                  repeatTexure: e.currentTarget.checked,
                },
              })
            }
          />
        </div>
        <div>
          <label className="label noselect" htmlFor={`repeat_tex_${id}`}>
            <span>Repeat Texture</span>
          </label>
        </div>
      </div>

      <div className="grid col2 m-top-5">
        <div>
          <LabeledInput
            label="x"
            type="text"
            onChange={(e) =>
              onChange(id, {
                ...tData,
                properties: {
                  ...(properties || {}),
                  repeat: {
                    x: parseFloat(e.currentTarget.value),
                    y: properties?.repeat?.y || 1,
                  },
                },
              })
            }
            value={properties?.repeat?.x || 1}
          />
        </div>
        <div>
          <LabeledInput
            label="y"
            type="text"
            onChange={(e) =>
              onChange(id, {
                ...tData,
                properties: {
                  ...(properties || {}),
                  repeat: {
                    x: properties?.repeat?.x || 1,
                    y: parseFloat(e.currentTarget.value),
                  },
                },
              })
            }
            value={properties?.repeat?.y || 1}
          />
        </div>
      </div>

      {asset && versions.length > 1 ? (
        <select
          className={cx('nodrag select m-top-5', styles.versionSelector)}
          onChange={(e) =>
            onChange(id, {
              ...tData,
              versionId: parseFloat(e.currentTarget.value),
            })
          }
          value={version?.id}
        >
          {asset.versions.map((v, i) => (
            <option key={v.id} value={v.id} disabled={!hasHighRes && i > 0}>
              {v.resolution}
              {i > 0 ? ' (PRO)' : ''}
            </option>
          ))}
        </select>
      ) : null}
    </>
  );
};

const SamplerEditor = ({
  id,
  data,
  tex,
  onChange,
}: {
  id: string;
  tex: typeof samplerCubes;
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
            <InputHande
              key={input.id}
              input={input}
              top={outputHandleTopWithLabel + index * inputHeight}
            />
          ))}
        </div>

        <div className="body">
          {/* This context powers the vector grid drag. This needs to wrap
              the calls to useDraggable() so the modifiers work. */}
          <DndContext modifiers={[restrictToParentElement]}>
            {data.type === 'number' ? (
              <NumberEditor id={id} data={data} onChange={onChange} />
            ) : data.type === 'vector2' ? (
              <Vector2Editor id={id} data={data} onChange={onChange} />
            ) : data.type === 'array' ||
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
                tex={samplerCubes}
              />
            ) : (
              <div>NOOOOOO FlowNode for {data.type}</div>
            )}
          </DndContext>
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
                <InputHande
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
