import dynamic from 'next/dynamic';
import { threngine } from '@core/plugins/three/threngine';
import {
  makeExampleGraph,
  menuItems,
  addEngineNode,
  Editor as SceneComponent,
} from '../editor-engine-plugins/three';

const DynamicComponentWithNoSSR = dynamic(
  () => import('../editor/components/Editor'),
  {
    ssr: false,
    loading: () => <div style={{ color: '#fff' }}>Loarfing&hellip;</div>,
  }
);

function Editor() {
  return (
    <DynamicComponentWithNoSSR
      assetPrefix=""
      engine={threngine}
      example="DEFAULT"
      examples={{}}
      makeExampleGraph={makeExampleGraph}
      menuItems={menuItems}
      addEngineNode={addEngineNode}
      SceneComponent={SceneComponent}
    />
  );
}

export default Editor;
