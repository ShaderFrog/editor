import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

import { stubApi, ClientApiContext, withSWR } from '@editor/api';
import Loading from '@editor-components/Loading/Loading';

export const Babylon = dynamic(
  () => import('@editor/editor-engine-plugins/babylon/BabylonEditor'),
  {
    loading: () => <Loading icon="babylon" name="Babylon.js" />,
    ssr: false,
  }
);
export const Three = dynamic(
  () => import('@editor/editor-engine-plugins/three/ThreeEditor'),
  {
    loading: () => <Loading icon="three" name="Three.js" />,
    ssr: false,
  }
);
export const PlayCanvas = dynamic(
  () => import('@editor/editor-engine-plugins/playcanvas/PlayCanvasEditor'),
  {
    loading: () => <Loading icon="playcanvas" name="PlayCanvas" />,
    ssr: false,
  }
);

function Editor() {
  const router = useRouter();
  const engine = router.query.engine;
  const Component =
    engine === 'three' ? Three : engine === 'babylon' ? Babylon : PlayCanvas;

  return (
    <ClientApiContext.Provider value={stubApi}>
      <Component
        saveErrors={[]}
        onDeleteShader={async () => {}}
        onCloseSaveErrors={() => {}}
        assetPrefix={''}
        isDeleting={false}
        isAuthenticated={false}
        isOwnShader={false}
        onCreateShader={async () => {}}
        onUpdateShader={async () => {}}
      />
    </ClientApiContext.Provider>
  );
}

export default withSWR(Editor);
