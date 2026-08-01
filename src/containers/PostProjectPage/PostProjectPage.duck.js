import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import {
  createListingDraftThunk,
  publishListingThunk,
} from '../EditListingPage/EditListingPage.duck';

const PROJECT_BRIEF_LISTING_TYPE = 'project-brief';
const PROJECT_PROCESS_ALIAS = 'default-inquiry/release-1';
const PROJECT_UNIT_TYPE = 'inquiry';

// Creates the project as a real project-brief listing (draft) and immediately
// publishes it — a project has no separate photos/pricing/availability step
// (CGC-SETUP.md §2b), so unlike the general listing wizard this can collapse
// create+publish into one submit instead of a multi-tab flow.
export const submitProjectThunk = createAsyncThunk(
  'PostProjectPage/submitProject',
  ({ title, description, publicListingFields, config }, { dispatch, rejectWithValue }) => {
    const data = {
      title: title.trim(),
      description,
      publicData: {
        listingType: PROJECT_BRIEF_LISTING_TYPE,
        transactionProcessAlias: PROJECT_PROCESS_ALIAS,
        unitType: PROJECT_UNIT_TYPE,
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
