import React, { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import styles from './dropdownmenu.module.css';

/**
 * Open state for a button + DropdownMenu pair. Closes on outside click and
 * Escape. Put containerRef on an element wrapping both the button and menu.
 */
export const useDropdownMenu = () => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return { open, setOpen, close, containerRef };
};

type DropdownMenuProps = {
  align?: 'left' | 'right';
  className?: string;
  /** Class for the list of items, for laying them out differently */
  listClassName?: string;
  /** Extra content above and below the list of items, like settings */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export const DropdownMenu = ({
  align = 'left',
  className,
  listClassName,
  header,
  footer,
  children,
}: DropdownMenuProps) => (
  <div className={cx(styles.menu, styles[align], 'nowheel', className)}>
    {header}
    <ul className={cx(styles.list, listClassName)} role="listbox">
      {children}
    </ul>
    {footer}
  </div>
);

type DropdownMenuItemProps = {
  selected?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
};

export const DropdownMenuItem = ({
  selected = false,
  onClick,
  className,
  children,
}: DropdownMenuItemProps) => (
  <li
    role="option"
    aria-selected={selected}
    className={cx(styles.option, { [styles.selected]: selected }, className)}
    onClick={onClick}
  >
    {children}
  </li>
);

export const DropdownMenuHeader = ({
  children,
}: {
  children: React.ReactNode;
}) => <li className={styles.header}>{children}</li>;
