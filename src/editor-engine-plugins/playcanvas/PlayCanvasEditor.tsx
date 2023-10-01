import { engine } from '@core/plugins/playcanvas';
import {
  Editor as PlayCanvasComponent,
  makeExampleGraph,
  Example,
  addEngineNode,
  menuItems,
} from '.';

import ShaderfrogEditor, {
  EditorProps,
} from '@editor/editor/components/Editor';

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
      SceneComponent={PlayCanvasComponent}
    />
  );
};

export default Editor;
