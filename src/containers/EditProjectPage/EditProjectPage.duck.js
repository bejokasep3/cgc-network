import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { updateListingThunk } from '../EditListingPage/EditListingPage.duck';

// Updates an existing project listing's brief. Mirrors the publicData shape
// PostProjectPage.duck.js writes on create — same fields, submitted through
// the same tab of the general listing update flow (EditListingPage.duck.js)
// rather than a bespoke SDK call.
//
// `projectStatus` is deliberately left out of the written publicData: it's
// only ever set once, on creation, and advanced by F2.4/F2.6 as applications
// are accepted — overwriting it here would silently revert an already
// `matched` project back to `open`.
export const submitEditProjectThunk = createAsyncThunk(
  'EditProjectPage/submitEditProject',
  (
    {
      listingId,
      title,
      description,
      price,
      deliverables,
      contentDueDate,
      priceNegotiable,
      publicListingFields,
      config,
    },
    { dispatch, rejectWithValue }
  ) => {
    const data = {
      id: listingId,
      title: title.trim(),
      description,
      price,
      publicData: {
        deliverables,
        contentDueDate,
        priceNegotiable,
        ...publicListingFields,
      },
    };

    return dispatch(updateListingThunk({ tab: 'details', data, config }))
      .unwrap()
      .then(({ response }) => response.data.data.id)
      .catch(e => rejectWithValue(storableError(e)));
  }
);

const initialState = {
  submitInProgress: false,
  submitError: null,
  submittedListingId: null,
};

const editProjectPageSlice = createSlice({
  name: 'EditProjectPage',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(submitEditProjectThunk.pending, state => {
        state.submitInProgress = true;
        state.submitError = null;
      })
      .addCase(submitEditProjectThunk.fulfilled, (state, action) => {
        state.submitInProgress = false;
        state.submittedListingId = action.payload;
      })
      .addCase(submitEditProjectThunk.rejected, (state, action) => {
        state.submitInProgress = false;
        state.submitError = action.payload || storableError(action.error);
      });
  },
});

export default editProjectPageSlice.reducer;
