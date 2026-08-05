import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { isUserAuthorized } from '../../util/userHelpers';
import { fetchLibraryTransactionsThunk } from './LibraryPage.duck';
import { buildLibraryAssets, getLibraryFilterOptions, filterLibraryAssets } from './libraryAssets';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  IconSpinner,
  ErrorMessage,
  ExternalLink,
  NamedRedirect,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './LibraryPage.module.css';

// Untrusted input pasted by a creator — only ever rendered as a clickable
// link when it's an http(s) URL, same rule DeliverableList.js applies.
const isSafeUrl = value => /^https?:\/\/\S+$/i.test(value || '');

const AssetLinks = ({ value }) => {
  const entries = (value || '')
    .split(/[\n,]/)
    .map(l => l.trim())
    .filter(Boolean);

  return (
    <ul className={css.linkList}>
      {entries.map((entry, index) => (
        <li key={`${entry}-${index}`} className={css.linkItem}>
          <span className={css.linkText} title={entry}>
            {entry}
          </span>
          {isSafeUrl(entry) ? (
            <ExternalLink href={entry} className={css.linkOpen}>
              <FormattedMessage id="LibraryPage.openLink" />
            </ExternalLink>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const AssetCard = ({ asset }) => (
  <li className={css.card}>
    <div className={css.cardHeader}>
      <span className={css.projectTitle}>{asset.projectTitle}</span>
      <span className={css.deliverableType}>{asset.deliverableTypeLabel}</span>
    </div>
    <p className={css.meta}>
      <FormattedMessage
        id="LibraryPage.byCreator"
        values={{ creator: asset.creatorName, platform: asset.platform }}
      />
    </p>
    {asset.usageRightsLabel ? (
      <p className={css.usageRights}>{asset.usageRightsLabel}</p>
    ) : null}
    <AssetLinks value={asset.contentLinks} />
    {asset.submissionNote ? <p className={css.note}>{asset.submissionNote}</p> : null}
  </li>
);

/**
 * The brand's content library (IMPLEMENTATION-PLAN.md F6.2) — final,
 * accepted assets from every completed collaboration, filterable by
 * project/creator/platform. Deliberately NOT subscription-gated
 * (BLUEPRINT D5: "akses pustaka konten & catatan lisensi lama — tidak,
 * selamanya" — a lapsed subscription only blocks starting new
 * collaborations, never access to what's already been delivered).
 *
 * @returns {JSX.Element}
 */
const LibraryPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);
  const { transactionRefs, fetchInProgress, fetchError } = useSelector(state => state.LibraryPage);

  const [projectId, setProjectId] = useState('');
  const [creatorId, setCreatorId] = useState('');
  const [platform, setPlatform] = useState('');

  useEffect(() => {
    dispatch(fetchLibraryTransactionsThunk());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transactions = useSelector(state => getMarketplaceEntities(state, transactionRefs));

  const projectIds = useMemo(
    () => [
      ...new Set(
        transactions.map(tx => tx.attributes?.protectedData?.projectId).filter(Boolean)
      ),
    ],
    [transactions]
  );
  const projectListingsById = useSelector(state => {
    const refs = projectIds.map(id => ({ id: { uuid: id }, type: 'listing' }));
    return getMarketplaceEntities(state, refs).reduce((acc, listing) => {
      acc[listing.id.uuid] = listing;
      return acc;
    }, {});
  });

  const assets = useMemo(
    () => buildLibraryAssets(transactions, projectListingsById, config.listing.listingFields, intl),
    [transactions, projectListingsById, config.listing.listingFields, intl]
  );
  const { projects, creators, platforms } = useMemo(() => getLibraryFilterOptions(assets), [assets]);
  const visibleAssets = filterLibraryAssets(assets, { projectId, creatorId, platform });

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const title = intl.formatMessage({ id: 'LibraryPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={
          <DashboardTopbar
            displayName={displayName}
            currentPage="LibraryPage"
            role="brand"
            onLogout={() => dispatch(logout())}
          />
        }
      >
        <div className={css.root}>
          <Heading as="h1" rootClassName={css.heading}>
            <FormattedMessage id="LibraryPage.heading" />
          </Heading>
          <p className={css.subtitle}>
            <FormattedMessage id="LibraryPage.subtitle" />
          </p>

          {fetchError ? (
            <ErrorMessage error={fetchError} />
          ) : fetchInProgress ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : assets.length === 0 ? (
            <p className={css.empty}>
              <FormattedMessage id="LibraryPage.empty" />
            </p>
          ) : (
            <>
              <div className={css.filterRow}>
                <div className={css.filterGroup}>
                  <label className={css.filterLabel} htmlFor="library-project-filter">
                    <FormattedMessage id="LibraryPage.filterProjectLabel" />
                  </label>
                  <select
                    id="library-project-filter"
                    className={css.filterSelect}
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                  >
                    <option value="">
                      {intl.formatMessage({ id: 'LibraryPage.allProjects' })}
                    </option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={css.filterGroup}>
                  <label className={css.filterLabel} htmlFor="library-creator-filter">
                    <FormattedMessage id="LibraryPage.filterCreatorLabel" />
                  </label>
                  <select
                    id="library-creator-filter"
                    className={css.filterSelect}
                    value={creatorId}
                    onChange={e => setCreatorId(e.target.value)}
                  >
                    <option value="">
                      {intl.formatMessage({ id: 'LibraryPage.allCreators' })}
                    </option>
                    {creators.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={css.filterGroup}>
                  <label className={css.filterLabel} htmlFor="library-platform-filter">
                    <FormattedMessage id="LibraryPage.filterPlatformLabel" />
                  </label>
                  <select
                    id="library-platform-filter"
                    className={css.filterSelect}
                    value={platform}
                    onChange={e => setPlatform(e.target.value)}
                  >
                    <option value="">
                      {intl.formatMessage({ id: 'LibraryPage.allPlatforms' })}
                    </option>
                    {platforms.map(p => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visibleAssets.length === 0 ? (
                <p className={css.empty}>
                  <FormattedMessage id="LibraryPage.noMatch" />
                </p>
              ) : (
                <ul className={css.list}>
                  {visibleAssets.map(asset => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default LibraryPage;
