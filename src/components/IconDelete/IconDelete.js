import React from 'react';
import classNames from 'classnames';
import { Trash2 } from 'lucide-react';

import css from './IconDelete.module.css';

/**
 * Delete icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconDelete = props => {
  const { className, rootClassName } = props;
  const classes = classNames(rootClassName || css.root, className);

  return (
    <Trash2 className={classes} size={16} strokeWidth={1.5} aria-hidden="true" />
  );
};

export default IconDelete;
