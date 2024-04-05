import frogLogo from '@public/frog-logo.jpg';
import Icon, { IconName } from '@editor-components/Icon';

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

export default Loading;
