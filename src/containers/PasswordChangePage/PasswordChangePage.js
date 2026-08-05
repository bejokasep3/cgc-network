import React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { isScrollingDisabled } from '../../ducks/ui.duck';
import { logout } from '../../ducks/auth.duck';
import { showPaymentDetailsForUser, isBrandUserType, isUserAuthorized } from '../../util/userHelpers';

import { Page, H3, LayoutSideNavigation, NamedRedirect } from '../../components';

import DashboardTopbar from '../ExploreCreatorsPage/DashboardTopbar/DashboardTopbar';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import PasswordChangeForm from './PasswordChangeForm/PasswordChangeForm';

import { changePassword, changePasswordClear, resetPassword } from './PasswordChangePage.duck';
import css from './PasswordChangePage.module.css';

/**
 * The change-password page.
 *
 * @param {Object} props
 * @param {propTypes.error} props.changePasswordError - The change password error
 * @param {boolean} props.changePasswordInProgress - Whether the change password is in progress
 * @param {propTypes.currentUser} props.currentUser - The current user
 * @param {function} props.onChange - The function to change the password
 * @param {function} props.onSubmitChangePassword - The function to submit the change password form
 * @param {boolean} props.passwordChanged - Whether the password has changed
 * @param {boolean} props.scrollingDisabled - Whether the scrolling is disabled
 * @param {boolean} props.resetPasswordInProgress - Whether the reset password is in progress
 * @param {propTypes.error} props.resetPasswordError - The reset password error
 * @returns {JSX.Element} Password change page component
 */
export const PasswordChangePageComponent = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const {
    changePasswordError,
    changePasswordInProgress,
    currentUser,
    onChange,
    onSubmitChangePassword,
    onResetPassword,
    resetPasswordInProgress = false,
    resetPasswordError,
    passwordChanged,
    scrollingDisabled,
    onLogout,
  } = props;

  if (!isUserAuthorized(currentUser)) {
    return <NamedRedirect name="PendingPage" />;
  }

  const changePasswordForm =
    currentUser && currentUser.id ? (
      <PasswordChangeForm
        className={css.form}
        changePasswordError={changePasswordError}
        currentUser={currentUser}
        onSubmit={onSubmitChangePassword}
        onChange={onChange}
        onResetPassword={onResetPassword}
        resetPasswordInProgress={resetPasswordInProgress}
        resetPasswordError={resetPasswordError}
        inProgress={changePasswordInProgress}
        ready={passwordChanged}
      />
    ) : null;

  const title = intl.formatMessage({ id: 'PasswordChangePage.title' });

  const { showPayoutDetails, showPaymentMethods } = showPaymentDetailsForUser(config, currentUser);
  const accountSettingsNavProps = {
    currentPage: 'PasswordChangePage',
    showPaymentMethods,
    showPayoutDetails,
  };
  const displayName = currentUser?.attributes?.profile?.displayName;
  const role = isBrandUserType(config, currentUser) ? 'brand' : 'creator';

  return (
    <Page title={title} scrollingDisabled={scrollingDisabled}>
      <LayoutSideNavigation
        topbar={<DashboardTopbar displayName={displayName} role={role} onLogout={onLogout} />}
        sideNav={null}
        useAccountSettingsNav
        accountSettingsNavProps={accountSettingsNavProps}
        footer={<FooterContainer />}
        intl={intl}
      >
        <div className={css.content}>
          <H3 as="h1">
            <FormattedMessage id="PasswordChangePage.heading" />
          </H3>
          {changePasswordForm}
        </div>
      </LayoutSideNavigation>
    </Page>
  );
};

const mapStateToProps = state => {
  // Topbar needs user info.
  const {
    changePasswordError,
    changePasswordInProgress,
    passwordChanged,
    resetPasswordInProgress,
    resetPasswordError,
  } = state.PasswordChangePage;
  const { currentUser } = state.user;
  return {
    changePasswordError,
    changePasswordInProgress,
    currentUser,
    passwordChanged,
    scrollingDisabled: isScrollingDisabled(state),
    resetPasswordInProgress,
    resetPasswordError,
  };
};

const mapDispatchToProps = dispatch => ({
  onChange: () => dispatch(changePasswordClear()),
  onSubmitChangePassword: values => dispatch(changePassword(values)),
  onResetPassword: values => dispatch(resetPassword(values)),
  onLogout: () => dispatch(logout()),
});

const PasswordChangePage = compose(
  connect(
    mapStateToProps,
    mapDispatchToProps
  )
)(PasswordChangePageComponent);

export default PasswordChangePage;
