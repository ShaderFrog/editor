import { engine } from '@core/plugins/babylon';
import {
  Editor as BabylonComponent,
  makeExampleGraph,
  Example,
  menuItems,
  addEngineNode,
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
      SceneComponent={BabylonComponent}
    />
  );
};

export default Editor;
