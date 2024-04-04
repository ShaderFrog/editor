import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { SWRConfig } from 'swr';

import { stubApi, stubApiData } from '@api/stub';
import { ClientApiContext } from '@api/api';

import frogLogo from '../../../public/frog-logo.jpg';
import Icon, { IconName } from '@/editor/components/Icon/Icon';

const Loading = ({ name, icon }: { name: string; icon: IconName }) => (
  <div
    style={{
      width: '200px',
      margin: '20px auto 0',
      textAlign: 'center',
      position: 'relative',
    }}
  >
    <img src={frogLogo.src} alt="Loading frog" style={{ width: '100%' }} />
    <div style={{ position: 'absolute', top: '30px', left: '110px' }}>
      <Icon type={icon} />
    </div>
    <div style={{ position: 'absolute', top: '200px', left: '0px' }}>
      Loading {name} Editor&hellip;
    </div>
  </div>
);

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
    <SWRConfig value={{ fallback: stubApiData }}>
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
    </SWRConfig>
  );
}

export default Editor;
