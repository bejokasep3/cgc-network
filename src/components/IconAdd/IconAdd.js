import React from 'react';
import classNames from 'classnames';
import { Plus } from 'lucide-react';

import css from './IconAdd.module.css';

/**
 * Add icon: "+"
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own root class
 * @param {string?} props.rootClassName overwrite components own root class
 * @returns {JSX.Element} "add" icon
 */
const IconAdd = props => {
  const { className, rootClassName } = props;
  const classes = classNames(rootClassName || css.root, className);

  return (
    <Plus className={classes} size={12} fill="currentColor" stroke="none" aria-hidden="true" />
  );
};

export default IconAdd;
