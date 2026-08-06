import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import classNames from 'classnames';
import { ChevronLeft, Pencil, Copy, Trash2 } from 'lucide-react';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled, manageDisableScrolling } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { fetchOwnCreatorProfileThunk } from '../../ducks/creatorProfile.duck';
import { getProjectFieldLabels, getListingFieldOptionLabel } from '../../util/creatorFields';
import { isBrandUserType, isUserAuthorized } from '../../util/userHelpers';
import { formatDateIntoPartials } from '../../util/dates';
import { formatMoney } from '../../util/currency';
import { createResourceLocatorString } from '../../util/routes';
import { checkBrandAccess, isSubscriptionStatusResolved } from '../../util/subscription';
import { getProcess, CGC_APPLICATION_PROCESS_NAME } from '../../transactions/transaction';
import { showListing } from '../ListingPage/ListingPage.duck';
import {
  fetchOwnApplicationThunk,
  applyToProjectThunk,
  fetchProjectApplicantsThunk,
  fetchProjectCollaborationsThunk,
  acceptApplicationThunk,
  declineApplicationThunk,
  counterApplicationThunk,
} from './ProjectDetailPage.duck';
import { setProjectVisibilityThunk } from '../ManageCampaignsPage/ManageCampaignsPage.duck';
import { deriveProjectOverview } from './projectOverviewStats';
import { DELIVERABLE_TYPE_OPTIONS } from '../PostProjectPage/PostProjectForm';
import {
  buildProjectPrefillInitialValues,
  storePostProjectPrefill,
} from '../PostProjectPage/postProjectPrefill';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  Avatar,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  InlineTextButton,
  Button,
  Modal,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import ApplyForm from './ApplyForm';
import ApplicantCard from './ApplicantCard';

import css from './ProjectDetailPage.module.css';

const { UUID, Money } = sdkTypes;

// sanitize.css sets a global `svg { fill: currentColor }` rule that overrides
// the icon's own `fill="none"` attribute, so it's forced back via inline
// style (which beats stylesheet rules) to keep these as outlines, not solid
// shapes — same fix as DashboardTopbar/accountMenuIcons.js.
const ICON_FILL_NONE = { fill: 'none' };

// Shared with ManageCampaignsPage.js's "N applicants" row link, which jumps
// straight to ApplicantsSection via a URL hash instead of the top of the page.
export const APPLICANTS_ANCHOR = 'applicants';

// A state a creator's own application can be in, mapped to the copy shown in
// the "already applied" card. `countered` intentionally has no accept/decline
// action here yet — responding to a brand's counter-offer is its own bit of
// UI (needs the same "accepting should look lighter than countering back"
// treatment as the initial apply), scoped for after F2.4 builds the brand
// side of a counter to respond to.
const APPLICATION_STATUS_LABEL_IDS = {
  applied: 'ProjectDetailPage.applicationStatus.applied',
  countered: 'ProjectDetailPage.applicationStatus.countered',
  accepted: 'ProjectDetailPage.applicationStatus.accepted',
  declined: 'ProjectDetailPage.applicationStatus.declined',
  withdrawn: 'ProjectDetailPage.applicationStatus.withdrawn',
  expired: 'ProjectDetailPage.applicationStatus.expired',
};

const AlreadyAppliedCard = ({ tx }) => {
  const state = getProcess(CGC_APPLICATION_PROCESS_NAME).getState(tx);
  const labelId = APPLICATION_STATUS_LABEL_IDS[state] || APPLICATION_STATUS_LABEL_IDS.applied;
  return (
    <div className={css.alreadyApplied}>
      <Heading as="h3" rootClassName={css.alreadyAppliedTitle}>
        <FormattedMessage id="ProjectDetailPage.alreadyAppliedTitle" />
      </Heading>
      <p className={css.alreadyAppliedBody}>
        <FormattedMessage id={labelId} />
      </p>
    </div>
  );
};

const NeedsProfileGuard = () => (
  <div className={css.pendingApproval}>
    <Heading as="h3" rootClassName={css.pendingApprovalTitle}>
      <FormattedMessage id="ProjectDetailPage.needsProfileTitle" />
    </Heading>
    <p className={css.pendingApprovalBody}>
      <FormattedMessage id="ProjectDetailPage.needsProfileBody" />
    </p>
    <NamedLink name="CreatorPackagePage" className={css.pendingApprovalCta}>
      <FormattedMessage id="ProjectDetailPage.needsProfileCta" />
    </NamedLink>
  </div>
);

