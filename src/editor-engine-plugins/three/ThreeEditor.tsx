import { engine } from '@shaderfrog/core/plugins/three';
import {
  Editor as ThreeComponent,
  makeExampleGraph,
  Example,
  menuItems,
  addEngineNode,
} from '.';

import ShaderfrogEditor from '@editor-components/Editor';
import { EditorProps } from '@editor-components/editorTypes';

const Editor = (props: EditorProps) => {
  const example = Example.DEFAULT;
  return (
    <ShaderfrogEditor
      {...props}
      engine={engine}
      example={example}
      examples={Example}
      makeExampleGraph={makeExampleGraph}
      menuItems={menuItems}
      addEngineNode={addEngineNode}
      sceneComponent={ThreeComponent}
    />
  );
};

export default Editor;
