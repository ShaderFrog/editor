import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import { Resizable } from 're-resizable';

import styles from '../../styles/editor.module.css';
import { SyntheticEvent, useState } from 'react';

const BottomModal = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => {
  const [height, setHeight] = useState(400);

  return (
    <Resizable
      enable={{
        top: true,
        right: false,
        bottom: false,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      }}
      className={styles.bottomModal}
      defaultSize={{
        height: 200,
      }}
    >
      <button
        className={styles.closeModal}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <div className={styles.bottomModalContent}>{children}</div>
    </Resizable>
  );
};

export default BottomModal;
