import React from 'react';
import classNames from 'classnames';
import { Send } from 'lucide-react';

import css from './IconEmailSent.module.css';

/**
 * Email sent icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconEmailSent = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.root, className);
  return <Send className={classes} size={48} strokeWidth={3} aria-hidden="true" />;
};

export default IconEmailSent;
