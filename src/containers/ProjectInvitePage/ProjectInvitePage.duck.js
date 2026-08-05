import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { listCreators } from '../../util/api';
import { CGC_UGC_PROCESS_NAME } from '../../transactions/transaction';
import { transitions as ugcTransitions } from '../../transactions/transactionProcessCGCUGC';

const CREATOR_PROCESS_ALIAS = `${CGC_UGC_PROCESS_NAME}/release-1`;
const SENT_INVITATIONS_PAGE_SIZE = 100;

// The full creator directory, same data ExploreCreatorsPage uses (F2.5 also
// extended list-creators.js to return each creator's contentNiche/platforms,
// which is what lets this page compute "suggested for this project" below).
export const fetchCreatorsThunk = createAsyncThunk(
  'ProjectInvitePage/fetchCreators',
  (_, { rejectWithValue }) => {
    return listCreators()
      .then(({ creators }) => creators)
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// Which creator-profile listings this brand has already invited to THIS
// project, with enough to show a status per row — `only: 'order'` scopes to
// the signed-in brand's own transactions (they are `customer` in
// cgc-ugc-approval), so no explicit customerId filter is needed. Only the
// listing id + createdAt are needed (badge + expiry, via
// src/util/invitation.js), so the listing relationship reference is enough
// — no `include`.
export const fetchSentInvitationsThunk = createAsyncThunk(
  'ProjectInvitePage/fetchSentInvitations',
  ({ projectId }, { rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'order',
        processNames: [CGC_UGC_PROCESS_NAME],
        'fields.transaction': ['protectedData', 'createdAt'],
        perPage: SENT_INVITATIONS_PAGE_SIZE,
      })
      .then(response => {
        return response.data.data
          .filter(tx => tx.attributes.protectedData?.projectId === projectId)
          .map(tx => ({
            listingId: tx.relationships?.listing?.data?.id?.uuid,
            createdAt: tx.attributes.createdAt,
          }))
          .filter(entry => !!entry.listingId);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// Sends the invitation directly (transition/inquire on the creator's own
// listing), rather than going through ListingPage.duck.js's generic
// sendInquiry — that reads the process alias off a full listing entity,
// which this page doesn't fetch one of per creator (list-creators.js only
// returns the listingId). Every creator-profile listing runs the same fixed
// process/alias, so there's nothing to look up.
export const sendInvitationThunk = createAsyncThunk(
  'ProjectInvitePage/sendInvitation',
  ({ creatorListingId, projectId, message }, { rejectWithValue, extra: sdk }) => {
    const bodyParams = {
      transition: ugcTransitions.INQUIRE,
      processAlias: CREATOR_PROCESS_ALIAS,
      params: {
        listingId: creatorListingId,
        protectedData: { projectId, invitationStatus: 'sent' },
      },
    };
    return sdk.transactions
      .initiate(bodyParams)
      .then(response => {
        const transactionId = response.data.data.id;
        return sdk.messages.send({ transactionId, content: message }).then(() => ({
          transactionId,
          creatorListingId: creatorListingId.uuid,
        }));
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  creatorsFetchInProgress: false,
  creatorsFetchError: null,
  creators: [],

  sentInvitationsFetched: false,
  sentInvitationsFetchInProgress: false,
  // { listingId, createdAt }[] — the brand's already-sent invitations for this project.
  sentInvitations: [],

  // The creator-profile listing id currently being invited — disables just
  // that row's button, not the whole list.
  invitingListingId: null,
  inviteError: null,
};

const projectInvitePageSlice = createSlice({
  name: 'ProjectInvitePage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchCreatorsThunk.pending, state => {
        state.creatorsFetchInProgress = true;
        state.creatorsFetchError = null;
      })
      .addCase(fetchCreatorsThunk.fulfilled, (state, action) => {
        state.creatorsFetchInProgress = false;
        state.creators = action.payload;
      })
      .addCase(fetchCreatorsThunk.rejected, (state, action) => {
        state.creatorsFetchInProgress = false;
        state.creatorsFetchError = action.payload || storableError(action.error);
      })
      .addCase(fetchSentInvitationsThunk.pending, state => {
        state.sentInvitationsFetchInProgress = true;
      })
      .addCase(fetchSentInvitationsThunk.fulfilled, (state, action) => {
        state.sentInvitationsFetchInProgress = false;
        state.sentInvitationsFetched = true;
        state.sentInvitations = action.payload;
      })
      .addCase(fetchSentInvitationsThunk.rejected, state => {
        state.sentInvitationsFetchInProgress = false;
        state.sentInvitationsFetched = true;
      })
      .addCase(sendInvitationThunk.pending, (state, action) => {
        state.invitingListingId = action.meta.arg.creatorListingId.uuid;
        state.inviteError = null;
      })
      .addCase(sendInvitationThunk.fulfilled, (state, action) => {
        state.invitingListingId = null;
        state.sentInvitations = [
          ...state.sentInvitations,
          { listingId: action.payload.creatorListingId, createdAt: new Date().toISOString() },
        ];
      })
      .addCase(sendInvitationThunk.rejected, (state, action) => {
        state.invitingListingId = null;
        state.inviteError = action.payload || storableError(action.error);
      });
  },
});

export default projectInvitePageSlice.reducer;
