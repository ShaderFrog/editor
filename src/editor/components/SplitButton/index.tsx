import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import cx from 'classnames';
import styles from './splitbutton.module.css';

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
        <ul className={styles.menu}>
          {options.map((opt) => (
            <li
              key={String(opt.value)}
              className={cx(styles.option, {
                [styles.selected]: opt.value === selected,
              })}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SplitButton;
