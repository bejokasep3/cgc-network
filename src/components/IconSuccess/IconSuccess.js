import React from 'react';
import classNames from 'classnames';
import { CheckCircle2 } from 'lucide-react';

import css from './IconSuccess.module.css';

/**
 * Success icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string?} props.fillColor overwrite components own css.fillColor
 * @returns {JSX.Element} SVG icon
 */
const IconSuccess = props => {
  const { rootClassName, className, fillColor } = props;
  const classes = classNames(rootClassName || css.root, fillColor || css.fillColor, className);
  return (
    <CheckCircle2
      className={classes}
      size={24}
      strokeWidth={2.5}
      role="none"
      aria-hidden="true"
    />
  );
};

export default IconSuccess;
