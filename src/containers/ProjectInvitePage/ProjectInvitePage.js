import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { types as sdkTypes } from '../../util/sdkLoader';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { isInvitationExpired } from '../../util/invitation';
import { checkBrandAccess, isSubscriptionStatusResolved } from '../../util/subscription';
import { isUserAuthorized } from '../../util/userHelpers';
import { showListing } from '../ListingPage/ListingPage.duck';
import {
  fetchCreatorsThunk,
  fetchSentInvitationsThunk,
  sendInvitationThunk,
} from './ProjectInvitePage.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  Avatar,
  NamedLink,
  NamedRedirect,
  IconSpinner,
  InlineTextButton,
  ErrorMessage,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './ProjectInvitePage.module.css';

const { UUID } = sdkTypes;

// How many of a creator's contentNiche/platforms values overlap the
// project's own — higher means a better suggestion. Creators are sorted by
// this, best matches first, rather than split into hard "suggested" vs
// "everyone else" buckets (BLUEPRINT: browsing the rest is one click away
// via "Browse all creators", not hidden).
export const matchScore = (creator, projectNiche, projectPlatforms) => {
  const nicheMatches = (creator.contentNiche || []).filter(n => projectNiche.includes(n)).length;
  const platformMatches = (creator.platforms || []).filter(p => projectPlatforms.includes(p)).length;
  return nicheMatches + platformMatches;
};

