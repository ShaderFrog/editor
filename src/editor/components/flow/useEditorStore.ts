import { create } from 'zustand';
import { XYPosition } from 'reactflow';
import { ValueOf } from '@/editor/util/types';

/**
 * This file is an attempt to break up Editor.tsx by abstracting out the view
 * implementaiton of FlowEditor. Any visual / non-graph functionality inside
 * the graph editor is meant to go in here.
 *
 * The menu and the mouse position need input from the parent component. Right
 * now I pass the mouse as a mutable object and the menu position with zustand.
 * Maybe instead put both in zustand or pull it all up into the parent? I don't
 * want to cause a re-render on every mouse move which is why it's an object
 */

interface EditorStore {
  menu: ContextMenu | undefined;
  bottomPanelType: EDITOR_BOTTOM_PANEL | undefined;
  setMenu: (menu: ContextMenuType, position: XYPosition) => void;
  hideMenu: () => void;
  openEditorBottomPanel: (bottomPanelType: EDITOR_BOTTOM_PANEL) => void;
  closeEditorBottomPanel: () => void;
}

export enum ContextMenuType {
  CONTEXT,
  NODE_CONTEXT,
}

export type ContextMenu = { menu: ContextMenuType; position: XYPosition };

export const EDITOR_BOTTOM_PANEL = {
  TEXTURE_BROWSER: 'texture-browser',
  NODE_CONFIG_EDITOR: 'node-config-editor',
} as const;
export type EDITOR_BOTTOM_PANEL = ValueOf<typeof EDITOR_BOTTOM_PANEL>;

export const useEditorStore = create<EditorStore>((set) => ({
  menu: undefined,
  bottomPanelType: undefined,
  setMenu: (menu, position) => set(() => ({ menu: { menu, position } })),
  hideMenu: () => set(() => ({ menu: undefined })),
  openEditorBottomPanel: (bottomPanelType: EDITOR_BOTTOM_PANEL) =>
    set(() => ({ bottomPanelType })),
  closeEditorBottomPanel: () => set(() => ({ bottomPanelType: undefined })),
}));
