import React from 'react';
import classNames from 'classnames';
import { MessageCircleQuestion } from 'lucide-react';

import css from './IconInquiry.module.css';

/**
 * Inquiry icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconInquiry = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.root, className);
  return (
    <MessageCircleQuestion className={classes} size={46} strokeWidth={2} aria-hidden="true" />
  );
};

export default IconInquiry;
