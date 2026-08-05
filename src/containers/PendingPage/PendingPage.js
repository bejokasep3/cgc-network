import React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { useConfiguration } from '../../context/configurationContext';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import {
  getPostApprovalRouteName,
  isBrandUserType,
  isUserAuthorized,
} from '../../util/userHelpers';

import {
  Heading,
  Page,
  LayoutSingleColumn,
  NamedLink,
  NamedRedirect,
  TopbarSimplified,
} from '../../components';

import css from './PendingPage.module.css';

/**
 * B3 in BLUEPRINT's brand flow (and the creator equivalent): shown after
 * submitting an application/access-request, while the account sits in
 * Sharetribe's built-in `pending-approval` state. Names a concrete wait
 * ("usually 2 business days") — an unbounded wait reads as a rejection
 * (BLUEPRINT's own reasoning for this page).
 *
 * @returns {JSX.Element}
 */
const PendingPage = () => {
  const intl = useIntl();
  const config = useConfiguration();
  const dispatch = useDispatch();

  const currentUser = useSelector(state => state.user?.currentUser);
  const scrollingDisabled = useSelector(state => isScrollingDisabled(state));

  // Already approved (e.g. this tab was left open while the operator acted) —
  // no reason to keep showing a waiting screen.
  if (isUserAuthorized(currentUser)) {
    return <NamedRedirect name={getPostApprovalRouteName(config, currentUser)} />;
  }

  const isBrand = isBrandUserType(config, currentUser);
  const privateData = currentUser?.attributes?.profile?.privateData || {};
  const hasSubmitted = isBrand ? !!privateData.accessRequest : !!privateData.application;
  // Set by an operator from the application queue (F5.2) — there's no
  // reject/ban endpoint in Sharetribe's API, so a decision here doesn't
  // change the account's real state, only what this page shows.
  const decision = privateData.applicationDecision || null;

  const title = intl.formatMessage({ id: 'PendingPage.schemaTitle' });

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn
        topbar={<TopbarSimplified onLogout={() => dispatch(logout())} />}
      >
        <div className={css.root}>
          {hasSubmitted && decision?.status === 'rejected' ? (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="PendingPage.rejectedHeading" />
              </Heading>
              <p className={css.body}>
                <FormattedMessage id="PendingPage.rejectedBody" />
              </p>
              {decision.note ? <p className={css.estimate}>{decision.note}</p> : null}
            </>
          ) : hasSubmitted && decision?.status === 'moreInfoRequested' ? (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="PendingPage.moreInfoHeading" />
              </Heading>
              <p className={css.body}>
                <FormattedMessage id="PendingPage.moreInfoBody" />
              </p>
              {decision.note ? <p className={css.estimate}>{decision.note}</p> : null}
            </>
          ) : hasSubmitted ? (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="PendingPage.heading" />
              </Heading>
              <p className={css.body}>
                <FormattedMessage id="PendingPage.body" />
              </p>
              <p className={css.estimate}>
                <FormattedMessage id="PendingPage.estimate" />
              </p>
            </>
          ) : (
            <>
              <Heading as="h1" rootClassName={css.heading}>
                <FormattedMessage id="PendingPage.notSubmittedHeading" />
              </Heading>
              <p className={css.body}>
                <FormattedMessage
                  id={
                    isBrand ? 'PendingPage.notSubmittedBodyBrand' : 'PendingPage.notSubmittedBodyCreator'
                  }
                />
              </p>
              <NamedLink
                className={css.cta}
                name={isBrand ? 'RequestAccessPage' : 'ApplyPage'}
              >
                <FormattedMessage
                  id={isBrand ? 'PendingPage.requestAccessCta' : 'PendingPage.applyCta'}
                />
              </NamedLink>
            </>
          )}
        </div>
      </LayoutSingleColumn>
    </Page>
  );
};

export default PendingPage;
