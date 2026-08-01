import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Loader2 } from 'lucide-react';

import { useIntl } from '../../util/reactIntl';
import css from './IconSpinner.module.css';

const IconSpinner = props => {
  const { rootClassName, className, ariaLabel } = props;
  const classes = classNames(rootClassName || css.root, className);
  return (
    <Loader2
      className={classes}
      size={28}
      strokeWidth={3}
      role="img"
      aria-label={ariaLabel}
    />
  );
};

const DelayedSpinner = props => {
  const [showSpinner, setShowSpinner] = useState(false);
  const { delay = 600, ...restOfProps } = props;

  useEffect(() => {
    const timer = window?.setTimeout(() => setShowSpinner(true), delay);
    return () => window?.clearTimeout(timer);
  });

  return showSpinner ? <IconSpinner {...restOfProps} /> : null;
};

/**
 * Spinner icon.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className add more style rules in addition to components own css.root
 * @param {string?} props.rootClassName overwrite components own css.root
 * @param {number?} props.delay delay in milliseconds
 * @returns {JSX.Element} SVG icon
 */
const Spinner = props => {
  const intl = useIntl();
  const { delay, ...restOfProps } = props;
  const ariaLabel = intl.formatMessage({ id: 'IconSpinner.screenreader.loading' });

  return delay != null ? (
    <DelayedSpinner ariaLabel={ariaLabel} {...props} />
  ) : (
    <IconSpinner ariaLabel={ariaLabel} {...restOfProps} />
  );
};

export default Spinner;
