import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { FormattedMessage } from '../../util/reactIntl';
import {
  isInquiryProcessAlias,
  isNegotiationProcessAlias,
  OFFER,
} from '../../transactions/transaction';

import { Heading, Modal } from '../../components';
import UserCard from './UserCard/UserCard';
import InquiryForm from './InquiryForm/InquiryForm';
import { fetchOwnProjects } from './ListingPage.duck';

import css from './ListingPage.module.css';

const CONTACT_USER_LINK = 'inquiryModalContactUserLink';
const CREATOR_PROFILE_LISTING_TYPE = 'creator-profile';

const SectionAuthorMaybe = props => {
  const {
    title,
    listing,
    authorDisplayName,
    onContactUser,
    isInquiryModalOpen,
    onCloseInquiryModal,
    sendInquiryError,
    sendInquiryInProgress,
    onSubmitInquiry,
    currentUser,
    onManageDisableScrolling,
  } = props;

  const dispatch = useDispatch();
  const { ownProjects, fetchOwnProjectsInProgress } = useSelector(
    state => state.ListingPage
  );

  // The "invite creator to collaborate" flow (CGC-FRONTEND-PLAN.md §3.3) lets a
  // brand attach one of its own open project-brief listings to the inquiry, so
  // fetch that list once the brand actually opens the modal on a creator's
  // listing rather than on every ListingPage visit.
  const isCreatorProfileListing =
    listing?.attributes?.publicData?.listingType === CREATOR_PROFILE_LISTING_TYPE;
  useEffect(() => {
    if (isInquiryModalOpen && isCreatorProfileListing && currentUser?.id) {
      dispatch(fetchOwnProjects());
    }
  }, [isInquiryModalOpen, isCreatorProfileListing, currentUser?.id, dispatch]);

  if (!listing.author) {
    return null;
  }

  const transactionProcessAlias = listing?.attributes?.publicData?.transactionProcessAlias || '';
  const unitType = listing?.attributes?.publicData?.unitType || '';
  const isInquiryProcess = isInquiryProcessAlias(transactionProcessAlias);
  const isNegotiationProcess = isNegotiationProcessAlias(transactionProcessAlias);
  const showContact = !(isInquiryProcess || (isNegotiationProcess && unitType === OFFER));

  const projectOptions = isCreatorProfileListing
    ? ownProjects.map(l => ({ id: l.id.uuid, title: l.attributes.title }))
    : [];

  return (
    <section id="author" className={css.sectionAuthor}>
      <Heading as="h2" rootClassName={css.sectionHeadingWithExtraMargin}>
        <FormattedMessage id="ListingPage.aboutProviderTitle" />
      </Heading>
      <UserCard
        user={listing.author}
        currentUser={currentUser}
        onContactUser={onContactUser}
        showContact={showContact}
        contactLinkId={CONTACT_USER_LINK}
      />
      <Modal
        id="ListingPage.inquiry"
        contentClassName={css.inquiryModalContent}
        isOpen={isInquiryModalOpen}
        onClose={onCloseInquiryModal}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
        focusElementId={CONTACT_USER_LINK}
      >
        <InquiryForm
          className={css.inquiryForm}
          submitButtonWrapperClassName={css.inquirySubmitButtonWrapper}
          listingTitle={title}
          authorDisplayName={authorDisplayName}
          sendInquiryError={sendInquiryError}
          onSubmit={onSubmitInquiry}
          inProgress={sendInquiryInProgress}
          isInviteFlow={isCreatorProfileListing}
          projectOptions={projectOptions}
          projectOptionsInProgress={fetchOwnProjectsInProgress}
        />
      </Modal>
    </section>
  );
};

export default SectionAuthorMaybe;
