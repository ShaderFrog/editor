/* eslint-disable @next/next/no-img-element */
import classnames from 'classnames';
import { ReactElement, SVGProps } from 'react';

// All paths on these MUST have the attribute fill="currentColor" to be
// colorizeable by css color property. Manually add it if not present.
// Also requires @svgr/webpack and custom next.config.js
import Github from '@public/github-1.svg';
import Twitter from '@public/twitter-1.svg';
import Check from '@public/check-mark-1.svg';
import Three from '@public/three-icon.svg';
import Babylon from '@public/babylon-icon.svg';
import Playcanvas from '@public/playcanvas.svg';
import Cloud from '@public/cloud.svg';

import styles from './icon.module.css';
const cx = classnames.bind(styles);

export type IconName =
  | 'github'
  | 'twitter'
  | 'check'
  | 'three'
  | 'babylon'
  | 'playcanvas'
  | 'cloud';
const icons: Record<IconName, (props: SVGProps<SVGElement>) => ReactElement> = {
  github: Github,
  twitter: Twitter,
  check: Check,
  three: Three,
  babylon: Babylon,
  playcanvas: Playcanvas,
  cloud: Cloud,
};

const Icon = ({ type, color }: { type: IconName; color?: string }) => {
  const Component = icons[type];
  return <Component className={cx(styles.icon, color && styles[color])} />;
};

export default Icon;
