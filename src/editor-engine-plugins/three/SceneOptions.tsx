import React from 'react';
import classnames from 'classnames';

import styles from './sceneOptions.module.css';

const cx = classnames.bind(styles);

export type SceneOptionItem =
  | { header: string }
  | { value: string; label: string; thumbnail?: string };

type SceneOption = Exclude<SceneOptionItem, { header: string }>;

const isOption = (item: SceneOptionItem): item is SceneOption =>
  'value' in item;

const Thumbnail = ({ src, className }: { src?: string; className: string }) =>
  src ? (
    <img src={src} alt="" className={className} />
  ) : (
    <span className={cx(className, styles.emptyThumb)} />
  );

/**
 * Toolbar button that opens one of the scene panels, showing the current
 * selection's thumbnail and label
 */
export const SceneToolbarToggle = ({
  active,
  onClick,
  title,
  label,
  thumbnail,
  shape = 'icon',
  className,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  thumbnail?: string;
  /** icon: transparent square icons. image: photo thumbnails, rounded */
  shape?: 'icon' | 'image';
  className?: string;
}) => (
  <button
    className={cx(
      'formbutton tertiary',
      styles.toggle,
      styles[shape],
      className,
      {
        active,
      }
    )}
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    title={`${title}: ${label}`}
    aria-pressed={active}
  >
    <Thumbnail src={thumbnail} className={styles.toggleThumb} />
    <span className={styles.toggleLabel}>{label}</span>
  </button>
);

/**
 * Grid of selectable options with thumbnails, shown inside a scene panel
 */
export const SceneOptions = ({
  value,
  items,
  onChange,
  shape = 'icon',
}: {
  value: string;
  items: SceneOptionItem[];
  onChange: (value: string) => void;
  /** icon: square icons, like the model shapes. image: wider photo cards */
  shape?: 'icon' | 'image';
}) => (
  <ul className={cx(styles.options, styles[shape])} role="listbox">
    {items.map((item) =>
      isOption(item) ? (
        <li
          key={item.value}
          role="option"
          aria-selected={item.value === value}
          title={item.label}
          className={cx(styles.option, {
            [styles.selected]: item.value === value,
          })}
          onClick={() => onChange(item.value)}
        >
          <Thumbnail src={item.thumbnail} className={styles.optionThumb} />
          <span className={styles.optionLabel}>{item.label}</span>
        </li>
      ) : (
        <li key={`header-${item.header}`} className={styles.header}>
          {item.header}
        </li>
      )
    )}
  </ul>
);
