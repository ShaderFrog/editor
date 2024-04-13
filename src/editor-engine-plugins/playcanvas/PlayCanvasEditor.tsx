import { engine } from '@core/plugins/playcanvas';
import {
  Editor as PlayCanvasComponent,
  makeExampleGraph,
  Example,
  addEngineNode,
  menuItems,
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
      sceneComponent={PlayCanvasComponent}
    />
  );
};

export default Editor;
