import React from 'react';
import classNames from 'classnames';
import { MailCheck } from 'lucide-react';

import css from './IconEmailSuccess.module.css';

/**
 * Email icon with success mark
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconEmailSuccess = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.successFill, className);
  return (
    <MailCheck
      className={classes}
      size={51}
      strokeWidth={2.5}
      aria-hidden="true"
    />
  );
};

export default IconEmailSuccess;
