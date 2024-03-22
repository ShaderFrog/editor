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

export type MenuItem = {
  icon?: ReactNode;
  display: ReactNode;
  key?: string;
} & ({ children: MenuItem[] } | { value: string });

type MenuItemHelper = MenuItem & { children: MenuItemHelper[]; value: string };

// Aproximate height of a row to determine child menu offset height
const ROW_HEIGHT = 26;

const ContextMenu = ({
  position,
  onSelect,
  onClose,
  menu,
  title,
  onMouseEnter,
  onItemHover,
  leftToRight,
}: {
  onSelect: (name: string) => void;
  onClose?: () => void;
  position?: { x: number | string; y: number };
  menu: MenuItem[];
  title?: string;
  onMouseEnter?: (e: ReactMouseEvent<any>) => void;
  onItemHover?: (name: string) => void;
  leftToRight?: boolean;
}) => {
  // The number is used to calculate the relative offset of the child menu
  const [childMenu, setChildMenu] = useState<[MenuItem[], number]>();

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

    // I'm too lazy to figure out how to fix this: When the parent component
    // clicks on something, this component mounts, wires up the onclick, and
    // when the user releases the left click, this handler fires, causing the
    // menu to instantly hide. This hack fixes it for now.
    setTimeout(() => {
      document.body.addEventListener('click', closeMenu);
    }, 1);
    return () => {
      document.body.removeEventListener('click', closeMenu);
    };
  }, [onClose]);

  const hasLeft = !!menu.find(({ icon }) => !!icon);
  const hasShortcut = !!menu.find(({ key }) => !!key);
  const hasChildren = !!menu.find((item) => 'children' in item);
  const hasRight = hasChildren || hasShortcut;
  const menuHelp = menu as MenuItemHelper[];

  return (
    <>
      <div
        id="x-context-menu"
        className={cx(styles.contextMenu, {
          [styles.leftToRight]: leftToRight,
        })}
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
          {menuHelp.map(({ display, icon, key, children, value }, index) =>
            children ? (
              <div
                key={index}
                className={cx(styles.contextRow, { [styles.active]: childMenu?.[0] === children })}
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
                onClick={() => {
                  onSelect(value);
                  onClose && onClose();
                }}
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
                y: childMenu[1] * ROW_HEIGHT,
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
