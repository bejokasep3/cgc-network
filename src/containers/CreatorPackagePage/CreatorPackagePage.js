import React, { useEffect, useState } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useHistory, useLocation } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { isFieldForListingType } from '../../util/fieldHelpers';
import { LISTING_STATE_DRAFT } from '../../util/types';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { createResourceLocatorString } from '../../util/routes';
import {
  isUserAuthorized,
  getOnboardingRouteName,
  cameFromOnboardingChecklist,
} from '../../util/userHelpers';
import {
  requestCreateListingDraft,
  requestUpdateListing,
  requestPublishListingDraft,
  requestImageUpload,
  removeListingImage,
} from '../EditListingPage/EditListingPage.duck';
import { fetchOwnListingThunk, setListingId } from './CreatorPackagePage.duck';

import { Heading, Page, LayoutSingleColumn, NamedRedirect } from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import EditListingPhotosForm from '../EditListingPage/EditListingWizard/EditListingPhotosPanel/EditListingPhotosForm';
import CreatorPackageDetailsForm from './CreatorPackageDetailsForm';

import css from './CreatorPackagePage.module.css';

const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';
const CREATOR_PROCESS_ALIAS = 'cgc-ugc-approval/release-1';
const CREATOR_UNIT_TYPE = 'item';

// configListing.js gives creator-profile listings stockType 'infiniteOneItem'
// ("always available, not counted stock" — see its comment there), but the
// Marketplace API still requires an actual stock resource to be set before a
// checkout can reserve against the listing, or it 409s with
// transaction-listing-insufficient-stock. The standard EditListingWizard
// flow sets this via EditListingPricingAndStockPanel's "infinity" checkbox
// (same BILLIARD constant), but this page builds its own minimal wizard and
// never goes through that panel, so it has to set it here instead.
const BILLIARD = 1000000000000000;

// Same merge logic EditListingPage.js uses: images already attached to the
// listing, plus images uploaded in this session but not yet saved, minus
// anything marked for removal.
const pickRenderableImages = (listing, uploadedImages, uploadedImagesOrder = [], removedImageIds = []) => {
  const currentListingImages = listing?.images || [];
  const unattachedImages = uploadedImagesOrder.map(i => uploadedImages[i]);
  const allImages = currentListingImages.concat(unattachedImages);

  const pickImagesAndIds = (imgs, img) => {
    const imgId = img.imageId || img.id;
    const shouldInclude = !imgs.imageIds.includes(imgId) && !removedImageIds.includes(imgId);
    if (shouldInclude) {
      imgs.imageEntities.push(img);
      imgs.imageIds.push(imgId);
    }
    return imgs;
  };

  return allImages.reduce(pickImagesAndIds, { imageEntities: [], imageIds: [] }).imageEntities;
};

/**
 * A creator's own editable package: title, description, and the custom
 * fields configured for the creator-profile listing type (niche, platforms,
 * usage rights, deliverable count, turnaround days), plus portfolio photos.
 * This *is* the creator's public profile — CreatorProfilePage and CreatorCard
 * both render straight off the same creator-profile listing this page edits.
 *
 * Purpose-built (details + photos on one page, no listing-type picker)
 * instead of routing into the generic multi-tab EditListingWizard — mirrors
 * PostProjectPage's reasoning for brands, adapted for a listing that gets
 * edited repeatedly instead of created fresh each time.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {propTypes.currentUser} props.currentUser
 * @param {Object} props.editListingPageState - state.EditListingPage
 * @param {Function} props.onFetchOwnListing
 * @param {Function} props.onCreateListingDraft
 * @param {Function} props.onUpdateListing
 * @param {Function} props.onPublishListingDraft
 * @param {Function} props.onImageUpload
 * @param {Function} props.onRemoveListingImage
 * @param {Function} props.onLogout
 * @returns {JSX.Element}
 */
