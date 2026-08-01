import React from 'react';
import classNames from 'classnames';
import { MailWarning } from 'lucide-react';

import css from './IconEmailAttention.module.css';

/**
 * Email icon with attention focus.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconEmailAttention = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.marketplaceStroke, className);
  return (
    <MailWarning className={classes} size={52} strokeWidth={2.5} aria-hidden="true" />
  );
};

export default IconEmailAttention;
