import React from 'react';
import classNames from 'classnames';
import { Calendar } from 'lucide-react';

import css from './IconDate.module.css';

/**
 * Calendar icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconDate = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.root, className);
  return (
    <Calendar
      className={classes}
      width={16}
      height={16}
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    />
  );
};

export default IconDate;
