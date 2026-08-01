import React from 'react';
import classNames from 'classnames';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';

import css from './IconArrowHead.module.css';

const DIRECTION_RIGHT = 'right';
const DIRECTION_LEFT = 'left';
const DIRECTION_DOWN = 'down';
const DIRECTION_UP = 'up';
const SIZE_BIG = 'big';
const SIZE_SMALL = 'small';
const SIZE_TINY = 'tiny';

/**
 * Icon with arrow head pointing to given direction and with given size.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {('right' | 'left' | 'down' | 'up')} props.direction
 * @param {('small' | 'big' | 'tiny')} props.size
 * @returns {JSX.Element} arrow head icon
 */
const IconArrowHead = props => {
  const { className, rootClassName, direction, size = SIZE_SMALL } = props;
  const classes = classNames(
    rootClassName ? rootClassName : size === SIZE_TINY ? css.rootTinyArrow : css.root,
    className
  );

  const isRight = direction === DIRECTION_RIGHT;
  const isLeft = direction === DIRECTION_LEFT;
  const isDown = direction === DIRECTION_DOWN;
  const isUp = direction === DIRECTION_UP;
  const isBig = size === SIZE_BIG;
  const isTiny = size === SIZE_TINY;

  const iconSize = isBig ? 15 : isTiny ? 8 : 13;
  const iconProps = {
    className: classes,
    size: iconSize,
    fill: 'currentColor',
    stroke: 'currentColor',
    strokeWidth: isTiny ? 1 : 1.5,
    role: 'none',
  };

  if (isRight) {
    return <ChevronRight {...iconProps} />;
  } else if (isLeft) {
    return <ChevronLeft {...iconProps} />;
  } else if (isDown) {
    return <ChevronDown {...iconProps} />;
  } else if (isUp) {
    return <ChevronUp {...iconProps} />;
  }
};

export default IconArrowHead;
