import React from 'react';
import classNames from 'classnames';

import { useConfiguration } from '../../context/configurationContext';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { requireListingImage } from '../../util/configHelpers';
import { lazyLoadWithDimensions } from '../../util/uiHelpers';
import { createSlug } from '../../util/urlHelpers';

import {
  AspectRatioWrapper,
  NamedLink,
  ResponsiveImage,
  ListingCardThumbnail,
  IconCheckmark,
} from '../../components';

import { getCreatorCardTranslations } from './CreatorCard.helpers';
import { getCreatorFieldLabels } from '../../util/creatorFields';

import css from './CreatorCard.module.css';

const LazyImage = lazyLoadWithDimensions(ResponsiveImage, { loadAfterInitialRendering: 3000 });

// Portrait aspect ratio: portfolio media should dominate the card, more so than
// the near-square crop the generic ListingCard uses for product photos.
const ASPECT_WIDTH = 4;
const ASPECT_HEIGHT = 5;

// How many niche tags to show before collapsing the rest into "+N".
const MAX_VISIBLE_NICHE_TAGS = 3;

const CreatorCardImage = props => {
  const { listing, setActivePropsMaybe, title, renderSizes, variantPrefix, lazyLoadImage } = props;

  const firstImage = listing?.images?.[0] || null;
  const variants = firstImage
    ? Object.keys(firstImage?.attributes?.variants).filter(k => k.startsWith(variantPrefix))
    : [];

  const ImageComponent = lazyLoadImage ? LazyImage : ResponsiveImage;

  return (
    <AspectRatioWrapper
      className={css.aspectRatioWrapper}
      width={ASPECT_WIDTH}
      height={ASPECT_HEIGHT}
      {...setActivePropsMaybe}
    >
      <ImageComponent
        rootClassName={css.rootForImage}
        alt={title}
        image={firstImage}
        variants={variants}
        sizes={renderSizes}
      />
    </AspectRatioWrapper>
  );
};

/**
 * CreatorCard
 *
 * Portfolio-first card for `creator-profile` listings: media dominant, creator
 * identity second, price tertiary. Rendered by SearchResultsPanel in place of
 * the generic ListingCard for that listing type only — ListingCard itself is
 * untouched since it still serves every other listing type.
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

  const { className, rootClassName, listing, renderSizes, setActiveListing, lazyLoadImage = true } = props;

  const translations = getCreatorCardTranslations(listing, config, intl);
  const {
    titlePlain,
    titleFormatted,
    cardAriaLabel,
    showPrice,
    priceTooltip,
    priceMessage,
    authorDisplayName,
  } = translations;

  const classes = classNames(rootClassName || css.root, className);

  const id = listing?.id?.uuid;
  const { title = '', publicData = {} } = listing?.attributes || {};
  const slug = createSlug(title);

  const { listingType, cardStyle } = publicData;
  const validListingTypes = config.listing.listingTypes || [];
  const foundListingTypeConfig = validListingTypes.find(conf => conf.listingType === listingType);
  const showListingImage = requireListingImage(foundListingTypeConfig);

  const { variantPrefix = 'listing-card' } = config.layout.listingImage;

  const { nicheLabels, platformLabels, usageRightsLabel, deliverableCount, turnaroundDays } =
    getCreatorFieldLabels(publicData, config.listing.listingFields);

  const visibleNicheTags = nicheLabels.slice(0, MAX_VISIBLE_NICHE_TAGS);
  const hiddenNicheTagCount = nicheLabels.length - visibleNicheTags.length;

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
    >
      <div className={css.imageWrapper}>
        {showListingImage ? (
          <CreatorCardImage
            renderSizes={renderSizes}
            title={titlePlain}
            listing={listing}
            setActivePropsMaybe={setActivePropsMaybe}
            variantPrefix={variantPrefix}
            lazyLoadImage={lazyLoadImage}
          />
        ) : (
          <ListingCardThumbnail
            style={cardStyle}
            listingTitle={title}
            className={css.aspectRatioWrapper}
            width={ASPECT_WIDTH}
            height={ASPECT_HEIGHT}
            setActivePropsMaybe={setActivePropsMaybe}
          />
        )}
        <span className={css.vettedBadge}>
          <IconCheckmark rootClassName={css.vettedBadgeIcon} size="small" />
          <FormattedMessage id="CreatorCard.vetted" />
        </span>
      </div>
      <div className={css.info}>
        <div className={css.authorRow}>
          <span className={css.authorName}>{authorDisplayName}</span>
          {showPrice ? (
            <span className={css.price} title={priceTooltip}>
              {priceMessage}
            </span>
          ) : null}
        </div>
        <div className={css.title}>{titleFormatted}</div>
        {visibleNicheTags.length > 0 ? (
          <div className={css.tagRow}>
            {visibleNicheTags.map(tag => (
              <span key={tag} className={css.tag}>
                {tag}
              </span>
            ))}
            {hiddenNicheTagCount > 0 ? (
              <span className={css.tag}>
                <FormattedMessage
                  id="CreatorCard.moreTags"
                  values={{ count: hiddenNicheTagCount }}
                />
              </span>
            ) : null}
          </div>
        ) : null}
        {platformLabels.length > 0 ? (
          <div className={css.metaRow}>{platformLabels.join(' · ')}</div>
        ) : null}
        <div className={css.metaRow}>
          {deliverableCount != null ? (
            <span className={css.metaItem}>
              <FormattedMessage id="CreatorCard.deliverables" values={{ count: deliverableCount }} />
            </span>
          ) : null}
          {turnaroundDays != null ? (
            <span className={css.metaItem}>
              <FormattedMessage id="CreatorCard.turnaround" values={{ days: turnaroundDays }} />
            </span>
          ) : null}
        </div>
        {usageRightsLabel ? (
          <div className={css.usageRights}>
            <FormattedMessage
              id="CreatorCard.usageRights"
              values={{ usageRights: usageRightsLabel }}
            />
          </div>
        ) : null}
      </div>
    </NamedLink>
  );
};

export default CreatorCard;
