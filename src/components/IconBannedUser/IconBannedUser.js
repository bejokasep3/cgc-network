import React from 'react';
import classNames from 'classnames';
import { Ban } from 'lucide-react';

import css from './IconBannedUser.module.css';

/**
 * Banned icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @returns {JSX.Element} SVG icon
 */
const IconBannedUser = props => {
  const { className } = props;
  const classes = classNames(css.foregroundStroke, className);
  return <Ban className={classes} width={40} height={40} strokeWidth={2} aria-hidden="true" />;
};

export default IconBannedUser;
