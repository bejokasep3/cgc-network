import React from 'react';
import classNames from 'classnames';
import { X } from 'lucide-react';

import css from './IconClose.module.css';
const SIZE_SMALL = 'small';

/**
 * Close icon. "x"
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @param {string?} props.rootClassName overwrite components own root class
 * @param {'small' | null} props.size
 * @returns {JSX.Element} SVG icon
 */
const IconClose = props => {
  const { className, rootClassName, size, ariaLabel } = props;
  const classes = classNames(rootClassName || css.root, className);
  const ariaLabelMaybe = ariaLabel ? { ['aria-label']: ariaLabel } : {};

  if (size === SIZE_SMALL) {
    return (
      <X
        className={classes}
        size={9}
        strokeWidth={2.5}
        role="img"
        {...ariaLabelMaybe}
      />
    );
  }

  return (
    <X
      className={classes}
      size={12}
      strokeWidth={2}
      role="img"
      {...ariaLabelMaybe}
    />
  );
};

export default IconClose;
