import React from 'react';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { createSlug } from '../../util/urlHelpers';

import { Avatar, NamedLink, AspectRatioWrapper } from '../../components';

const CreatorThumbnail = () => {
  return (
    <AspectRatioWrapper className={css.thumbnail} width={4} height={5}>
      <div className={css.videoPlaceholder}>
        <div className={css.playButtonCircle}>
          <svg
            className={css.playIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </AspectRatioWrapper>
  );
};

import { getCreatorCardTranslations } from './CreatorCard.helpers';
import { getCreatorFieldLabels } from '../../util/creatorFields';

import css from './CreatorCard.module.css';

/**
 * CreatorCard – Atelier identity card
 *
 * Compact card for `creator-profile` listings: avatar + name + subtitle +
 * prominent Fraunces price. Matches the Direction A (Atelier) Figma mockup.
 *
 * @component
 * @param {Object} props
 * @param {string?} props.className
 * @param {string?} props.rootClassName
 * @param {Object} props.listing API entity: listing or ownListing
 * @param {string?} props.renderSizes for img/srcset
 * @param {Function?} props.setActiveListing
 * @returns {JSX.Element}
 */
export const CreatorCard = props => {
  const config = useConfiguration();
  const intl = props.intl || useIntl();

  const { className, rootClassName, listing, renderSizes, setActiveListing } = props;

  const translations = getCreatorCardTranslations(listing, config, intl);
  const {
    titlePlain,
    cardAriaLabel,
    showPrice,
    formattedPriceRaw,
    authorDisplayName,
  } = translations;

  const classes = classNames(rootClassName || css.root, className);

  const id = listing?.id?.uuid;
  const { title = '', publicData = {} } = listing?.attributes || {};
  const slug = createSlug(title);

  const { nicheLabels, platformLabels, turnaroundDays } =
    getCreatorFieldLabels(publicData, config.listing.listingFields);

  // Build subtitle: "Beauty · TikTok" (first niche + first platform)
  const subtitleParts = [
    ...(nicheLabels.length > 0 ? [nicheLabels[0]] : []),
    ...(platformLabels.length > 0 ? [platformLabels[0]] : []),
  ];
  const subtitleText = subtitleParts.join(' · ');

  // Build price meta: "per video · 5 day turnaround"
  const priceMetaParts = [];
  if (turnaroundDays != null) {
    priceMetaParts.push(
      intl.formatMessage(
        { id: 'CreatorCard.turnaroundMeta' },
        { days: turnaroundDays }
      )
    );
  }
  const priceMetaText = priceMetaParts.join(' · ');

  const setActivePropsMaybe = setActiveListing
    ? {
        onMouseEnter: () => setActiveListing(listing?.id),
        onMouseLeave: () => setActiveListing(null),
      }
    : null;

  return (
    <NamedLink
      className={classes}
      name="ListingPage"
      params={{ id, slug }}
      ariaLabel={cardAriaLabel}
      {...setActivePropsMaybe}
    >
      {/* Identity row: avatar + name/subtitle */}
      <div className={css.identityRow}>
        <Avatar
          className={css.avatar}
          user={listing?.author}
          disableProfileLink
          renderSizes="44px"
        />
        <div className={css.nameCol}>
          <span className={css.authorName}>{authorDisplayName}</span>
          {subtitleText ? (
            <span className={css.subtitle}>{subtitleText}</span>
          ) : null}
        </div>
      </div>

      <CreatorThumbnail />

      {/* Price row */}
      {showPrice && formattedPriceRaw ? (
        <div className={css.priceRow}>
          <span className={css.priceValue}>{formattedPriceRaw}</span>
          {priceMetaText ? (
            <span className={css.priceMeta}>{priceMetaText}</span>
          ) : null}
        </div>
      ) : null}
    </NamedLink>
  );
};

export default CreatorCard;
