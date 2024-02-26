import { engine } from '@core/plugins/babylon';
import {
  Editor as BabylonComponent,
  makeExampleGraph,
  Example,
  menuItems,
  addEngineNode,
} from '.';

import ShaderfrogEditor from '@editor/editor/components/Editor';
import { EditorProps } from '@/editor/editor/components/editorTypes';

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
      sceneComponent={BabylonComponent}
    />
  );
};

export default Editor;
