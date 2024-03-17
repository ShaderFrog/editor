import {
  useCallback,
  useRef,
  MouseEvent as ReactMouseEvent,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import classnames from 'classnames';

import styles from './context.menu.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleChevronRight } from '@fortawesome/free-solid-svg-icons';
const cx = classnames.bind(styles);

export type MenuItems = {
  icon?: ReactNode;
  display: ReactNode;
  value: string;
  key?: string;
  children?: MenuItems;
}[];

const ContextMenu = ({
  position,
  onSelect,
  onClose,
  menu,
  title,
  onMouseEnter,
  onItemHover,
}: {
  onSelect: (name: string) => void;
  onClose?: () => void;
  position?: { x: number | string; y: number };
  menu: MenuItems;
  title?: string;
  onMouseEnter?: (e: ReactMouseEvent<any>) => void;
  onItemHover?: (name: string) => void;
}) => {
  // The number is used to calculate the relative offset of the child menu
  const [childMenu, setChildMenu] = useState<[MenuItems, number]>();

  const timeout = useRef<NodeJS.Timeout>();
  const onItemMouseEnter = useCallback(
    (name: string) => {
      if (childMenu) {
        if (timeout.current) {
          clearTimeout(timeout.current);
        }
        timeout.current = setTimeout(() => {
          setChildMenu(undefined);
        }, 500);
      }
      if (onItemHover) {
        onItemHover(name);
      }
    },
    [childMenu, setChildMenu, onItemHover]
  );

  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (
        onClose &&
        event.target instanceof Element &&
        !event.target.closest('#x-context-menu')
      ) {
        onClose();
      }
    };

    document.body.addEventListener('click', closeMenu);
    return () => {
      document.body.removeEventListener('click', closeMenu);
    };
  }, [onClose]);

  const hasLeft = !!menu.find(({ icon }) => !!icon);
  const hasShortcut = !!menu.find(({ key }) => !!key);
  const hasChildren = !!menu.find(({ children }) => !!children);
  const hasRight = hasChildren || hasShortcut;

  return (
    <>
      <div
        id="x-context-menu"
        className={styles.contextMenu}
        style={position ? { top: position.y, left: position.x } : {}}
        onMouseEnter={onMouseEnter}
      >
        <div className={styles.contextHeader}>{title}</div>
        <div
          className={cx(
            styles.contextRows,
            hasLeft && hasRight
              ? styles.shrinkGrowShrink
              : hasRight
              ? styles.growShrink
              : hasLeft
              ? styles.shrinkGrow
              : null
          )}
        >
          {menu.map(({ display, icon, value, key, children }, index) =>
            children ? (
              <div
                key={value}
                className={styles.contextRow}
                onMouseEnter={() => {
                  if (timeout.current) {
                    clearTimeout(timeout.current);
                  }
                  setChildMenu([children, index]);
                }}
              >
                {hasLeft ? <span>{icon}</span> : null}
                <span>{display}</span>
                <span>
                  <FontAwesomeIcon icon={faCircleChevronRight} />
                </span>
              </div>
            ) : (
              <div
                key={value}
                className={styles.contextRow}
                onClick={() => onSelect(value)}
                onMouseEnter={() => onItemMouseEnter(value)}
              >
                {hasLeft ? <span>{icon}</span> : null}
                <span>{display}</span>
                {key ? (
                  <span className={cx('right', styles.shortcut)}>{key}</span>
                ) : null}
                {hasRight ? <span /> : null}
              </div>
            )
          )}
        </div>
        <div className={styles.childContext}>
          {childMenu ? (
            <ContextMenu
              onSelect={onSelect}
              position={{
                y: (position?.y || 0) + childMenu[1] * 24,
                x: 'auto',
              }}
              menu={childMenu[0]}
              onMouseEnter={() => {
                if (timeout.current) {
                  clearTimeout(timeout.current);
                }
              }}
            ></ContextMenu>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default ContextMenu;
