import React from 'react';
import classNames from 'classnames';
import { Star } from 'lucide-react';

import css from './IconReviewStar.module.css';

/**
 * Review star icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {boolean?} props.isFilled is filled with color
 * @param {string} props.label aria-label for svg image
 * @returns {JSX.Element} SVG icon
 */
const IconReviewStar = props => {
  const { className, rootClassName, isFilled, ariaLabel } = props;
  const filledOrDefault = isFilled ? css.filled : css.root;
  const classes = classNames(rootClassName || filledOrDefault, className);
  const ariaLabelMaybe = ariaLabel ? { ['aria-label']: ariaLabel } : {};

  return (
    <Star
      className={classes}
      size={23}
      fill="currentColor"
      stroke="none"
      role="img"
      {...ariaLabelMaybe}
    />
  );
};

export default IconReviewStar;
