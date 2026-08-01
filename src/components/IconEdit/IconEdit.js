import React from 'react';
import classNames from 'classnames';
import { Pencil } from 'lucide-react';

import css from './IconEdit.module.css';

/**
 * Edit icon. (pencil)
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {string?} props.pencilClassName overwrite components own css.pencil
 * @returns {JSX.Element} SVG icon
 */
const IconEdit = props => {
  const { rootClassName, className, pencilClassName } = props;
  const classes = classNames(rootClassName || css.root, pencilClassName || css.pencil, className);
  return <Pencil className={classes} size={14} strokeWidth={2} role="none" aria-hidden="true" />;
};

export default IconEdit;
