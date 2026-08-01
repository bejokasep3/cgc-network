import React from 'react';
import classNames from 'classnames';
import { KeyRound } from 'lucide-react';

import css from './IconKeysSuccess.module.css';

/**
 * Inquiry icon with success mark.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconKeysSuccess = props => {
  const { className } = props;
  const classes = classNames(css.strokeMarketplaceColor, className);
  return <KeyRound className={classes} size={52} strokeWidth={2.5} aria-hidden="true" />;
};

export default IconKeysSuccess;
