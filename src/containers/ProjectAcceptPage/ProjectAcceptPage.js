import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { types as sdkTypes } from '../../util/sdkLoader';
import { parse, createSlug } from '../../util/urlHelpers';
import { createResourceLocatorString } from '../../util/routes';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { formatMoney } from '../../util/currency';
import { getAgreedPriceInSubunits } from '../../util/application';
import { getProjectFieldLabels } from '../../util/creatorFields';
import { getProcess, CGC_APPLICATION_PROCESS_NAME } from '../../transactions/transaction';
import { states as applicationStates } from '../../transactions/transactionProcessCGCApplication';
import { isUserAuthorized } from '../../util/userHelpers';
import { showListing } from '../ListingPage/ListingPage.duck';
import { fetchApplicationThunk, fetchInvitationTxThunk } from './ProjectAcceptPage.duck';
import CheckoutPage from '../CheckoutPage/CheckoutPage';
import { DELIVERABLE_TYPE_OPTIONS } from '../PostProjectPage/PostProjectForm';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  Avatar,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  PrimaryButton,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './ProjectAcceptPage.module.css';

const { UUID, Money } = sdkTypes;

// BLUEPRINT.md R6/R15: revision allowance is fixed, not configurable per
// project, so this confirmation screen can state it as a plain fact.
const REVISION_ALLOWANCE = 2;

export const deliverableTypeLabel = (intl, type) => {
  const option = DELIVERABLE_TYPE_OPTIONS.find(o => o.key === type);
  return option ? intl.formatMessage({ id: option.labelId }) : type;
};

export const platformLabel = (listingFieldConfigs, value) => {
  const platformsConfig = (listingFieldConfigs || []).find(c => c.key === 'platforms');
  const option = platformsConfig?.enumOptions?.find(o => `${o.option}` === `${value}`);
  return option?.label || value;
};

const DeliverablesList = ({ deliverables, listingFieldConfigs, intl }) => (
  <ul className={css.deliverablesList}>
    {deliverables.map(d => (
      <li key={d.id} className={css.deliverableItem}>
        <span className={css.deliverableSummary}>
          <FormattedMessage
            id="ProjectAcceptPage.deliverableSummary"
            values={{
              quantity: d.quantity,
              type: deliverableTypeLabel(intl, d.type),
              platform: platformLabel(listingFieldConfigs, d.platform),
            }}
          />
        </span>
        {d.spec ? <span className={css.deliverableSpec}>{d.spec}</span> : null}
      </li>
    ))}
  </ul>
);

/**
 * B9 — the confirm-and-pay screen (IMPLEMENTATION-PLAN.md F2.6). A brand
 * lands here after accepting an applicant's card on ProjectDetailPage, sees
 * the whole deal on one screen (deliverables, deadline, usage rights,
 * revision allowance, price — BLUEPRINT R6), then proceeds into the
 * standard Stripe checkout flow, driven at the creator-profile listing with
 * orderData `{ applicationId }` — no price ever travels from this page to
 * the server; the server looks the agreed price up itself
 * (server/api-util/cgcCheckout.js#fetchAgreedPriceMoney).
 *
 * @param {Object} props
 * @param {Object} props.params - Route params, expects params.id (the project listing id)
 * @param {Object} props.location - route location, expects ?applicationId=<uuid>
 * @returns {JSX.Element}
 */
