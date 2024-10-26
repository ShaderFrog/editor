import { MutableRefObject, FunctionComponent } from 'react';

import { Graph, Edge, CompileResult } from '@core/graph';
import { Engine, EngineContext } from '@core/engine';
import { MenuItem } from './ContextMenu/ContextMenu';
import {
  Shader,
  ShaderCreateInput,
  ShaderUpdateInput,
} from '@editor/model/Shader';
import { CurrentUser } from '@editor/model';
import { AnyFn } from '@editor/util/types';
import { AddEngineNode } from '../editor-types';

export type PreviewLight = 'point' | '3point' | 'spot';

export type BaseSceneConfig = {
  bg: string | null;
  lights: string;
  previewObject: string;
};
export type AnySceneConfig = BaseSceneConfig & Record<string, any>;

/**
 * This is the interface for the props that any engine scene component must
 * accept. Usage:
 *    <Editor sceneComponent={MyEngineEditor} />
 * Where MyEngineEditor (the component) must accept these props, because this
 * parent editor component controls their state/functionality
 */
export type SceneProps = {
  compile: AnyFn;
  compileResult: CompileResult | undefined;
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
  saveErrors?: string[];
  onCloseSaveErrors?: () => void;
  isOwnShader?: boolean;
  isAuthenticated?: boolean;
  shader?: Shader;
  exampleShader?: Shader;
  onDeleteShader?: (shaderId: string) => Promise<void>;
  isDeleting?: boolean;
  onCreateShader?: (shader: ShaderCreateInput) => Promise<void>;
  onUpdateShader?: (shader: ShaderUpdateInput) => Promise<void>;
  currentUser?: CurrentUser | null;
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
  addEngineNode: AddEngineNode;
  sceneComponent: FunctionComponent<SceneProps>;
};

// React-flow's default class for non-draggable inner elements. Also used to
// short circuit Editor drag events
export const NODRAG_CLASS = 'nodrag';

// Prevent dropping on element panes which are over the graph from triggering
// an effect drop
export const NODROP_CLASS = 'nodrop';
