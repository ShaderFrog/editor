import { MutableRefObject, FunctionComponent } from 'react';

import { Graph, GraphNode, Edge } from '@core/graph';
import { Engine, EngineContext } from '@core/engine';
import { UICompileGraphResult } from '../uICompileGraphResult';
import { MenuItem } from './ContextMenu/ContextMenu';

export type PreviewLight = 'point' | '3point' | 'spot';

export type BaseSceneConfig = {
  bg: string | null;
  lights: string;
  previewObject: string;
};
export type AnySceneConfig = BaseSceneConfig & Record<string, any>;

// This must be kept in sync with the site/ shader model. TODO: Should that be
// moved into Core instead?
export type EditorShader = {
  id?: string;
  engine: 'three' | 'babylon' | 'playcanvas';
  createdAt?: Date;
  updatedAt?: Date;
  tags: { name: string; slug: string }[];
  userId?: string;
  image?: string | null;
  name: string;
  description?: string | null;
  visibility: number;
  config: {
    graph: {
      nodes: GraphNode[];
      edges: Edge[];
    };
    scene: AnySceneConfig;
  };
};

// Ditto. Maybe one day extract a @shaderfrog/types library or something
export type ShaderUpdateInput = Omit<
  EditorShader,
  'createdAt' | 'updatedAt' | 'userId'
> & {
  id: string;
  tags: string[];
};

export type ShaderCreateInput = Omit<
  EditorShader,
  'id' | 'createdAt' | 'updatedAt' | 'userId'
> & { imageData: string; tags: string[] };

type AnyFn = (...args: any) => any;

/**
 * This is the interface for the props that any engine scene component must
 * accept. Usage:
 *    <Editor sceneComponent={MyEngineEditor} />
 * Where MyEngineEditor (the component) must accept these props, because this
 * parent editor component controls their state/functionality
 */
export type SceneProps = {
  compile: AnyFn;
  compileResult: UICompileGraphResult | undefined;
  graph: Graph;
  setCtx: (ctx: EngineContext) => void;
  sceneConfig: AnySceneConfig;
  setSceneConfig: (config: AnySceneConfig) => void;
  setGlResult: AnyFn;
  width: number;
  height: number;
  assetPrefix: string;
  takeScreenshotRef: MutableRefObject<(() => Promise<string>) | undefined>;
};

/**
 * Props you must pass to <Editor /> from the wrapping page
 */
export type EditorProps = {
  assetPrefix: string;
  searchUrl: string;
  saveErrors?: string[];
  onCloseSaveErrors?: () => void;
  isOwnShader?: boolean;
  isAuthenticated?: boolean;
  shader?: EditorShader;
  exampleShader?: EditorShader;
  onDeleteShader?: (shaderId: string) => Promise<void>;
  isDeleting?: boolean;
  onCreateShader?: (shader: ShaderCreateInput) => Promise<void>;
  onUpdateShader?: (shader: ShaderUpdateInput) => Promise<void>;
};

/**
 * Props that individual engine components (like ThreeEditor.tsx) combine with
 * parent EditorProps to this component.
 */
export type EngineProps = {
  engine: Engine;
  example: string;
  examples: Record<string, string>;
  makeExampleGraph: (example: string) => [Graph, AnySceneConfig];
  menuItems: MenuItem[];
  addEngineNode: (
    nodeDataType: string,
    name: string,
    position: { x: number; y: number },
    newEdgeData?: Omit<Edge, 'id' | 'from'>,
    defaultValue?: any
  ) => [Set<string>, Graph] | undefined;
  sceneComponent: FunctionComponent<SceneProps>;
};
