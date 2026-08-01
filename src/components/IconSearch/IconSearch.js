import React from 'react';
import classNames from 'classnames';
import { Search } from 'lucide-react';

import css from './IconSearch.module.css';

/**
 * Magnifier icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @returns {JSX.Element} SVG icon
 */
const IconSearch = props => {
  const { rootClassName, className } = props;
  const classes = classNames(rootClassName || css.root, className);
  return <Search className={classes} size={21} strokeWidth={2} aria-hidden="true" />;
};

export default IconSearch;
