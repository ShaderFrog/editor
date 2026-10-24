import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import cx from 'classnames';
import styles from './splitbutton.module.css';
import {
  DropdownMenu,
  DropdownMenuItem,
  useDropdownMenu,
} from '../DropdownMenu';

export type SplitButtonOption<T> = {
  value: T;
  icon: IconDefinition;
  label: string;
  description: string;
};

type SplitButtonProps<T> = {
  label: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  options: SplitButtonOption<T>[];
  selected: T;
  onSelect: (v: T) => void;
  title?: string;
};

function SplitButton<T>({
  label,
  onClick,
  disabled = false,
  options,
  selected,
  onSelect,
  title,
}: SplitButtonProps<T>) {
  const { open, setOpen, containerRef } = useDropdownMenu();

  const currentOption = options.find((o) => o.value === selected) ?? options[0];

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        disabled={disabled}
        className={cx('buttonauto formbutton size2', styles.mainBtn)}
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        title={`${label} (${title || currentOption.label})`}
      >
        {label}
      </button>
      <button
        disabled={disabled}
        className={cx('buttonauto formbutton size2', styles.chevronBtn)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-label="Select option"
        title={currentOption.label}
      >
        <FontAwesomeIcon
          icon={faChevronDown}
          className={cx(styles.chevronIcon, { [styles.open]: open })}
        />
      </button>

      {open && (
        <DropdownMenu align="right">
          {options.map((opt) => (
            <DropdownMenuItem
              key={String(opt.value)}
              selected={opt.value === selected}
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
            >
              <span className={styles.optionIcon}>
                <FontAwesomeIcon icon={opt.icon} />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{opt.label}</span>
                <span className={styles.optionDesc}>{opt.description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      )}
    </div>
  );
}

export default SplitButton;
