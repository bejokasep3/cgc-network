import React from 'react';
import classNames from 'classnames';
import { Scale } from 'lucide-react';

import css from './IconDisputeOrder.module.css';

/**
 * Delete icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconDisputeOrder = props => {
  const { className, rootClassName } = props;
  const classes = classNames(rootClassName || css.root, className);

  return <Scale className={classes} size={45} strokeWidth={2} role="none" aria-hidden="true" />;
};

export default IconDisputeOrder;
