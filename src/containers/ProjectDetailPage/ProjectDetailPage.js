import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { getProjectFieldLabels } from '../../util/creatorFields';
import { isBrandUserType, isUserAuthorized } from '../../util/userHelpers';
import { formatDateIntoPartials } from '../../util/dates';
import { showListing, sendInquiry } from '../ListingPage/ListingPage.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  Avatar,
  NamedLink,
  NamedRedirect,
  IconSpinner,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import InquiryForm from '../ListingPage/InquiryForm/InquiryForm';

import css from './ProjectDetailPage.module.css';

const { UUID } = sdkTypes;

/**
 * A creator's read-only view of a project, reached by clicking "View project" on
 * BrowseProjectsPage. Shows the brand's project details (sourced from their
 * published project-brief listing, same data ListingPage would show), plus
 * an "apply" form. Mirrors CreatorProfilePage on the brand side, which
 * reuses ListingPage.duck the same way instead of a purpose-built duck.
 *
 * A purpose-built page (rather than routing to the generic ListingPage)
 * because a project isn't a product: it needs to show niche/platforms/budget
 * framing and an apply form, not a product gallery and price.
 *
 * @param {Object} props
 * @param {Object} props.params - Route params, expects params.id (the
 *   project-brief listing id)
 * @returns {JSX.Element}
 */
const ProjectDetailPage = props => {
  const { params } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const routes = useRouteConfiguration();
  const history = useHistory();
  const dispatch = useDispatch();

  const listingId = new UUID(params.id);

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { showListingError, sendInquiryInProgress, sendInquiryError } = useSelector(
    state => state.ListingPage
  );

  useEffect(() => {
    dispatch(showListing(listingId, config)).catch(() => {
      // Ignore, error handling in duck file / showListingError below.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const listing = useSelector(
    state => getMarketplaceEntities(state, [{ id: listingId, type: 'listing' }])[0]
  );

  if (isBrandUserType(config, currentUser)) {
    return <NamedRedirect name="ExploreCreatorsPage" />;
  }

  const brand = listing?.author;
  const brandName = brand?.attributes?.profile?.displayName;
  const projectTitle = listing?.attributes?.title;
  const description = listing?.attributes?.description;
  const publicData = listing?.attributes?.publicData || {};
  const createdAt = listing?.attributes?.createdAt;
  const { nicheLabels, platformLabels, budgetRangeLabel, deadline } = getProjectFieldLabels(
    publicData,
    config.listing.listingFields
  );
  const postedOn = createdAt ? formatDateIntoPartials(createdAt, intl).date : null;

  const isAuthorized = isUserAuthorized(currentUser);

  const handleApplySubmit = values => {
    const { message } = values;
    dispatch(sendInquiry(listing, message.trim()))
      .then(txId => {
        history.push(createResourceLocatorString('OrderDetailsPage', routes, { id: txId.uuid }, {}));
      })
      .catch(() => {
        // Ignore, error handling in duck file
      });
  };

  const title = projectTitle
    ? intl.formatMessage({ id: 'ProjectDetailPage.schemaTitle' }, { title: projectTitle })
    : '';

  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="BrowseProjectsPage"
            role="creator"
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>
          {showListingError ? (
            <p className={css.error}>
              <FormattedMessage id="ProjectDetailPage.loadFailed" />
            </p>
          ) : !listing ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <div className={css.layout}>
              <div className={css.main}>
                <div className={css.headerCard}>
                  <Avatar user={brand} className={css.avatar} disableProfileLink />
                  <div className={css.headerInfo}>
                    <Heading as="h1" rootClassName={css.heading}>
                      {projectTitle}
                    </Heading>
                    <p className={css.postedBy}>
                      <FormattedMessage id="ProjectDetailPage.postedBy" values={{ brandName }} />
                    </p>
                  </div>
                </div>

                <section className={css.section}>
                  <Heading as="h2" rootClassName={css.sectionHeading}>
                    <FormattedMessage id="ProjectDetailPage.aboutProject" />
                  </Heading>
                  <p className={css.description}>{description}</p>
                </section>

                <section className={css.section}>
                  <div className={css.detailGrid}>
                    {nicheLabels.length > 0 ? (
                      <div className={css.detailItem}>
                        <span className={css.detailLabel}>
                          <FormattedMessage id="ProjectDetailPage.nicheLabel" />
                        </span>
                        <span className={css.detailValue}>{nicheLabels.join(', ')}</span>
                      </div>
                    ) : null}
                    {platformLabels.length > 0 ? (
                      <div className={css.detailItem}>
                        <span className={css.detailLabel}>
                          <FormattedMessage id="ProjectDetailPage.platformsLabel" />
                        </span>
                        <span className={css.detailValue}>{platformLabels.join(', ')}</span>
                      </div>
                    ) : null}
                    {budgetRangeLabel ? (
                      <div className={css.detailItem}>
                        <span className={css.detailLabel}>
                          <FormattedMessage id="ProjectDetailPage.budgetLabel" />
                        </span>
                        <span className={css.detailValue}>{budgetRangeLabel}</span>
                      </div>
                    ) : null}
                    {deadline ? (
                      <div className={css.detailItem}>
                        <span className={css.detailLabel}>
                          <FormattedMessage id="ProjectDetailPage.deadlineLabel" />
                        </span>
                        <span className={css.detailValue}>{deadline}</span>
                      </div>
                    ) : null}
                  </div>
                  {postedOn ? (
                    <p className={css.postedOn}>
                      <FormattedMessage id="ProjectDetailPage.postedOn" values={{ date: postedOn }} />
                    </p>
                  ) : null}
                </section>
              </div>

              <aside className={css.sidebar}>
                <div className={css.applyCard}>
                  <Heading as="h2" rootClassName={css.sectionHeading}>
                    <FormattedMessage id="ProjectDetailPage.applyHeading" />
                  </Heading>
                  <p className={css.applySubtitle}>
                    <FormattedMessage id="ProjectDetailPage.applySubtitle" />
                  </p>

                  {!currentUser ? (
                    <div className={css.loading}>
                      <IconSpinner />
                    </div>
                  ) : !isAuthorized ? (
                    <div className={css.pendingApproval}>
                      <Heading as="h3" rootClassName={css.pendingApprovalTitle}>
                        <FormattedMessage id="ProjectDetailPage.pendingApprovalTitle" />
                      </Heading>
                      <p className={css.pendingApprovalBody}>
                        <FormattedMessage id="ProjectDetailPage.pendingApprovalBody" />
                      </p>
                      <NamedLink name="CreatorOnboardingPage" className={css.pendingApprovalCta}>
                        <FormattedMessage id="ProjectDetailPage.pendingApprovalCta" />
                      </NamedLink>
                    </div>
                  ) : (
                    <InquiryForm
                      className={css.applyForm}
                      submitButtonWrapperClassName={css.applySubmitButtonWrapper}
                      listingTitle={projectTitle}
                      authorDisplayName={brandName}
                      sendInquiryError={sendInquiryError}
                      onSubmit={handleApplySubmit}
                      inProgress={sendInquiryInProgress}
                    />
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ProjectDetailPage;
