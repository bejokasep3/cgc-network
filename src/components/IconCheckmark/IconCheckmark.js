import React from 'react';
import classNames from 'classnames';
import { Check } from 'lucide-react';

import css from './IconCheckMark.module.css';

const SIZE_SMALL = 'small';
const SIZE_BIG = 'big';

/**
 * Checkmark icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @param {string?} props.rootClassName overwrite components own root class
 * @param {'big' | 'small'} props.size
 * @returns {JSX.Element} SVG icon
 */
const IconCheckmark = props => {
  const { rootClassName, className, size = SIZE_BIG } = props;
  const classes = classNames(rootClassName || css.root, className);
  if (size === SIZE_SMALL) {
    return (
      <Check className={classes} size={16} strokeWidth={2.5} role="none" aria-hidden="true" />
    );
  } else if (size === SIZE_BIG) {
    return <Check className={classes} size={24} strokeWidth={2} role="none" aria-hidden="true" />;
  }
};

export default IconCheckmark;
