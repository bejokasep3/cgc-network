import React from 'react';
import { FormattedMessage } from '../../../util/reactIntl';
import { IconInquiry } from '../../../components';

import css from './TransactionPanel.module.css';

/**
 * Renders the "invite creator to collaborate" context (CGC-FRONTEND-PLAN.md §3.3)
 * when a brand attached one of its own project listings to the inquiry
 * that started this transaction. Without this, the creator only sees a plain
 * message with no indication which project they were invited to.
 *
 * @component
 * @param {Object} props
 * @param {Object} props.protectedData - transaction.attributes.protectedData
 * @param {boolean} props.isCustomer - whether the viewer is the inviting brand
 * @param {string} props.providerName - the invited creator's display name
 * @returns {JSX.Element|null}
 */
const InvitationBannerMaybe = props => {
  const { protectedData, isCustomer, providerName } = props;
  const projectTitle = protectedData?.inviteBriefTitle;

  if (!projectTitle) {
    return null;
  }

  return (
    <div className={css.invitationBanner}>
      <IconInquiry className={css.invitationBannerIcon} />
      <span>
        <FormattedMessage
          id={isCustomer ? 'TransactionPanel.invitationBannerCustomer' : 'TransactionPanel.invitationBannerProvider'}
          values={{ projectTitle, providerName }}
        />
      </span>
    </div>
  );
};

export default InvitationBannerMaybe;
