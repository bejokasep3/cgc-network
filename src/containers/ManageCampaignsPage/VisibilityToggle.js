import React from 'react';
import classNames from 'classnames';

import css from './VisibilityToggle.module.css';

/**
 * Slide on/off switch for a listing's visibility — on toggles between
 * published (visible to creators in Browse projects) and closed. Disabled
 * for drafts, which need the full listing wizard to publish for the first
 * time rather than a simple open/close call.
 *
 * Shared between ManageCampaignsPage.js's "Listed" table and
 * ProjectDetailPage.js's owner-view header, so the same control looks and
 * behaves identically in both places.
 */
const VisibilityToggle = ({ isPublished, isToggling, onToggle, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={isPublished}
    disabled={isToggling}
    className={classNames(css.toggle, { [css.toggleOn]: isPublished })}
    onClick={onToggle}
    aria-label={ariaLabel}
  >
    <span className={css.toggleKnob} />
  </button>
);

export default VisibilityToggle;
