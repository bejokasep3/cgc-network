import React from 'react';
import classNames from 'classnames';
import { UserCheck } from 'lucide-react';

import css from './IconReviewUser.module.css';

/**
 * Review icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconReviewUser = props => {
  const { className, rootClassName } = props;
  const classes = classNames(rootClassName || css.root, className);

  return <UserCheck className={classes} size={46} strokeWidth={2} role="none" aria-hidden="true" />;
};

export default IconReviewUser;
