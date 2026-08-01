import React from 'react';
import classNames from 'classnames';
import { BadgeCheck } from 'lucide-react';

import css from './IconVerified.module.css';

/**
 * Verified-member badge (filled circle + checkmark), shown on an avatar for
 * users whose account state is 'active'.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconVerified = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.root, className);
  return (
    <BadgeCheck
      className={classes}
      fill="currentColor"
      strokeWidth={1.5}
      role="none"
      aria-hidden="true"
    />
  );
};

export default IconVerified;
