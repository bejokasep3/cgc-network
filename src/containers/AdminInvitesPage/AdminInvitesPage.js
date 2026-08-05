import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { getRoleHomeRouteName } from '../../util/userHelpers';
import { storableError } from '../../util/errors';
import {
  fetchAdminStatus,
  fetchInviteCodes,
  createInviteCode,
  revokeInviteCode,
} from '../../util/api';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedRedirect,
  IconSpinner,
  ErrorMessage,
  Button,
  SecondaryButton,
} from '../../components';
import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';

import css from './AdminInvitesPage.module.css';

const CreateInviteCodeForm = ({ onCreate, inProgress, error }) => {
  const intl = useIntl();
  const [note, setNote] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    onCreate({ note, maxUses, expiresAt: expiresAt || null }).then(cleared => {
      if (cleared) {
        setNote('');
        setMaxUses('1');
        setExpiresAt('');
      }
    });
  };

  return (
    <form className={css.createForm} onSubmit={handleSubmit}>
      <div className={css.field}>
        <label className={css.label} htmlFor="AdminInvitesPage_note">
          <FormattedMessage id="AdminInvitesPage.noteLabel" />
        </label>
        <input
          id="AdminInvitesPage_note"
          className={css.input}
          type="text"
          value={note}
          placeholder={intl.formatMessage({ id: 'AdminInvitesPage.notePlaceholder' })}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <div className={css.fieldRow}>
        <div className={css.field}>
          <label className={css.label} htmlFor="AdminInvitesPage_maxUses">
            <FormattedMessage id="AdminInvitesPage.maxUsesLabel" />
          </label>
          <input
            id="AdminInvitesPage_maxUses"
            className={css.input}
            type="number"
            min="1"
            step="1"
            value={maxUses}
            onChange={e => setMaxUses(e.target.value)}
          />
        </div>

        <div className={css.field}>
          <label className={css.label} htmlFor="AdminInvitesPage_expiresAt">
            <FormattedMessage id="AdminInvitesPage.expiresAtLabel" />
          </label>
          <input
            id="AdminInvitesPage_expiresAt"
            className={css.input}
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      {error ? <ErrorMessage error={error} /> : null}

      <Button type="submit" className={css.createButton} inProgress={inProgress} disabled={inProgress}>
        <FormattedMessage id="AdminInvitesPage.generate" />
      </Button>
    </form>
  );
};

const InviteCodeRow = ({ inviteCode, onRevoke, isRevoking, revokeError }) => {
  const intl = useIntl();
  const { code, note, maxUses, usedCount, expiresAt, revoked } = inviteCode;

  return (
    <li className={classNames(css.row, { [css.rowRevoked]: revoked })}>
      <div className={css.rowMain}>
        <span className={css.code}>{code}</span>
        {note ? <span className={css.note}>{note}</span> : null}
      </div>
      <div className={css.rowMeta}>
        <span>
          <FormattedMessage
            id="AdminInvitesPage.uses"
            values={{ used: usedCount, max: maxUses }}
          />
        </span>
        {expiresAt ? (
          <span>
            <FormattedMessage
              id="AdminInvitesPage.expires"
              values={{ date: intl.formatDate(new Date(expiresAt)) }}
            />
          </span>
        ) : null}
      </div>
      {revoked ? (
        <span className={css.revokedBadge}>
          <FormattedMessage id="AdminInvitesPage.revoked" />
        </span>
      ) : (
        <SecondaryButton
          type="button"
          className={css.revokeButton}
          inProgress={isRevoking}
          disabled={isRevoking}
          onClick={onRevoke}
        >
          <FormattedMessage id="AdminInvitesPage.revoke" />
        </SecondaryButton>
      )}
      {revokeError ? <ErrorMessage error={revokeError} /> : null}
    </li>
  );
};

/**
 * Invite code management (IMPLEMENTATION-PLAN.md F5.3, BLUEPRINT C1b) — an
 * operator can create a fast-track code for a specific creator they've
 * already sourced, and revoke one that's no longer needed. Codes are plain
 * listings (server/api-util/adminInvites.js), never registered as a real
 * listing type, so they never surface in search/EditListingWizard.
 *
 * @returns {JSX.Element}
 */
const AdminInvitesPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(isScrollingDisabled);

  const [gateStatus, setGateStatus] = useState('checking');
  const [inviteCodes, setInviteCodes] = useState([]);
  const [fetchInProgress, setFetchInProgress] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [createInProgress, setCreateInProgress] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [revokeErrorId, setRevokeErrorId] = useState(null);
  const [revokeError, setRevokeError] = useState(null);

  const loadInviteCodes = () => {
    setFetchInProgress(true);
    fetchInviteCodes()
      .then(({ inviteCodes: fetched }) => {
        setInviteCodes(fetched);
        setFetchInProgress(false);
      })
      .catch(e => {
        setFetchError(storableError(e));
        setFetchInProgress(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    fetchAdminStatus()
      .then(() => {
        if (cancelled) return;
        setGateStatus('allowed');
        loadInviteCodes();
      })
      .catch(() => {
        if (!cancelled) setGateStatus('denied');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gateStatus === 'denied') {
    return <NamedRedirect name={getRoleHomeRouteName(config, currentUser)} />;
  }

  const handleCreate = ({ note, maxUses, expiresAt }) => {
    setCreateInProgress(true);
    setCreateError(null);
    return createInviteCode({ note, maxUses, expiresAt })
      .then(() => {
        setCreateInProgress(false);
        loadInviteCodes();
        return true;
      })
      .catch(e => {
        setCreateError(storableError(e));
        setCreateInProgress(false);
        return false;
      });
  };

  const handleRevoke = listingId => {
    setRevokingId(listingId);
    setRevokeErrorId(null);
    setRevokeError(null);
    revokeInviteCode(listingId)
      .then(() => {
        setRevokingId(null);
        loadInviteCodes();
      })
      .catch(e => {
        setRevokeErrorId(listingId);
        setRevokeError(storableError(e));
        setRevokingId(null);
      });
  };

  const title = intl.formatMessage({ id: 'AdminInvitesPage.schemaTitle' });
  const displayName = currentUser?.attributes?.profile?.displayName;

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<DashboardTopbar displayName={displayName} onLogout={() => dispatch(logout())} />}
      >
        <div className={css.root}>
          {gateStatus === 'checking' ? (
            <div className={css.loading}>
              <IconSpinner />
            </div>
          ) : (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="AdminInvitesPage.heading" />
              </Heading>

              <CreateInviteCodeForm
                onCreate={handleCreate}
                inProgress={createInProgress}
                error={createError}
              />

              {fetchError ? (
                <ErrorMessage error={fetchError} />
              ) : fetchInProgress ? (
                <div className={css.loading}>
                  <IconSpinner />
                </div>
              ) : inviteCodes.length === 0 ? (
                <p className={css.empty}>
                  <FormattedMessage id="AdminInvitesPage.empty" />
                </p>
              ) : (
                <ul className={css.list}>
                  {inviteCodes.map(inviteCode => (
                    <InviteCodeRow
                      key={inviteCode.id}
                      inviteCode={inviteCode}
                      isRevoking={revokingId === inviteCode.id}
                      revokeError={revokeErrorId === inviteCode.id ? revokeError : null}
                      onRevoke={() => handleRevoke(inviteCode.id)}
                    />
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

export default AdminInvitesPage;