const ProjectAcceptPage = props => {
  const { params, location } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();

  const projectListingId = new UUID(params.id);
  const applicationIdParam = parse(location?.search || '')?.applicationId || null;

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { showListingError } = useSelector(state => state.ListingPage);
  const {
    applicationFetched,
    applicationFetchError,
    applicationRef,
    invitationTxFetched,
    invitationTxRef,
  } = useSelector(state => state.ProjectAcceptPage);

  const application = useSelector(state =>
    applicationRef ? getMarketplaceEntities(state, [applicationRef])[0] : null
  );
  const invitationTx = useSelector(state =>
    invitationTxRef ? getMarketplaceEntities(state, [invitationTxRef])[0] : null
  );

  useEffect(() => {
    if (!applicationIdParam) {
      return;
    }
    dispatch(showListing(projectListingId, config)).catch(() => {});
    dispatch(fetchApplicationThunk({ applicationId: new UUID(applicationIdParam) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, applicationIdParam]);

  const projectListing = useSelector(
    state => getMarketplaceEntities(state, [{ id: projectListingId, type: 'listing' }])[0]
  );

  const protectedData = application?.attributes?.protectedData || {};
  const metadata = application?.attributes?.metadata || {};
  const creatorListingId = protectedData.creatorListingId;
  const applicationState = application
    ? getProcess(CGC_APPLICATION_PROCESS_NAME).getState(application)
    : null;

  useEffect(() => {
    if (!creatorListingId) {
      return;
    }
    dispatch(showListing(new UUID(creatorListingId), config)).catch(() => {});
    dispatch(fetchInvitationTxThunk({ projectId: params.id, creatorListingId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorListingId]);

  const creatorProfileListing = useSelector(state =>
    creatorListingId
      ? getMarketplaceEntities(state, [{ id: new UUID(creatorListingId), type: 'listing' }])[0]
      : null
  );

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const isOwner =
    !!currentUser && !!projectListing && projectListing.author?.id?.uuid === currentUser.id?.uuid;

  const alreadyLinked = !!protectedData.collaborationTxId;
  const invalidApplication =
    applicationFetched &&
    (!application ||
      applicationState !== applicationStates.ACCEPTED ||
      alreadyLinked ||
      protectedData.projectId !== params.id);

  const handleProceedToPayment = () => {
    if (!creatorProfileListing || !application) {
      return;
    }
    dispatch(
      CheckoutPage.setInitialValues(
        {
          listing: creatorProfileListing,
          orderData: {
            quantity: 1,
            applicationId: application.id,
            projectId: projectListing.id,
          },
          transaction: invitationTx || null,
        },
        false
      )
    );
    history.push(
      createResourceLocatorString(
        'CheckoutPage',
        routeConfiguration,
        { id: creatorProfileListing.id.uuid, slug: createSlug(creatorProfileListing.attributes.title) },
        {}
      )
    );
  };

  const title = intl.formatMessage({ id: 'ProjectAcceptPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;
  const creator = application?.customer;
  const creatorDisplayName = creator?.attributes?.profile?.displayName;

  const publicData = projectListing?.attributes?.publicData || {};
  const { usageRightsLabel, contentDueDate, deliverableCount } = getProjectFieldLabels(
    publicData,
    config.listing.listingFields
  );
  const deliverables = Array.isArray(publicData.deliverables) ? publicData.deliverables : [];

  const agreedPriceInSubunits = getAgreedPriceInSubunits(metadata);
  const currency = projectListing?.attributes?.price?.currency || config.currency;
  const priceLabel = Number.isInteger(agreedPriceInSubunits)
    ? formatMoney(intl, new Money(agreedPriceInSubunits, currency))
    : null;

  const isLoading =
    !projectListing ||
    !applicationFetched ||
    (application && (!creatorListingId || !creatorProfileListing || !invitationTxFetched));

  let content;
  if (!applicationIdParam) {
    content = (
      <div className={css.invalid}>
        <p className={css.error}>
          <FormattedMessage id="ProjectAcceptPage.notAccepted" />
        </p>
        <NamedLink className={css.backLink} name="ProjectDetailPage" params={{ id: params.id }}>
          <FormattedMessage id="ProjectAcceptPage.backToProject" />
        </NamedLink>
      </div>
    );
  } else if (showListingError || applicationFetchError) {
    content = (
      <p className={css.error}>
        <FormattedMessage id="ProjectAcceptPage.loadFailed" />
      </p>
    );
  } else if (currentUser && projectListing && !isOwner) {
    content = (
      <p className={css.error}>
        <FormattedMessage id="ProjectAcceptPage.notOwner" />
      </p>
    );
  } else if (invalidApplication) {
    content = (
      <div className={css.invalid}>
        <p className={css.error}>
          <FormattedMessage
            id={
              alreadyLinked
                ? 'ProjectAcceptPage.alreadyPaid'
                : 'ProjectAcceptPage.notAccepted'
            }
          />
        </p>
        <NamedLink className={css.backLink} name="ProjectDetailPage" params={{ id: params.id }}>
          <FormattedMessage id="ProjectAcceptPage.backToProject" />
        </NamedLink>
      </div>
    );
  } else if (isLoading) {
    content = (
      <div className={css.loading}>
        <IconSpinner />
      </div>
    );
  } else {
    content = (
      <>
        <Heading as="h1" rootClassName={css.heading}>
          <FormattedMessage id="ProjectAcceptPage.heading" values={{ creatorName: creatorDisplayName }} />
        </Heading>
        <p className={css.subtitle}>
          <FormattedMessage id="ProjectAcceptPage.subtitle" />
        </p>

        <div className={css.creatorRow}>
          <Avatar user={creator} className={css.avatar} disableProfileLink />
          <span className={css.creatorName}>{creatorDisplayName}</span>
        </div>

        <section className={css.section}>
          <Heading as="h2" rootClassName={css.sectionHeading}>
            <FormattedMessage id="ProjectAcceptPage.deliverablesHeading" values={{ count: deliverableCount }} />
          </Heading>
          {deliverables.length > 0 ? (
            <DeliverablesList
              deliverables={deliverables}
              listingFieldConfigs={config.listing.listingFields}
              intl={intl}
            />
          ) : null}
        </section>

        <section className={css.section}>
          <div className={css.detailGrid}>
            {contentDueDate ? (
              <div className={css.detailItem}>
                <span className={css.detailLabel}>
                  <FormattedMessage id="ProjectAcceptPage.deadlineLabel" />
                </span>
                <span className={css.detailValue}>{contentDueDate}</span>
              </div>
            ) : null}
            {usageRightsLabel ? (
              <div className={css.detailItem}>
                <span className={css.detailLabel}>
                  <FormattedMessage id="ProjectAcceptPage.usageRightsLabel" />
                </span>
                <span className={css.detailValue}>{usageRightsLabel}</span>
              </div>
            ) : null}
            <div className={css.detailItem}>
              <span className={css.detailLabel}>
                <FormattedMessage id="ProjectAcceptPage.revisionsLabel" />
              </span>
              <span className={css.detailValue}>
                <FormattedMessage
                  id="ProjectAcceptPage.revisionsValue"
                  values={{ count: REVISION_ALLOWANCE }}
                />
              </span>
            </div>
          </div>
        </section>

        <section className={css.priceSection}>
          <span className={css.priceLabel}>
            <FormattedMessage id="ProjectAcceptPage.priceLabel" />
          </span>
          <span className={css.priceValue}>{priceLabel}</span>
        </section>

        <PrimaryButton type="button" className={css.payButton} onClick={handleProceedToPayment}>
          <FormattedMessage id="ProjectAcceptPage.proceedToPayment" />
        </PrimaryButton>
        <NamedLink className={css.backLink} name="ProjectDetailPage" params={{ id: params.id }}>
          <FormattedMessage id="ProjectAcceptPage.cancel" />
        </NamedLink>
      </>
    );
  }

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="ManageCampaignsPage"
            role="brand"
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>{content}</div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ProjectAcceptPage;