const CreatorRow = ({ creator, isMatch, invitationStatus, isInviting, onInvite, intl }) => {
  const name = creator.displayName || '';
  const chips = [...(creator.contentNiche || []), ...(creator.platforms || [])];

  return (
    <li className={css.creatorRow}>
      <Avatar
        user={{ id: creator.id, attributes: { profile: { displayName: name } } }}
        className={css.avatar}
        disableProfileLink
      />
      <div className={css.creatorInfo}>
        <div className={css.creatorNameRow}>
          {creator.listingId ? (
            <NamedLink
              className={css.creatorName}
              name="CreatorProfilePage"
              params={{ id: creator.listingId.uuid }}
            >
              {name}
            </NamedLink>
          ) : (
            <span className={css.creatorName}>{name}</span>
          )}
          {isMatch ? (
            <span className={css.matchBadge}>
              <FormattedMessage id="ProjectInvitePage.matchBadge" />
            </span>
          ) : null}
        </div>
        {chips.length > 0 ? (
          <div className={css.chipRow}>
            {chips.map((label, index) => (
              <span key={`${label}-${index}`} className={css.chip}>
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {!creator.listingId ? null : invitationStatus === 'sent' ? (
        <span className={css.invitedBadge}>
          <FormattedMessage id="ProjectInvitePage.invited" />
        </span>
      ) : (
        <div className={css.inviteAction}>
          {invitationStatus === 'expired' ? (
            <span className={css.expiredBadge}>
              <FormattedMessage id="ProjectInvitePage.invitationExpired" />
            </span>
          ) : null}
          <InlineTextButton
            type="button"
            className={css.inviteButton}
            disabled={isInviting}
            onClick={onInvite}
          >
            {isInviting ? (
              <IconSpinner />
            ) : (
              <FormattedMessage
                id={
                  invitationStatus === 'expired'
                    ? 'ProjectInvitePage.inviteAgainButton'
                    : 'ProjectInvitePage.inviteButton'
                }
              />
            )}
          </InlineTextButton>
        </div>
      )}
    </li>
  );
};

/**
 * A brand picks a creator to invite to a specific project (F2.5) — reached
 * from ProjectDetailPage's owner view. Creators are sorted by how well their
 * niche/platforms match the project, with a link out to ExploreCreatorsPage
 * (also project-aware, via `?project=`) for browsing the full directory
 * instead of just the suggestions here.
 *
 * @param {Object} props
 * @param {Object} props.params - Route params, expects params.id (the project listing id)
 * @returns {JSX.Element}
 */
const ProjectInvitePage = props => {
  const { params } = props;
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const listingId = new UUID(params.id);
  const [message, setMessage] = useState('');

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));
  const { showListingError } = useSelector(state => state.ListingPage);
  const brandSubscription = useSelector(state => state.brandSubscription);
  const {
    creators,
    creatorsFetchInProgress,
    creatorsFetchError,
    sentInvitations,
    sentInvitationsFetched,
    invitingListingId,
    inviteError,
  } = useSelector(state => state.ProjectInvitePage);

  // Latest invitation per creator-profile listing wins, in case of a
  // re-invite after expiry — its createdAt is what decides the badge.
  const sentInvitationByListingId = useMemo(() => {
    return sentInvitations.reduce((acc, entry) => {
      const existing = acc[entry.listingId];
      if (!existing || new Date(entry.createdAt) > new Date(existing.createdAt)) {
        acc[entry.listingId] = entry;
      }
      return acc;
    }, {});
  }, [sentInvitations]);

  useEffect(() => {
    dispatch(showListing(listingId, config)).catch(() => {});
    dispatch(fetchCreatorsThunk());
    dispatch(fetchSentInvitationsThunk({ projectId: params.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const listing = useSelector(
    state => getMarketplaceEntities(state, [{ id: listingId, type: 'listing' }])[0]
  );
  const projectTitle = listing?.attributes?.title;
  const publicData = listing?.attributes?.publicData || {};
  const projectNiche = publicData.contentNiche || [];
  const projectPlatforms = publicData.platforms || [];

  const defaultMessage = projectTitle
    ? intl.formatMessage({ id: 'ProjectInvitePage.defaultMessage' }, { projectTitle })
    : '';

  const sortedCreators = useMemo(() => {
    return creators
      .map(creator => ({
        creator,
        score: matchScore(creator, projectNiche, projectPlatforms),
      }))
      .sort((a, b) => b.score - a.score);
  }, [creators, projectNiche, projectPlatforms]);

  const displayName = currentUser?.attributes?.profile?.displayName;

  // A brand still in Sharetribe's built-in 'pending-approval' state (F0.2)
  // shouldn't be able to send a real invitation — see PostProjectPage.js for
  // the same gate on posting a project in the first place.
  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="RequestAccessPage" />;
  }

  // Inviting a creator is a brand-gated action (BLUEPRINT D5) — an
  // unsubscribed brand is bounced to SubscriptionPage before this page (whose
  // entire purpose is sending invitations) ever renders.
  const subscriptionResolved = isSubscriptionStatusResolved(brandSubscription);
  const brandAccessDenied =
    subscriptionResolved &&
    !checkBrandAccess({ status: brandSubscription?.status, isBrand: true }).allowed;

  if (brandAccessDenied) {
    return <NamedRedirect name="SubscriptionPage" />;
  }

  const handleInvite = creator => {
    dispatch(
      sendInvitationThunk({
        creatorListingId: creator.listingId,
        projectId: params.id,
        message: (message || defaultMessage).trim(),
      })
    ).catch(() => {
      // Ignore, error handling in duck file / inviteError below.
    });
  };

  const title = projectTitle
    ? intl.formatMessage({ id: 'ProjectInvitePage.schemaTitle' }, { projectTitle })
    : '';

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
        <div className={css.root}>
          {showListingError ? (
            <p className={css.error}>
              <FormattedMessage id="ProjectInvitePage.loadFailed" />
            </p>
          ) : !listing ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage
                  id="ProjectInvitePage.heading"
                  values={{ projectTitle }}
                />
              </Heading>
              <p className={css.subtitle}>
                <FormattedMessage id="ProjectInvitePage.subtitle" />
              </p>

              <NamedLink
                className={css.browseAllLink}
                name="ExploreCreatorsPage"
                to={{ search: `project=${params.id}` }}
              >
                <FormattedMessage id="ProjectInvitePage.browseAll" />
              </NamedLink>

              <div className={css.messageField}>
                <label className={css.messageLabel} htmlFor="ProjectInvitePage.message">
                  <FormattedMessage id="ProjectInvitePage.messageLabel" />
                </label>
                <textarea
                  id="ProjectInvitePage.message"
                  className={css.messageTextarea}
                  value={message || defaultMessage}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              <ErrorMessage error={inviteError} />

              {creatorsFetchError ? (
                <p className={css.error}>
                  <FormattedMessage id="ProjectInvitePage.creatorsLoadFailed" />
                </p>
              ) : creatorsFetchInProgress || !sentInvitationsFetched ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : sortedCreators.length === 0 ? (
                <p className={css.empty}>
                  <FormattedMessage id="ProjectInvitePage.noCreators" />
                </p>
              ) : (
                <ul className={css.creatorList}>
                  {sortedCreators.map(({ creator, score }) => {
                    const sentInvitation = creator.listingId
                      ? sentInvitationByListingId[creator.listingId.uuid]
                      : null;
                    const invitationStatus = sentInvitation
                      ? isInvitationExpired(sentInvitation.createdAt)
                        ? 'expired'
                        : 'sent'
                      : null;
                    return (
                      <CreatorRow
                        key={creator.id.uuid}
                        creator={creator}
                        isMatch={score > 0}
                        invitationStatus={invitationStatus}
                        isInviting={
                          !!creator.listingId && invitingListingId === creator.listingId.uuid
                        }
                        onInvite={() => handleInvite(creator)}
                        intl={intl}
                      />
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default ProjectInvitePage;
