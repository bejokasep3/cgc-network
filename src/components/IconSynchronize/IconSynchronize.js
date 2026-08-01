import React from 'react';
import classNames from 'classnames';
import { RefreshCw } from 'lucide-react';

import css from './IconSynchronize.module.css';

/**
 * Synchronize icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconSynchronize = props => {
  const { className, rootClassName } = props;
  const classes = classNames(rootClassName || css.root, className);
  return <RefreshCw className={classes} size={50} strokeWidth={3} aria-hidden="true" />;
};

export default IconSynchronize;
