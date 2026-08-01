import React from 'react';
import classNames from 'classnames';
import { AlertCircle } from 'lucide-react';

import css from './IconAlert.module.css';

/**
 * Alert icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @param {string?} props.rootClassName overwrite components own root class
 * @returns {JSX.Element} SVG icon
 */
const IconAlert = props => {
  const { className, rootClassName } = props;
  const classes = classNames(rootClassName || css.root, className);

  return <AlertCircle className={classes} size={40} strokeWidth={2} aria-hidden="true" />;
};

export default IconAlert;
