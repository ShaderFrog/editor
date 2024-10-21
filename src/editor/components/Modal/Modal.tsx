import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

import styles from '../../styles/editor.module.css';
import { useHotkeys } from 'react-hotkeys-hook';

const Modal = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => {
  useHotkeys(`esc`, () => {
    onClose();
  });

  return (
    <div className={styles.modal}>
      <button
        className={styles.closeModal}
        onClick={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
      <div className={styles.modalContent}>{children}</div>
    </div>
  );
};

export default Modal;
