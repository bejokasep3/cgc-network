import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import {
  createListingDraftThunk,
  publishListingThunk,
} from '../EditListingPage/EditListingPage.duck';

const PROJECT_LISTING_TYPE = 'project';
// BLUEPRINT.md D1/D2: a project listing's applications go through the
// cgc-application process (price negotiation, max one counter-offer), not
// default-inquiry — see IMPLEMENTATION-PLAN.md 2.1/4. Getting this alias
// wrong would silently route every application into the wrong state machine.
const PROJECT_PROCESS_ALIAS = 'cgc-application/release-1';
const PROJECT_UNIT_TYPE = 'inquiry';

// Creates the project as a real project listing (draft) and immediately
// publishes it — a project has no separate photos/availability step
// (BLUEPRINT.md Lampiran A2), so unlike the general listing wizard this can
// collapse create+publish into one submit instead of a multi-tab flow.
export const submitProjectThunk = createAsyncThunk(
  'PostProjectPage/submitProject',
  (
    { title, description, price, deliverables, contentDueDate, priceNegotiable, publicListingFields, config },
    { dispatch, rejectWithValue }
  ) => {
    const data = {
      title: title.trim(),
      description,
      price,
      publicData: {
        listingType: PROJECT_LISTING_TYPE,
        transactionProcessAlias: PROJECT_PROCESS_ALIAS,
        unitType: PROJECT_UNIT_TYPE,
        // §2.1: deliverables is a structured array, not a Console listing
        // field (Console has no array-of-object schema type). Each entry's
        // `id` was generated client-side (PostProjectForm.js) and stays
        // stable for the life of the project — it's what F2.3's application
        // and F3.1's deliverable tracking key off of.
        deliverables,
        contentDueDate,
        priceNegotiable,
        // Nothing has applied yet; F2.4 flips this to 'matched' once a
        // brand accepts an application and completes checkout (F2.6).
        projectStatus: 'open',
        ...publicListingFields,
      },
    };

    return dispatch(createListingDraftThunk({ data, config }))
      .unwrap()
      .then(response => {
        const listingId = response.data.data.id;
        return dispatch(publishListingThunk({ listingId })).unwrap();
      })
      .then(response => response.data.data.id)
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  submitInProgress: false,
  submitError: null,
  submittedListingId: null,
};

const postProjectPageSlice = createSlice({
  name: 'PostProjectPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(submitProjectThunk.pending, state => {
        state.submitInProgress = true;
        state.submitError = null;
      })
      .addCase(submitProjectThunk.fulfilled, (state, action) => {
        state.submitInProgress = false;
        state.submittedListingId = action.payload;
      })
      .addCase(submitProjectThunk.rejected, (state, action) => {
        state.submitInProgress = false;
        state.submitError = action.payload || storableError(action.error);
      });
  },
});

export default postProjectPageSlice.reducer;
