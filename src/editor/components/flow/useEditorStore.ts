import { create } from 'zustand';
import { XYPosition } from 'reactflow';

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
  isTextureBrowserOpen: boolean;
  isNodeConfigEditorOpen: boolean;
  setMenu: (menu: ContextMenuType, position: XYPosition) => void;
  hideMenu: () => void;
  openTextureBrowser: () => void;
  closeTextureBrowser: () => void;
  openNodeConfigEditor: () => void;
  closeNodeConfigEditor: () => void;
}

export enum ContextMenuType {
  CONTEXT,
  NODE_CONTEXT,
}

export type ContextMenu = { menu: ContextMenuType; position: XYPosition };

export const useEditorStore = create<EditorStore>((set) => ({
  menu: undefined,
  isTextureBrowserOpen: false,
  isNodeConfigEditorOpen: false,
  setMenu: (menu, position) => set(() => ({ menu: { menu, position } })),
  hideMenu: () => set(() => ({ menu: undefined })),
  openTextureBrowser: () => set(() => ({ isTextureBrowserOpen: true })),
  closeTextureBrowser: () => set(() => ({ isTextureBrowserOpen: false })),
  openNodeConfigEditor: () => set(() => ({ isNodeConfigEditorOpen: true })),
  closeNodeConfigEditor: () => set(() => ({ isNodeConfigEditorOpen: false })),
}));