export const CreatorPackagePageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const history = useHistory();
  const location = useLocation();
  const {
    scrollingDisabled,
    currentUser,
    listing,
    editListingPageState,
    onFetchOwnListing,
    onCreateListingDraft,
    onUpdateListing,
    onPublishListingDraft,
    onImageUpload,
    onRemoveListingImage,
    onLogout,
  } = props;

  // Opened from the onboarding checklist? A published listing is what
  // actually satisfies this step (creatorSetupSteps.js), so the return trip
  // happens once photos are saved (which is also what triggers the publish
  // below) — not after the details save, which alone doesn't finish the step.
  const returnToOnboarding = cameFromOnboardingChecklist(location);

  const [detailsSubmitError, setDetailsSubmitError] = useState(null);

  useEffect(() => {
    onFetchOwnListing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFetchOwnListing]);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const displayName = currentUser?.attributes?.profile?.displayName;
  const title = intl.formatMessage({ id: 'CreatorPackagePage.schemaTitle' });
  const listingFieldsConfig = config.listing.listingFields;
  const publicData = listing?.attributes?.publicData || {};

  const handleDetailsSubmit = values => {
    const { title: packageTitle, description, ...customFieldValues } = values;
    setDetailsSubmitError(null);

    if (listing?.id) {
      onUpdateListing(
        'details',
        {
          id: listing.id,
          title: packageTitle.trim(),
          description,
          publicData: customFieldValues,
        },
        config
      ).catch(e => setDetailsSubmitError(e));
    } else {
      onCreateListingDraft(
        {
          title: packageTitle.trim(),
          description,
          publicData: {
            listingType: CREATOR_PROFILE_LISTING_TYPE,
            transactionProcessAlias: CREATOR_PROCESS_ALIAS,
            unitType: CREATOR_UNIT_TYPE,
            ...customFieldValues,
          },
          stockUpdate: { oldTotal: null, newTotal: BILLIARD },
        },
        config
      ).catch(e => setDetailsSubmitError(e));
    }
  };

  const handlePhotosSubmit = values => {
    if (!listing?.id) {
      return;
    }
    onUpdateListing('photos', { id: listing.id, images: values.images }, config)
      .then(() => {
        return listing.attributes.state === LISTING_STATE_DRAFT
          ? onPublishListingDraft(listing.id)
          : null;
      })
      .then(() => {
        if (returnToOnboarding) {
          const onboardingRouteName = getOnboardingRouteName(config, currentUser);
          history.push(
            createResourceLocatorString(onboardingRouteName, routeConfiguration, {}, {})
          );
        }
      });
  };

  const images = pickRenderableImages(
    listing,
    editListingPageState.uploadedImages,
    editListingPageState.uploadedImagesOrder,
    editListingPageState.removedImageIds
  );

  const initialDetailsValues = {
    title: listing?.attributes?.title,
    description: listing?.attributes?.description,
    ...listingFieldsConfig
      .filter(fieldConfig => isFieldForListingType(CREATOR_PROFILE_LISTING_TYPE, fieldConfig))
      .reduce((values, fieldConfig) => {
        values[fieldConfig.key] = publicData[fieldConfig.key];
        return values;
      }, {}),
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<DashboardTopbar displayName={displayName} role="creator" onLogout={onLogout} />}
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="CreatorPackagePage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="CreatorPackagePage.subtitle" />
          </p>

          <section className={css.section}>
            <Heading as="h2" rootClassName={css.sectionHeading}>
              <FormattedMessage id="CreatorPackagePage.detailsHeading" />
            </Heading>
            <CreatorPackageDetailsForm
              initialValues={initialDetailsValues}
              listingFieldsConfig={listingFieldsConfig}
              onSubmit={handleDetailsSubmit}
              inProgress={
                editListingPageState.createListingDraftInProgress ||
                editListingPageState.updateInProgress
              }
              apiSubmitError={
                editListingPageState.createListingDraftError ||
                editListingPageState.updateListingError ||
                detailsSubmitError
              }
            />
          </section>

          {listing?.id ? (
            <section className={css.section}>
              <Heading as="h2" rootClassName={css.sectionHeading}>
                <FormattedMessage id="CreatorPackagePage.photosHeading" />
              </Heading>
              <EditListingPhotosForm
                initialValues={{ images }}
                onImageUpload={onImageUpload}
                onRemoveImage={onRemoveListingImage}
                onSubmit={handlePhotosSubmit}
                saveActionMsg={intl.formatMessage({ id: 'CreatorPackagePage.savePhotosButton' })}
                updated={false}
                ready={false}
                updateInProgress={editListingPageState.updateInProgress}
                fetchErrors={{
                  publishListingError: editListingPageState.publishListingError,
                  showListingsError: editListingPageState.showListingsError,
                  updateListingError: editListingPageState.updateListingError,
                  uploadImageError: editListingPageState.uploadImageError,
                }}
                listingImageConfig={config.layout.listingImage}
              />
            </section>
          ) : null}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { listingId } = state.CreatorPackagePage;
  const listings = listingId
    ? getMarketplaceEntities(state, [{ id: listingId, type: 'ownListing' }])
    : [];

  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser: state.user.currentUser,
    listing: listings.length === 1 ? listings[0] : null,
    editListingPageState: state.EditListingPage,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchOwnListing: () => dispatch(fetchOwnListingThunk()),
  onCreateListingDraft: (values, config) =>
    dispatch(requestCreateListingDraft(values, config)).then(response => {
      const id = response.data.data.id;
      dispatch(setListingId(id));
      return response;
    }),
  onUpdateListing: (tab, values, config) => dispatch(requestUpdateListing(tab, values, config)),
  onPublishListingDraft: listingId => dispatch(requestPublishListingDraft(listingId)),
  onImageUpload: (data, listingImageConfig) =>
    dispatch(requestImageUpload(data, listingImageConfig)),
  onRemoveListingImage: imageId => dispatch(removeListingImage(imageId)),
  onLogout: () => dispatch(logout()),
});

const CreatorPackagePage = compose(connect(mapStateToProps, mapDispatchToProps))(
  CreatorPackagePageComponent
);

export default CreatorPackagePage;
