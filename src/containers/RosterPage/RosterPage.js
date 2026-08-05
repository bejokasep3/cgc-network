import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { useHistory } from 'react-router-dom';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useRouteConfiguration } from '../../context/routeConfigurationContext';
import { createResourceLocatorString } from '../../util/routes';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { toggleSavedCreator } from '../../ducks/brandRoster.duck';
import { logout } from '../../ducks/auth.duck';
import { isUserAuthorized } from '../../util/userHelpers';
import { fetchRosterThunk, fetchRosterCollaborationHistoryThunk } from './RosterPage.duck';
import {
  storePostProjectPrefill,
  buildProjectPrefillInitialValues,
} from '../PostProjectPage/postProjectPrefill';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  CreatorCard,
  IconSpinner,
  InlineTextButton,
  NamedRedirect,
} from '../../components';

import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './RosterPage.module.css';

/**
 * Brand's roster of saved creators (CGC-FRONTEND-PLAN.md §4.2). The list
 * itself lives on the brand's own profile (privateData.savedCreatorIds, see
 * ducks/brandRoster.duck.js); this page resolves those ids to their current
 * creator-profile listing and renders the same CreatorCard used in search,
 * with a remove affordance layered on top rather than baked into the card.
 *
 * F8.1 adds per-creator collaboration history and a "Collab again" button
 * that prefills PostProjectPage from the most recent shared project and
 * auto-invites that creator once the new one is posted — see
 * postProjectPrefill.js for how the two pages hand off that data.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {Array<propTypes.listing>} props.rosterListings
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Object} props.historyByCreatorId - { [creatorUserId]: { count, mostRecentProjectId } }
 * @param {Object} props.projectListingsById - resolved mostRecentProjectId listings, by id
 * @param {Function} props.onFetchRoster
 * @param {Function} props.onFetchRosterCollaborationHistory
 * @param {Function} props.onToggleSavedCreator
 * @returns {JSX.Element}
 */
export const RosterPageComponent = props => {
  const intl = useIntl();
  const history = useHistory();
  const routeConfiguration = useRouteConfiguration();
  const {
    scrollingDisabled,
    currentUser,
    rosterListings,
    fetchInProgress,
    fetchError,
    historyByCreatorId,
    projectListingsById,
    onFetchRoster,
    onFetchRosterCollaborationHistory,
    onToggleSavedCreator,
    onLogout,
  } = props;

  useEffect(() => {
    onFetchRoster();
    onFetchRosterCollaborationHistory();
  }, [onFetchRoster, onFetchRosterCollaborationHistory]);

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage({ id: 'RosterPage.title' });
  const displayName = currentUser?.attributes?.profile?.displayName;
  const hasResults = rosterListings.length > 0;

  const handleCollabAgain = listing => {
    const creatorId = listing.author?.id?.uuid;
    const collabHistory = creatorId ? historyByCreatorId[creatorId] : null;
    const sourceListing = collabHistory?.mostRecentProjectId
      ? projectListingsById[collabHistory.mostRecentProjectId]
      : null;
    if (!sourceListing) {
      return;
    }

    const creatorName = listing.author?.attributes?.profile?.displayName || '';
    storePostProjectPrefill({
      initialValues: buildProjectPrefillInitialValues(sourceListing),
      inviteCreator: {
        creatorListingId: listing.id,
        message: intl.formatMessage({ id: 'RosterPage.collabAgainMessage' }, { creatorName }),
      },
    });
    history.push(createResourceLocatorString('PostProjectPage', routeConfiguration, {}, {}));
  };

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="RosterPage"
            role="brand"
            onLogout={onLogout}
          />
        }
        footer={<FooterContainer />}
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="RosterPage.title" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="RosterPage.subtitle" />
          </p>

          {fetchError ? (
            <p className={css.error}>
              <FormattedMessage id="RosterPage.fetchFailed" />
            </p>
          ) : null}

          {fetchInProgress ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : hasResults ? (
            <ul className={css.grid}>
              {rosterListings.map(listing => {
                const creatorId = listing.author?.id?.uuid;
                const collabHistory = creatorId ? historyByCreatorId[creatorId] : null;
                const canCollabAgain =
                  !!collabHistory?.mostRecentProjectId &&
                  !!projectListingsById[collabHistory.mostRecentProjectId];

                return (
                  <li key={listing.id.uuid} className={css.gridItem}>
                    <CreatorCard listing={listing} />
                    {collabHistory?.count > 0 ? (
                      <p className={css.historyNote}>
                        <FormattedMessage
                          id="RosterPage.collaborationCount"
                          values={{ count: collabHistory.count }}
                        />
                      </p>
                    ) : null}
                    <div className={css.actionRow}>
                      {canCollabAgain ? (
                        <InlineTextButton
                          type="button"
                          className={css.collabAgainButton}
                          onClick={() => handleCollabAgain(listing)}
                        >
                          <FormattedMessage id="RosterPage.collabAgain" />
                        </InlineTextButton>
                      ) : null}
                      <button
                        type="button"
                        className={css.removeButton}
                        onClick={() => onToggleSavedCreator(listing.author?.id?.uuid)}
                      >
                        <FormattedMessage id="RosterPage.remove" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={css.noResults}>
              <FormattedMessage id="RosterPage.noResults" />
            </p>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapStateToProps = state => {
  const { currentUser } = state.user;
  const {
    rosterListingRefs,
    fetchInProgress,
    fetchError,
    historyByCreatorId,
  } = state.RosterPage;

  // Resolve just the "most recent shared project" listings the history map
  // points at — the same { id: { uuid }, type } ref shape LibraryPage.js
  // uses, since getMarketplaceEntities only needs `.uuid`, not a real SDK
  // UUID instance.
  const projectIds = [
    ...new Set(Object.values(historyByCreatorId).map(h => h.mostRecentProjectId).filter(Boolean)),
  ];
  const projectListingRefs = projectIds.map(id => ({ id: { uuid: id }, type: 'listing' }));
  const projectListingsById = getMarketplaceEntities(state, projectListingRefs).reduce(
    (acc, listing) => {
      acc[listing.id.uuid] = listing;
      return acc;
    },
    {}
  );

  return {
    scrollingDisabled: isScrollingDisabled(state),
    currentUser,
    rosterListings: getMarketplaceEntities(state, rosterListingRefs),
    fetchInProgress,
    fetchError,
    historyByCreatorId,
    projectListingsById,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchRoster: () => dispatch(fetchRosterThunk()),
  onFetchRosterCollaborationHistory: () => dispatch(fetchRosterCollaborationHistoryThunk()),
  onToggleSavedCreator: creatorId => dispatch(toggleSavedCreator(creatorId)),
  onLogout: () => dispatch(logout()),
});

const RosterPage = compose(connect(mapStateToProps, mapDispatchToProps))(RosterPageComponent);

export default RosterPage;
