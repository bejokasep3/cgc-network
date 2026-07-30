import React, { useEffect } from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { toggleSavedCreator } from '../../ducks/brandRoster.duck';
import { fetchRosterThunk } from './RosterPage.duck';

import { Heading, Page, LayoutSingleColumn, CreatorCard, IconSpinner } from '../../components';

import TopbarContainer from '../TopbarContainer/TopbarContainer';
import FooterContainer from '../FooterContainer/FooterContainer';

import css from './RosterPage.module.css';

/**
 * Brand's roster of saved creators (CGC-FRONTEND-PLAN.md §4.2). The list
 * itself lives on the brand's own profile (privateData.savedCreatorIds, see
 * ducks/brandRoster.duck.js); this page resolves those ids to their current
 * creator-profile listing and renders the same CreatorCard used in search,
 * with a remove affordance layered on top rather than baked into the card.
 *
 * @param {Object} props
 * @param {boolean} props.scrollingDisabled
 * @param {Array<propTypes.listing>} props.rosterListings
 * @param {boolean} props.fetchInProgress
 * @param {propTypes.error} props.fetchError
 * @param {Function} props.onFetchRoster
 * @param {Function} props.onToggleSavedCreator
 * @returns {JSX.Element}
 */
export const RosterPageComponent = props => {
  const intl = useIntl();
  const {
    scrollingDisabled,
    rosterListings,
    fetchInProgress,
    fetchError,
    onFetchRoster,
    onToggleSavedCreator,
  } = props;

  useEffect(() => {
    onFetchRoster();
  }, [onFetchRoster]);

  const title = intl.formatMessage({ id: 'RosterPage.title' });
  const hasResults = rosterListings.length > 0;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn topbar={<TopbarContainer />} footer={<FooterContainer />}>
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
              {rosterListings.map(listing => (
                <li key={listing.id.uuid} className={css.gridItem}>
                  <CreatorCard listing={listing} />
                  <button
                    type="button"
                    className={css.removeButton}
                    onClick={() => onToggleSavedCreator(listing.author?.id?.uuid)}
                  >
                    <FormattedMessage id="RosterPage.remove" />
                  </button>
                </li>
              ))}
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
  const { rosterListingRefs, fetchInProgress, fetchError } = state.RosterPage;
  return {
    scrollingDisabled: isScrollingDisabled(state),
    rosterListings: getMarketplaceEntities(state, rosterListingRefs),
    fetchInProgress,
    fetchError,
  };
};

const mapDispatchToProps = dispatch => ({
  onFetchRoster: () => dispatch(fetchRosterThunk()),
  onToggleSavedCreator: creatorId => dispatch(toggleSavedCreator(creatorId)),
});

const RosterPage = compose(connect(mapStateToProps, mapDispatchToProps))(RosterPageComponent);

export default RosterPage;
