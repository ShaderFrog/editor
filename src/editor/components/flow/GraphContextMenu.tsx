import { useCallback, useRef, MouseEvent, useState, useEffect } from 'react';

import { XYPosition } from 'reactflow';

import styles from './context.menu.module.css';

export type MenuItems = [string, string | MenuItems][];

const GraphContextMenu = ({
  position,
  onSelect,
  menu,
  title = 'Add a node',
  onMouseEnter,
}: {
  onSelect: (name: string) => void;
  position: XYPosition;
  menu: MenuItems;
  title?: string;
  onMouseEnter?: (e: MouseEvent<any>) => void;
}) => {
  const [childMenu, setChildMenu] = useState<[string, MenuItems, number]>();

  const timeout = useRef<NodeJS.Timeout>();
  const onParentMenuEnter = useCallback(() => {
    if (childMenu) {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      timeout.current = setTimeout(() => {
        setChildMenu(undefined);
      }, 500);
    }
  }, [childMenu, setChildMenu]);

  useEffect(() => {
    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, []);

  return (
    <>
      <div
        id="x-context-menu"
        className={styles.contextMenu}
        style={{ top: position.y, left: position.x }}
        onMouseEnter={onMouseEnter}
      >
        <div className={styles.contextHeader}>{title}</div>
        {menu.map(([display, typeOrChildren], index) =>
          typeof typeOrChildren === 'string' ? (
            <div
              key={display}
              className={styles.contextRow}
              onClick={() => onSelect(typeOrChildren)}
              onMouseEnter={onParentMenuEnter}
            >
              {display}
            </div>
          ) : (
            <div
              key={display}
              className={styles.contextRow}
              onMouseEnter={() => {
                if (timeout.current) {
                  clearTimeout(timeout.current);
                }
                setChildMenu([display, typeOrChildren, index]);
              }}
            >
              {display} ➤
            </div>
          )
        )}
      </div>
      {childMenu ? (
        <GraphContextMenu
          onSelect={onSelect}
          position={{ y: position.y + childMenu[2] * 24, x: position.x + 138 }}
          title={childMenu[0]}
          menu={childMenu[1]}
          onMouseEnter={() => {
            if (timeout.current) {
              clearTimeout(timeout.current);
            }
          }}
        ></GraphContextMenu>
      ) : null}
    </>
  );
};

export default GraphContextMenu;
