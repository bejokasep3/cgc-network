import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { initiatePrivileged, transitionPrivileged } from '../../util/api';
import { denormalisedResponseEntities } from '../../util/data';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import {
  CGC_APPLICATION_PROCESS_NAME,
  getSupportedProcessesInfo,
} from '../../transactions/transaction';
import { transitions as applicationTransitions } from '../../transactions/transactionProcessCGCApplication';

const entityRefs = entities => entities.map(entity => ({ id: entity.id, type: entity.type }));

const PROJECT_APPLICATION_PROCESS_ALIAS = `${CGC_APPLICATION_PROCESS_NAME}/release-1`;

// Has this creator already applied to this project? Checked before the apply
// form is shown so a repeat visit shows the existing application's status
// instead of a form that would just be rejected server-side (F2.3 — see
// initiate-privileged.js's duplicate-application guard for the enforced half
// of this rule; this thunk is the UX half). `only: 'order'` already scopes
// the query to the signed-in creator's own transactions, so no explicit
// customerId filter is needed.
export const fetchOwnApplicationThunk = createAsyncThunk(
  'ProjectDetailPage/fetchOwnApplication',
  ({ projectId }, { rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'order',
        processNames: [CGC_APPLICATION_PROCESS_NAME],
        'fields.transaction': ['protectedData', 'lastTransition', 'lastTransitionedAt'],
      })
      .then(response => {
        const match = response.data.data.find(
          tx => tx.attributes.protectedData?.projectId === projectId
        );
        return match || null;
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// Applies to a project via cgc-application's transition/apply. Always a
// brand-new transaction (never an update to an existing one), so this goes
// through initiate-privileged.js rather than transition-privileged.js — see
// IMPLEMENTATION-PLAN.md 2.3/2.3b. `proposedPriceInSubunits` is omitted
// entirely when applying at the listed price; the server falls back to the
// listing's own price in that case (cgcCheckout.js).
export const applyToProjectThunk = createAsyncThunk(
  'ProjectDetailPage/applyToProject',
  ({ listingId, protectedData, proposedPriceInSubunits }, { rejectWithValue }) => {
    const bodyParams = {
      processAlias: PROJECT_APPLICATION_PROCESS_ALIAS,
      transition: applicationTransitions.APPLY,
      params: { listingId, protectedData },
    };
    const orderData =
      typeof proposedPriceInSubunits === 'number' ? { proposedPriceInSubunits } : {};

    return initiatePrivileged({ isSpeculative: false, orderData, bodyParams, queryParams: {} })
      .then(response => denormalisedResponseEntities(response)[0])
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// F2.4: the brand's own view of who has applied to a project they posted.
// `only: 'sale'` scopes this to the signed-in brand's own transactions (they
// are `provider` in cgc-application — BLUEPRINT D1/D2), same as
// ManageCampaignsPage.duck.js's fetchProjectApplicationsThunk, but filtered
// down to one project and fetched with enough detail (metadata, protectedData)
// to render full comparison cards rather than just a count.
export const fetchProjectApplicantsThunk = createAsyncThunk(
  'ProjectDetailPage/fetchProjectApplicants',
  ({ projectId }, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .query({
        only: 'sale',
        processNames: [CGC_APPLICATION_PROCESS_NAME],
        include: ['customer', 'customer.profileImage'],
        'fields.transaction': [
          'protectedData',
          'metadata',
          'lastTransition',
          'lastTransitionedAt',
          'transitions',
          'createdAt',
        ],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: 100,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        const matching = response.data.data.filter(
          tx => tx.attributes.protectedData?.projectId === projectId
        );
        return entityRefs(matching);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// F2.4 overview cards: the brand's own collaboration transactions
// (`only: 'order'`), filtered down to this one project — same query and
// filter pattern as ManageCampaignsPage.duck.js's fetchCampaignsThunk /
// fetchProjectApplicantsThunk above, just scoped to a single project instead
// of listing every project's applicants or every campaign across projects.
export const fetchProjectCollaborationsThunk = createAsyncThunk(
  'ProjectDetailPage/fetchProjectCollaborations',
  ({ projectId }, { dispatch, rejectWithValue, extra: sdk }) => {
    const processNames = getSupportedProcessesInfo().map(p => p.name);

    return sdk.transactions
      .query({
        only: 'order',
        processNames,
        include: ['listing', 'provider', 'provider.profileImage', 'reviews', 'reviews.author'],
        'fields.transaction': [
          'processName',
          'lastTransition',
          'lastTransitionedAt',
          'transitions',
          'protectedData',
        ],
        'fields.listing': ['title', 'publicData'],
        'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'banned'],
        'fields.image': ['variants.square-small', 'variants.square-small2x'],
        perPage: 100,
      })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
        const matching = response.data.data.filter(
          tx => tx.attributes.protectedData?.projectId === projectId
        );
        return entityRefs(matching);
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// transition/brand-accept and transition/brand-decline are plain (not
// privileged — no metadata write, see process.edn), so these go straight
// through the Marketplace SDK, unlike apply/counter below.
export const acceptApplicationThunk = createAsyncThunk(
  'ProjectDetailPage/acceptApplication',
  ({ transactionId }, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .transition(
        { id: transactionId, transition: applicationTransitions.BRAND_ACCEPT, params: {} },
        { expand: true }
      )
      .then(response => {
        dispatch(addMarketplaceEntities(response));
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

export const declineApplicationThunk = createAsyncThunk(
  'ProjectDetailPage/declineApplication',
  ({ transactionId }, { dispatch, rejectWithValue, extra: sdk }) => {
    return sdk.transactions
      .transition(
        { id: transactionId, transition: applicationTransitions.BRAND_DECLINE, params: {} },
        { expand: true }
      )
      .then(response => {
        dispatch(addMarketplaceEntities(response));
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

// transition/brand-counter IS privileged (writes the counter amount to
// metadata — see cgcCheckout.js), so it goes through transition-privileged.js
// rather than a direct SDK call. Only ever called once per application —
// canCounter() in src/util/application.js is what the UI checks beforehand.
export const counterApplicationThunk = createAsyncThunk(
  'ProjectDetailPage/counterApplication',
  ({ transactionId, proposedPriceInSubunits }, { dispatch, rejectWithValue }) => {
    const bodyParams = {
      id: transactionId,
      transition: applicationTransitions.BRAND_COUNTER,
      params: {},
    };
    const orderData = { proposedPriceInSubunits };

    return transitionPrivileged({
      isSpeculative: false,
      orderData,
      bodyParams,
      queryParams: { expand: true },
    })
      .then(response => {
        dispatch(addMarketplaceEntities(response));
      })
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  ownApplicationFetched: false,
  ownApplicationFetchInProgress: false,
  ownApplication: null,

  applyInProgress: false,
  applyError: null,

  applicantsFetched: false,
  applicantsFetchInProgress: false,
  applicantsFetchError: null,
  applicantRefs: [],

  collaborationsFetched: false,
  collaborationsFetchInProgress: false,
  collaborationsFetchError: null,
  collaborationRefs: [],

  // The transaction id currently being responded to (accept/decline/counter)
  // — used to disable just that applicant's buttons, not the whole list.
  respondingToApplicationId: null,
  respondError: null,
};

const projectDetailPageSlice = createSlice({
  name: 'ProjectDetailPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchOwnApplicationThunk.pending, state => {
        state.ownApplicationFetchInProgress = true;
      })
      .addCase(fetchOwnApplicationThunk.fulfilled, (state, action) => {
        state.ownApplicationFetchInProgress = false;
        state.ownApplicationFetched = true;
        state.ownApplication = action.payload;
      })
      .addCase(fetchOwnApplicationThunk.rejected, state => {
        state.ownApplicationFetchInProgress = false;
        state.ownApplicationFetched = true;
      })
      .addCase(applyToProjectThunk.pending, state => {
        state.applyInProgress = true;
        state.applyError = null;
      })
      .addCase(applyToProjectThunk.fulfilled, (state, action) => {
        state.applyInProgress = false;
        // The freshly created application transaction becomes the "already
        // applied" state immediately, without a second round-trip.
        state.ownApplication = action.payload;
      })
      .addCase(applyToProjectThunk.rejected, (state, action) => {
        state.applyInProgress = false;
        state.applyError = action.payload || storableError(action.error);
      })
      .addCase(fetchProjectApplicantsThunk.pending, state => {
        state.applicantsFetchInProgress = true;
        state.applicantsFetchError = null;
      })
      .addCase(fetchProjectApplicantsThunk.fulfilled, (state, action) => {
        state.applicantsFetchInProgress = false;
        state.applicantsFetched = true;
        state.applicantRefs = action.payload;
      })
      .addCase(fetchProjectApplicantsThunk.rejected, (state, action) => {
        state.applicantsFetchInProgress = false;
        state.applicantsFetched = true;
        state.applicantsFetchError = action.payload || storableError(action.error);
      })
      .addCase(fetchProjectCollaborationsThunk.pending, state => {
        state.collaborationsFetchInProgress = true;
        state.collaborationsFetchError = null;
      })
      .addCase(fetchProjectCollaborationsThunk.fulfilled, (state, action) => {
        state.collaborationsFetchInProgress = false;
        state.collaborationsFetched = true;
        state.collaborationRefs = action.payload;
      })
      .addCase(fetchProjectCollaborationsThunk.rejected, (state, action) => {
        state.collaborationsFetchInProgress = false;
        state.collaborationsFetched = true;
        state.collaborationsFetchError = action.payload || storableError(action.error);
      })
      .addCase(acceptApplicationThunk.pending, (state, action) => {
        state.respondingToApplicationId = action.meta.arg.transactionId.uuid;
        state.respondError = null;
      })
      .addCase(acceptApplicationThunk.fulfilled, state => {
        state.respondingToApplicationId = null;
      })
      .addCase(acceptApplicationThunk.rejected, (state, action) => {
        state.respondingToApplicationId = null;
        state.respondError = action.payload || storableError(action.error);
      })
      .addCase(declineApplicationThunk.pending, (state, action) => {
        state.respondingToApplicationId = action.meta.arg.transactionId.uuid;
        state.respondError = null;
      })
      .addCase(declineApplicationThunk.fulfilled, state => {
        state.respondingToApplicationId = null;
      })
      .addCase(declineApplicationThunk.rejected, (state, action) => {
        state.respondingToApplicationId = null;
        state.respondError = action.payload || storableError(action.error);
      })
      .addCase(counterApplicationThunk.pending, (state, action) => {
        state.respondingToApplicationId = action.meta.arg.transactionId.uuid;
        state.respondError = null;
      })
      .addCase(counterApplicationThunk.fulfilled, state => {
        state.respondingToApplicationId = null;
      })
      .addCase(counterApplicationThunk.rejected, (state, action) => {
        state.respondingToApplicationId = null;
        state.respondError = action.payload || storableError(action.error);
      });
  },
});

export default projectDetailPageSlice.reducer;
