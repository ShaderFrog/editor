import React from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';

import {
  DropdownMenu,
  DropdownMenuHeader,
  DropdownMenuItem,
  useDropdownMenu,
} from '@editor-components/DropdownMenu';
import styles from './toolbarPicker.module.css';

const cx = classnames.bind(styles);

export type PickerItem =
  | { header: string }
  | { value: string; label: string; thumbnail?: string };

type PickerOption = Exclude<PickerItem, { header: string }>;

const isOption = (item: PickerItem): item is PickerOption => 'value' in item;

type ToolbarPickerProps = {
  value: string;
  items: PickerItem[];
  onChange: (value: string) => void;
  title: string;
  /**
   * grid: square icons with labels underneath, for a handful of options.
   * list: thumbnail + label rows with optional headers, for long lists.
   */
  layout?: 'grid' | 'list';
  /** Show the selected option's label in the toolbar button */
  showLabel?: boolean;
  /** Keep the menu open after picking, for menus with settings in them */
  closeOnSelect?: boolean;
  /** Settings shown above / below the options */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

const Thumbnail = ({ src, className }: { src?: string; className: string }) =>
  src ? (
    <img src={src} alt="" className={className} />
  ) : (
    <span className={cx(className, styles.emptyThumb)} />
  );

const ToolbarPicker = ({
  value,
  items,
  onChange,
  title,
  layout = 'list',
  showLabel = false,
  closeOnSelect = true,
  header,
  footer,
  className,
}: ToolbarPickerProps) => {
  const { open: isOpen, setOpen: setIsOpen, containerRef } = useDropdownMenu();

  const selected = items.filter(isOption).find((item) => item.value === value);

  return (
    <div
      ref={containerRef}
      className={cx(styles.picker, styles[layout], className)}
    >
      <button
        className={cx('formbutton secondary', styles.trigger, {
          [styles.open]: isOpen,
        })}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((o) => !o);
        }}
        title={selected ? `${title}: ${selected.label}` : title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Thumbnail src={selected?.thumbnail} className={styles.triggerThumb} />
        {showLabel && (
          <span className={styles.triggerLabel}>
            {selected?.label || title}
          </span>
        )}
        <FontAwesomeIcon icon={faChevronDown} className={styles.chevron} />
      </button>
      {isOpen && (
        <DropdownMenu
          className={styles.menu}
          listClassName={styles.items}
          header={
            header ? (
              <div
                className={cx(styles.settings, styles.settingsTop, 'condensed')}
              >
                {header}
              </div>
            ) : null
          }
          footer={
            footer ? (
              <div
                className={cx(
                  styles.settings,
                  styles.settingsBottom,
                  'condensed'
                )}
              >
                {footer}
              </div>
            ) : null
          }
        >
          {items.map((item) =>
            isOption(item) ? (
              <DropdownMenuItem
                key={item.value}
                selected={item.value === value}
                className={styles.option}
                onClick={() => {
                  onChange(item.value);
                  if (closeOnSelect) {
                    setIsOpen(false);
                  }
                }}
              >
                <Thumbnail
                  src={item.thumbnail}
                  className={styles.optionThumb}
                />
                <span className={styles.optionLabel}>{item.label}</span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuHeader key={`header-${item.header}`}>
                {item.header}
              </DropdownMenuHeader>
            )
          )}
        </DropdownMenu>
      )}
    </div>
  );
};

export default ToolbarPicker;
