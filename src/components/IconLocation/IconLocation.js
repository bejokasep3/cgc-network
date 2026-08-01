import React from 'react';
import classNames from 'classnames';
import { MapPin } from 'lucide-react';

import css from './IconLocation.module.css';

/**
 * Map pin icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconLocation = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.root, className);
  return <MapPin className={classes} size={16} strokeWidth={2} aria-hidden="true" />;
};

export default IconLocation;