// A creator reaching a project's apply form after it's already matched to
// someone else — e.g. a stale link, or Browse Projects hasn't refreshed yet
// since the listing closed. No CTA here; there's nothing left to do on this
// project.
const ProjectMatchedGuard = () => (
  <div className={css.pendingApproval}>
    <Heading as="h3" rootClassName={css.pendingApprovalTitle}>
      <FormattedMessage id="ProjectDetailPage.matchedTitle" />
    </Heading>
    <p className={css.pendingApprovalBody}>
      <FormattedMessage id="ProjectDetailPage.matchedBody" />
    </p>
  </div>
);

// Creator-only: avatar + title + "posted by <brand>" — the owner's own view
// has no equivalent (OwnerHeader below shows management actions instead of
// the brand's own identity).
const ProjectHeaderCard = ({ brand, brandName, projectTitle }) => (
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
);

const AboutSection = ({ description }) => (
  <section className={css.cardSection}>
    <Heading as="h2" rootClassName={css.sectionHeading}>
      <FormattedMessage id="ProjectDetailPage.aboutProject" />
    </Heading>
    <p className={css.description}>{description}</p>
  </section>
);

// Renders `publicData.deliverables` (type/platform/quantity/spec per row) as
// a real table — previously only a count was shown (deliverableCount), even
// though the brief always had this much detail. Shared by both roles.
const DeliverablesTable = ({ deliverables, listingFieldConfigs, intl }) => (
  <div className={css.deliverablesTableWrapper}>
    <table className={css.deliverablesTable}>
      <thead>
        <tr>
          <th>
            <FormattedMessage id="ProjectDetailPage.deliverableColType" />
          </th>
          <th>
            <FormattedMessage id="ProjectDetailPage.deliverableColPlatform" />
          </th>
          <th>
            <FormattedMessage id="ProjectDetailPage.deliverableColQuantity" />
          </th>
          <th>
            <FormattedMessage id="ProjectDetailPage.deliverableColSpec" />
          </th>
        </tr>
      </thead>
      <tbody>
        {deliverables.map((deliverable, index) => {
          const typeOption = DELIVERABLE_TYPE_OPTIONS.find(
            option => option.key === deliverable.type
          );
          const typeLabel = typeOption
            ? intl.formatMessage({ id: typeOption.labelId })
            : deliverable.type;
          const platformLabel = getListingFieldOptionLabel(
            listingFieldConfigs,
            'platforms',
            deliverable.platform
          );
          return (
            <tr key={deliverable.id || index}>
              <td>{typeLabel}</td>
              <td>{platformLabel}</td>
              <td>{deliverable.quantity}</td>
              <td>{deliverable.spec}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

// Shared between the creator's read-only view and the brand-owner's view —
// same brief facts either way, split into labeled blocks (Brief information /
// Deliverables / Terms / Creator criteria) instead of one flat detail grid,
// so a longer brief (several deliverable rows) stays readable.
const ProjectBriefBlocks = ({
  projectId,
  projectTitle,
  postedOn,
  deliverables,
  listingFieldConfigs,
  nicheLabels,
  platformLabels,
  priceLabel,
  priceNegotiable,
  contentDueDate,
  usageRightsLabel,
  requiresProduct,
  intl,
}) => (
  <>
    <section className={css.cardSection}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        <FormattedMessage id="ProjectDetailPage.briefInfoHeading" />
      </Heading>
      <div className={css.infoRows}>
        <div className={css.infoRow}>
          <span className={css.infoLabel}>
            <FormattedMessage id="ProjectDetailPage.briefNameLabel" />
          </span>
          <span className={css.infoValue}>{projectTitle}</span>
        </div>
        <div className={css.infoRow}>
          <span className={css.infoLabel}>
            <FormattedMessage id="ProjectDetailPage.briefIdLabel" />
          </span>
          <span className={css.infoValue}>{projectId}</span>
        </div>
        {postedOn ? (
          <div className={css.infoRow}>
            <span className={css.infoLabel}>
              <FormattedMessage id="ProjectDetailPage.briefPostedLabel" />
            </span>
            <span className={css.infoValue}>{postedOn}</span>
          </div>
        ) : null}
      </div>
    </section>

    {deliverables.length > 0 ? (
      <section className={css.cardSection}>
        <Heading as="h2" rootClassName={css.sectionHeading}>
          <FormattedMessage id="ProjectDetailPage.deliverablesHeading" />
        </Heading>
        <DeliverablesTable
          deliverables={deliverables}
          listingFieldConfigs={listingFieldConfigs}
          intl={intl}
        />
      </section>
    ) : null}

    <section className={css.cardSection}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        <FormattedMessage id="ProjectDetailPage.termsHeading" />
      </Heading>
      <div className={css.infoRows}>
        {priceLabel ? (
          <div className={css.infoRow}>
            <span className={css.infoLabel}>
              <FormattedMessage id="ProjectDetailPage.priceLabel" />
            </span>
            <span className={css.infoValue}>{priceLabel}</span>
          </div>
        ) : null}
        <div className={css.infoRow}>
          <span className={css.infoLabel}>
            <FormattedMessage id="ProjectDetailPage.priceNegotiableLabel" />
          </span>
          <span className={css.infoValue}>
            <FormattedMessage
              id={
                priceNegotiable
                  ? 'ProjectDetailPage.priceNegotiableYes'
                  : 'ProjectDetailPage.priceNegotiableNo'
              }
            />
          </span>
        </div>
        {contentDueDate ? (
          <div className={css.infoRow}>
            <span className={css.infoLabel}>
              <FormattedMessage id="ProjectDetailPage.deadlineLabel" />
            </span>
            <span className={css.infoValue}>{contentDueDate}</span>
          </div>
        ) : null}
        {usageRightsLabel ? (
          <div className={css.infoRow}>
            <span className={css.infoLabel}>
              <FormattedMessage id="ProjectDetailPage.usageRightsLabel" />
            </span>
            <span className={css.infoValue}>{usageRightsLabel}</span>
          </div>
        ) : null}
        {requiresProduct ? (
          <div className={css.infoRow}>
            <span className={css.infoLabel}>
              <FormattedMessage id="ProjectDetailPage.requiresProductLabel" />
            </span>
            <span className={css.infoValue}>
              <FormattedMessage id="ProjectDetailPage.requiresProductYes" />
            </span>
          </div>
        ) : null}
      </div>
    </section>

    {nicheLabels.length > 0 || platformLabels.length > 0 ? (
      <section className={css.cardSection}>
        <Heading as="h2" rootClassName={css.sectionHeading}>
          <FormattedMessage id="ProjectDetailPage.creatorCriteriaHeading" />
        </Heading>
        <div className={css.infoRows}>
          {nicheLabels.length > 0 ? (
            <div className={css.infoRow}>
              <span className={css.infoLabel}>
                <FormattedMessage id="ProjectDetailPage.nicheLabel" />
              </span>
              <span className={css.infoValue}>{nicheLabels.join(', ')}</span>
            </div>
          ) : null}
          {platformLabels.length > 0 ? (
            <div className={css.infoRow}>
              <span className={css.infoLabel}>
                <FormattedMessage id="ProjectDetailPage.platformsLabel" />
              </span>
              <span className={css.infoValue}>{platformLabels.join(', ')}</span>
            </div>
          ) : null}
        </div>
      </section>
    ) : null}
  </>
);

// F2.4: the brand-owner's view of who has applied. Every applicant is an
// equal-weight card (BLUEPRINT D2) — none is visually privileged over
// another, and each card's own state (not a global "already responded" flag)
// decides whether it still shows actions.
const ApplicantsSection = ({
  applicants,
  applicantsFetched,
  applicantsFetchInProgress,
  applicantsFetchError,
  listedPriceInSubunits,
  currency,
  marketplaceCurrency,
  projectId,
  respondingToApplicationId,
  respondError,
  onAccept,
  onDecline,
  onCounter,
}) => (
  <section id={APPLICANTS_ANCHOR} className={css.card}>
    <Heading as="h2" rootClassName={css.sectionHeading}>
      <FormattedMessage id="ProjectDetailPage.applicantsHeading" />
    </Heading>

    {applicantsFetchError ? (
      <p className={css.error}>
        <FormattedMessage id="ProjectDetailPage.applicantsLoadFailed" />
      </p>
    ) : applicantsFetchInProgress && !applicantsFetched ? (
      <div className={css.loading}>
        <IconSpinner />
      </div>
    ) : applicants.length === 0 ? (
      <div className={css.applicantsEmpty}>
        <FormattedMessage id="ProjectDetailPage.applicantsEmpty" />
      </div>
    ) : (
      <ul className={css.applicantsList}>
        {applicants.map(tx => (
          <ApplicantCard
            key={tx.id.uuid}
            tx={tx}
            projectId={projectId}
            listedPriceInSubunits={listedPriceInSubunits}
            currency={currency}
            marketplaceCurrency={marketplaceCurrency}
            isResponding={respondingToApplicationId === tx.id.uuid}
            respondError={respondingToApplicationId === tx.id.uuid ? respondError : null}
            onAccept={onAccept}
            onDecline={onDecline}
            onCounter={onCounter}
          />
        ))}
      </ul>
    )}
  </section>
);

// Owner-only header — back button sits inline with the title (same row, same
// vertical center), status/posted date as a plain meta line indented below
// it, and a flat row of icon buttons on the right. No dropdown, no
// visibility toggle (that's ManageCampaignsPage's row control; this page
// doesn't need to duplicate it). "Invite creators" isn't repeated here
// either — it's already the "Creators booked" overview card's CTA.
const OwnerHeader = ({
  projectId,
  projectTitle,
  isDraft,
  isPublished,
  postedOn,
  onDuplicate,
  onOpenCloseModal,
  intl,
}) => (
  <div className={css.ownerHeaderRow}>
    <div className={css.ownerHeaderTitleBlock}>
      <div className={css.ownerHeaderTitleRow}>
        <NamedLink
          name="ManageCampaignsPage"
          className={css.iconButton}
          title={intl.formatMessage({ id: 'ProjectDetailPage.backToProjects' })}
        >
          {/* Not IconArrowHead — its own CSS hardcodes fill to a solid colour
              instead of "none", so it renders as a filled blob rather than the
              clean outline stroke the other icon buttons here use. Going
              straight to the lucide icon with ICON_FILL_NONE keeps it a stroke
              (sanitize.css sets a global `svg { fill: currentColor }` that
              beats the SVG's own fill="none" attribute; an inline style wins
              over both). */}
          <ChevronLeft
            className={css.iconButtonIcon}
            strokeWidth={2}
            style={ICON_FILL_NONE}
            aria-hidden="true"
          />
        </NamedLink>

        <Heading as="h1" rootClassName={css.ownerHeading}>
          {projectTitle}
        </Heading>
      </div>

      <div className={css.ownerHeaderMeta}>
        <FormattedMessage
          id={
            isDraft
              ? 'ProjectDetailPage.statusDraft'
              : isPublished
              ? 'ProjectDetailPage.statusOpen'
              : 'ProjectDetailPage.statusClosed'
          }
        />
        {postedOn ? (
          <>
            <span className={css.ownerHeaderMetaDot}>·</span>
            <FormattedMessage id="ProjectDetailPage.postedOn" values={{ date: postedOn }} />
          </>
        ) : null}
      </div>
    </div>

    <div className={css.ownerHeaderActions}>
      <NamedLink
        className={css.iconButton}
        name="EditProjectPage"
        params={{ id: projectId }}
        title={intl.formatMessage({ id: 'ProjectDetailPage.editProject' })}
      >
        <Pencil
          className={css.iconButtonIcon}
          strokeWidth={1.8}
          style={ICON_FILL_NONE}
          aria-hidden="true"
        />
      </NamedLink>

      <button
        type="button"
        className={css.iconButton}
        onClick={onDuplicate}
        title={intl.formatMessage({ id: 'ProjectDetailPage.duplicateProject' })}
      >
        <Copy
          className={css.iconButtonIcon}
          strokeWidth={1.8}
          style={ICON_FILL_NONE}
          aria-hidden="true"
        />
      </button>

      {isPublished ? (
        <button
          type="button"
          className={css.iconButton}
          onClick={onOpenCloseModal}
          title={intl.formatMessage({ id: 'ProjectDetailPage.closeProject' })}
        >
          <Trash2
            className={css.iconButtonIcon}
            strokeWidth={1.8}
            style={ICON_FILL_NONE}
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  </div>
);

const OverviewCards = ({ overview, projectId }) => {
  const cards = [
    {
      key: 'awaitingApproval',
      value: overview.awaitingApproval,
      labelId: 'ProjectDetailPage.overviewAwaitingApproval',
      muted: overview.awaitingApproval === 0,
      cta: (
        <a href={`#${APPLICANTS_ANCHOR}`} className={css.overviewCardCta}>
          <FormattedMessage id="ProjectDetailPage.overviewApproveCta" />
        </a>
      ),
    },
    {
      key: 'bookedCreators',
      value: overview.bookedCreators,
      labelId: 'ProjectDetailPage.overviewBookedCreators',
      muted: false,
      cta: (
        <NamedLink
          className={css.overviewCardCta}
          name="ProjectInvitePage"
          params={{ id: projectId }}
        >
          <FormattedMessage id="ProjectDetailPage.overviewInviteCta" />
        </NamedLink>
      ),
    },
    {
      key: 'productsToShip',
      value: overview.productsToShip,
      labelId: 'ProjectDetailPage.overviewProductsToShip',
      muted: overview.productsToShip === 0,
      cta: (
        <NamedLink
          className={css.overviewCardCta}
          name="ManageCampaignsPage"
          to={{ search: 'tab=ongoing&ship=need-to-ship' }}
        >
          <FormattedMessage id="ProjectDetailPage.overviewShipCta" />
        </NamedLink>
      ),
    },
    {
      key: 'videosToApprove',
      value: overview.videosToApprove,
      labelId: 'ProjectDetailPage.overviewVideosToApprove',
      muted: overview.videosToApprove === 0,
      cta: (
        <NamedLink
          className={css.overviewCardCta}
          name="ManageCampaignsPage"
          to={{ search: 'tab=ongoing' }}
        >
          <FormattedMessage id="ProjectDetailPage.overviewReviewCta" />
        </NamedLink>
      ),
    },
  ];

  return (
    <section className={css.card}>
      <Heading as="h2" rootClassName={css.sectionHeading}>
        <FormattedMessage id="ProjectDetailPage.overviewHeading" />
      </Heading>
      <p className={css.overviewSubtitle}>
        <FormattedMessage id="ProjectDetailPage.overviewSubtitle" />
      </p>
      <div className={css.overviewCards}>
        {cards.map(card => (
          <div key={card.key} className={css.overviewCard}>
            <span className={css.overviewCardLabel}>
              <FormattedMessage id={card.labelId} />
            </span>
            <span className={css.overviewCardValue}>{card.value}</span>
            <span
              className={classNames(css.overviewCardCtaWrapper, {
                [css.overviewCardCtaMuted]: card.muted,
              })}
            >
              {card.cta}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

const CloseProjectModal = ({
  isOpen,
  awaitingApprovalCount,
  inProgress,
  onManageDisableScrolling,
  onClose,
  onConfirm,
  intl,
}) => (
  <Modal
    id="ProjectDetailPage.closeProjectModal"
    isOpen={isOpen}
    onClose={onClose}
    onManageDisableScrolling={onManageDisableScrolling}
    usePortal
    closeButtonMessage={intl.formatMessage({ id: 'ProjectDetailPage.closeModalDismiss' })}
  >
    <Heading as="h2" rootClassName={css.closeModalTitle}>
      <FormattedMessage id="ProjectDetailPage.closeModalTitle" />
    </Heading>
    <p className={css.closeModalBody}>
      <FormattedMessage
        id={
          awaitingApprovalCount > 0
            ? 'ProjectDetailPage.closeModalBodyWithApplicants'
            : 'ProjectDetailPage.closeModalBody'
        }
        values={{ count: awaitingApprovalCount }}
      />
    </p>
    <div className={css.closeModalActions}>
      <InlineTextButton type="button" onClick={onClose}>
        <FormattedMessage id="ProjectDetailPage.closeModalCancel" />
      </InlineTextButton>
      <Button type="button" onClick={onConfirm} inProgress={inProgress}>
        <FormattedMessage id="ProjectDetailPage.closeModalConfirm" />
      </Button>
    </div>
  </Modal>
);

/**
 * A project's detail page — role-aware (F2.4). A creator sees the brand's
 * brief plus a structured apply form (F2.3, replacing the old generic
 * InquiryForm/sendInquiry flow). The brand who posted it instead sees a
 * "Project overview": progress cards, the same brief, and an
 * applicant-comparison view, in place of the apply sidebar — same page,
 * same route, since `/projects`/`/projects/:id` are already the creator-side
 * board (see IMPLEMENTATION-PLAN.md F2.4's route-conflict note:
 * ManageCampaignsPage stays at `/campaigns` and links into this page, which
 * shows the owner view automatically).
 *
 * @param {Object} props
 * @param {Object} props.params - Route params, expects params.id (the
 *   project listing id)
 * @returns {JSX.Element}
 */
const ProjectDetailPage = props => {
  const { params } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const routeConfiguration = useRouteConfiguration();
  const dispatch = useDispatch();
  const history = useHistory();

  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const listingId = new UUID(params.id);

  const currentUser = useSelector(state => state.user?.currentUser);
  const brandSubscription = useSelector(state => state.brandSubscription);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { showListingError } = useSelector(state => state.ListingPage);
  const creatorProfile = useSelector(state => state.creatorProfile);
  const {
    ownApplication,
    ownApplicationFetched,
    applyInProgress,
    applyError,
    applicantRefs,
    applicantsFetched,
    applicantsFetchInProgress,
    applicantsFetchError,
    collaborationRefs,
    respondingToApplicationId,
    respondError,
  } = useSelector(state => state.ProjectDetailPage);
  const applicants = useSelector(state => getMarketplaceEntities(state, applicantRefs));
  const collaborations = useSelector(state => getMarketplaceEntities(state, collaborationRefs));
  // setProjectVisibilityThunk is dispatched here but its pending/error state
  // lives on ManageCampaignsPage's slice — reused as-is (see
  // ManageCampaignsPage.duck.js) rather than duplicating the open/close SDK
  // calls under this page's own slice.
  const { togglingListingId } = useSelector(state => state.ManageCampaignsPage);

  const onManageDisableScrolling = useCallback(
    (componentId, disableScrolling) =>
      dispatch(manageDisableScrolling(componentId, disableScrolling)),
    [dispatch]
  );

  useEffect(() => {
    dispatch(showListing(listingId, config)).catch(() => {
      // Ignore, error handling in duck file / showListingError below.
    });
    dispatch(fetchOwnCreatorProfileThunk());
    dispatch(fetchOwnApplicationThunk({ projectId: params.id }));
    dispatch(fetchProjectApplicantsThunk({ projectId: params.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const listing = useSelector(
    state => getMarketplaceEntities(state, [{ id: listingId, type: 'listing' }])[0]
  );

  // Only known once the listing has loaded — don't redirect a brand away
  // before we can tell whether they're the owner (see BrowseProjectsPage.js's
  // hooks-order bug for what happens when a check like this fires on a
  // transient/incomplete render instead).
  const isOwner = !!currentUser && !!listing && listing.author?.id?.uuid === currentUser.id?.uuid;
  const shouldRedirectBrand = isBrandUserType(config, currentUser) && !!listing && !isOwner;

  // The overview cards' "Products to ship" / "Videos to approve" counts need
  // this project's own collaboration transactions — only fetched for the
  // owner, since a creator's apply-form view has no use for them. Placed
  // before any conditional return below (hooks must run unconditionally),
  // even though isOwner isn't known on the very first render.
  useEffect(() => {
    if (isOwner) {
      dispatch(fetchProjectCollaborationsThunk({ projectId: params.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, params.id]);

  if (shouldRedirectBrand) {
    return <NamedRedirect name="ExploreCreatorsPage" />;
  }
  // Unauthorized users can never legitimately be the listing's owner (posting
  // a project already requires authorization, see PostProjectPage.js), so
  // this is safe to check regardless of whether `listing` has loaded yet.
  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const brand = listing?.author;
  const brandName = brand?.attributes?.profile?.displayName;
  const projectTitle = listing?.attributes?.title;
  const description = listing?.attributes?.description;
  const publicData = listing?.attributes?.publicData || {};
  const createdAt = listing?.attributes?.createdAt;
  const listingState = listing?.attributes?.state;
  const isDraft = listingState === 'draft';
  const isPublished = listingState === 'published';
  // A project is matched to exactly one creator (client requirement — see
  // CheckoutPage.duck.js's declineOtherApplicantsMaybe): once
  // publicData.projectStatus flips to 'matched' at checkout, the listing
  // itself also gets closed, so this only guards a creator hitting a stale
  // direct link before that closed state has propagated everywhere.
  const isMatched = publicData.projectStatus === 'matched';
  const {
    nicheLabels,
    platformLabels,
    usageRightsLabel,
    requiresProduct,
    contentDueDate,
  } = getProjectFieldLabels(publicData, config.listing.listingFields);
  const deliverables = Array.isArray(publicData.deliverables) ? publicData.deliverables : [];
  const price = listing?.attributes?.price;
  const priceLabel = price ? formatMoney(intl, price) : null;
  const postedOn = createdAt ? formatDateIntoPartials(createdAt, intl).date : null;
  const isToggling = !!listing && togglingListingId === listing.id.uuid;

  const overview = deriveProjectOverview({ applicants, collaborations, projectListing: listing });

  const { ownProfileListing, fetched: creatorProfileFetched } = creatorProfile;

  const handleApplySubmit = values => {
    const { readyByDate, applicantNote, proposedPrice, offerReason } = values;
    const proposedPriceInSubunits =
      proposedPrice instanceof Money ? proposedPrice.amount : undefined;
    const offerNotes =
      proposedPrice instanceof Money && offerReason
        ? [{ by: 'customer', note: offerReason.trim() }]
        : [];

    const protectedData = {
      projectId: listing.id.uuid,
      creatorListingId: ownProfileListing.id.uuid,
      // F2.5 will thread a real invitation transaction id through here when
      // the creator arrives via an invite instead of browsing in cold.
      invitationTxId: null,
      readyByDate,
      applicantNote: applicantNote ? applicantNote.trim() : '',
      offerNotes,
      collaborationTxId: null,
    };

    dispatch(
      applyToProjectThunk({ listingId: listing.id, protectedData, proposedPriceInSubunits })
    ).catch(() => {
      // Ignore, error handling in duck file / applyError below.
    });
  };

  // Accepting a lamaran is a brand-gated action (BLUEPRINT D5) — unlike
  // decline/counter, it's the moment a brand commits to booking someone, so
  // an unsubscribed brand is bounced to SubscriptionPage instead of the
  // accept actually going through.
  const subscriptionResolved = isSubscriptionStatusResolved(brandSubscription);
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  const handleAccept = ({ transactionId }) => {
    if (brandAccessDenied) {
      history.push(createResourceLocatorString('SubscriptionPage', routeConfiguration, {}, {}));
      return;
    }
    dispatch(acceptApplicationThunk({ transactionId })).catch(() => {
      // Ignore, error handling in duck file / respondError below.
    });
  };
  const handleDecline = ({ transactionId }) => {
    dispatch(declineApplicationThunk({ transactionId })).catch(() => {
      // Ignore, error handling in duck file / respondError below.
    });
  };
  const handleCounter = ({ transactionId, proposedPriceInSubunits }) => {
    dispatch(counterApplicationThunk({ transactionId, proposedPriceInSubunits })).catch(() => {
      // Ignore, error handling in duck file / respondError below.
    });
  };

  // "Duplicate" bridges to PostProjectPage exactly like RosterPage's "Collab
  // again" (F8.1) does — see postProjectPrefill.js. No inviteCreator this
  // time, so PostProjectPage redirects straight to ManageCampaignsPage once
  // the new draft is submitted.
  const handleDuplicate = () => {
    const initialValues = buildProjectPrefillInitialValues(listing);
    storePostProjectPrefill({ initialValues });
    history.push(createResourceLocatorString('PostProjectPage', routeConfiguration, {}, {}));
  };

  const handleOpenCloseModal = () => {
    setCloseModalOpen(true);
  };
  const handleConfirmClose = () => {
    dispatch(setProjectVisibilityThunk({ listingId: listing.id, isPublished: false }))
      .catch(() => {
        // Ignore, error handling in duck file / toggleVisibilityError.
      })
      .then(() => setCloseModalOpen(false));
  };

  const title = projectTitle
    ? intl.formatMessage({ id: 'ProjectDetailPage.schemaTitle' }, { title: projectTitle })
    : '';

  const displayName = currentUser?.attributes?.profile?.displayName;

  let applySection;
  if (!currentUser) {
    applySection = (
      <div className={css.loading}>
        <IconSpinner />
      </div>
    );
  } else if (!ownApplicationFetched || !creatorProfileFetched) {
    applySection = (
      <div className={css.loading}>
        <IconSpinner />
      </div>
    );
  } else if (ownApplication) {
    applySection = <AlreadyAppliedCard tx={ownApplication} />;
  } else if (isMatched) {
    applySection = <ProjectMatchedGuard />;
  } else if (!ownProfileListing) {
    applySection = <NeedsProfileGuard />;
  } else {
    applySection = (
      <ApplyForm
        onSubmit={handleApplySubmit}
        price={price}
        priceNegotiable={publicData.priceNegotiable !== false}
        defaultReadyByDate={contentDueDate}
        marketplaceCurrency={config.currency}
        inProgress={applyInProgress}
        applyError={applyError}
      />
    );
  }

  const briefBlocksProps = {
    projectId: params.id,
    projectTitle,
    postedOn,
    deliverables,
    listingFieldConfigs: config.listing.listingFields,
    nicheLabels,
    platformLabels,
    priceLabel,
    priceNegotiable: publicData.priceNegotiable !== false,
    contentDueDate,
    usageRightsLabel,
    requiresProduct,
    intl,
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage={isOwner ? 'ManageCampaignsPage' : 'BrowseProjectsPage'}
            role={isOwner ? 'brand' : 'creator'}
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
          ) : isOwner ? (
            <div className={css.ownerRoot}>
              <OwnerHeader
                projectId={params.id}
                projectTitle={projectTitle}
                isDraft={isDraft}
                isPublished={isPublished}
                postedOn={postedOn}
                onDuplicate={handleDuplicate}
                onOpenCloseModal={handleOpenCloseModal}
                intl={intl}
              />
              <OverviewCards overview={overview} projectId={params.id} />
              <div className={css.card}>
                <AboutSection description={description} />
                <ProjectBriefBlocks {...briefBlocksProps} />
              </div>
              <ApplicantsSection
                projectId={params.id}
                applicants={applicants}
                applicantsFetched={applicantsFetched}
                applicantsFetchInProgress={applicantsFetchInProgress}
                applicantsFetchError={applicantsFetchError}
                listedPriceInSubunits={price?.amount}
                currency={price?.currency}
                marketplaceCurrency={config.currency}
                respondingToApplicationId={respondingToApplicationId}
                respondError={respondError}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onCounter={handleCounter}
              />
              <CloseProjectModal
                isOpen={closeModalOpen}
                awaitingApprovalCount={overview.awaitingApproval}
                inProgress={isToggling}
                onManageDisableScrolling={onManageDisableScrolling}
                onClose={() => setCloseModalOpen(false)}
                onConfirm={handleConfirmClose}
                intl={intl}
              />
            </div>
          ) : (
            <div className={css.layout}>
              <div className={css.main}>
                <ProjectHeaderCard
                  brand={brand}
                  brandName={brandName}
                  projectTitle={projectTitle}
                />
                <div className={css.card}>
                  <AboutSection description={description} />
                  <ProjectBriefBlocks {...briefBlocksProps} />
                </div>
              </div>

              <aside className={css.sidebar}>
                <div className={css.applyCard}>
                  <Heading as="h2" rootClassName={css.sectionHeading}>
                    <FormattedMessage id="ProjectDetailPage.applyHeading" />
                  </Heading>
                  <p className={css.applySubtitle}>
                    <FormattedMessage id="ProjectDetailPage.applySubtitle" />
                  </p>

                  {applySection}
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
