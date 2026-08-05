/**
 * This file contains server side endpoints that can be used to perform backend
 * tasks that can not be handled in the browser.
 *
 * The endpoints should not clash with the application routes. Therefore, the
 * endpoints are prefixed in the main server where this file is used.
 */

const express = require('express');
const bodyParser = require('body-parser');
const { deserialize } = require('./api-util/sdk');

const initiateLoginAs = require('./api/initiate-login-as');
const loginAs = require('./api/login-as');
const transactionLineItems = require('./api/transaction-line-items');
const initiatePrivileged = require('./api/initiate-privileged');
const transitionPrivileged = require('./api/transition-privileged');
const deleteAccount = require('./api/delete-account');
const listCreators = require('./api/list-creators');
const applications = require('./api/applications');
const {
  subscriptionStatus,
  subscriptionPrice,
  createCheckoutSession,
  createBillingPortalSession,
} = require('./api/subscription');
const { adminStatus } = require('./api/admin');
const {
  listApplicants,
  approveApplicant,
  decideApplicant,
} = require('./api/admin/applications');
const {
  listInviteCodes,
  createInviteCode,
  revokeInviteCode,
} = require('./api/admin/invites');
const { listDisputes, resolveDispute } = require('./api/admin/disputes');
const { listHealth } = require('./api/admin/health');
const remindersCron = require('./api/cron/reminders');

const createUserWithIdp = require('./api/auth/createUserWithIdp');

const { authenticateFacebook, authenticateFacebookCallback } = require('./api/auth/facebook');
const { authenticateGoogle, authenticateGoogleCallback } = require('./api/auth/google');

const router = express.Router();

// ================ API router middleware: ================ //

// Parse Transit body first to a string
router.use(
  bodyParser.text({
    type: 'application/transit+json',
  })
);

// Deserialize Transit body string to JS data
router.use((req, res, next) => {
  if (req.get('Content-Type') === 'application/transit+json' && typeof req.body === 'string') {
    try {
      req.body = deserialize(req.body);
    } catch (e) {
      console.error('Failed to parse request body as Transit:');
      console.error(e);
      res.status(400).send('Invalid Transit in request body.');
      return;
    }
  }
  next();
});

// ================ API router endpoints: ================ //

router.get('/initiate-login-as', initiateLoginAs);
router.get('/login-as', loginAs);
router.post('/transaction-line-items', transactionLineItems);
router.post('/initiate-privileged', initiatePrivileged);
router.post('/transition-privileged', transitionPrivileged);
router.post('/delete-account', deleteAccount);
router.get('/list-creators', listCreators);
// Creator applications and brand access requests. See server/api/applications.js.
router.post('/applications', applications);

// Brand subscriptions (Stripe Billing). See server/api/subscription.js.
router.get('/subscription/status', subscriptionStatus);
router.get('/subscription/price', subscriptionPrice);
router.post('/subscription/create-checkout-session', createCheckoutSession);
router.post('/subscription/billing-portal', createBillingPortalSession);

// Operator console gate (F5.1). See server/api/admin/index.js — every future
// admin/*.js endpoint re-checks assertOperator itself, this is not the only
// place that matters.
router.get('/admin/status', adminStatus);

// Application queue (F5.2). See server/api/admin/applications.js.
router.get('/admin/applications', listApplicants);
router.post('/admin/applications/approve', approveApplicant);
router.post('/admin/applications/decide', decideApplicant);

// Invite codes, dispute mediation, network health (F5.3).
router.get('/admin/invites', listInviteCodes);
router.post('/admin/invites', createInviteCode);
router.post('/admin/invites/revoke', revokeInviteCode);
router.get('/admin/disputes', listDisputes);
router.post('/admin/disputes/resolve', resolveDispute);
router.get('/admin/health', listHealth);

// Deadline reminders (F7.1), called by an external scheduler on a shared
// secret header — no user session. See server/api/cron/reminders.js.
router.post('/cron/reminders', remindersCron);

// Create user with identity provider (e.g. Facebook or Google)
// This endpoint is called to create a new user after user has confirmed
// they want to continue with the data fetched from IdP (e.g. name and email)
router.post('/auth/create-user-with-idp', createUserWithIdp);

// Facebook authentication endpoints

// This endpoint is called when user wants to initiate authenticaiton with Facebook
router.get('/auth/facebook', authenticateFacebook);

// This is the route for callback URL the user is redirected after authenticating
// with Facebook. In this route a Passport.js custom callback is used for calling
// loginWithIdp endpoint in Sharetribe Auth API to authenticate user to the marketplace
router.get('/auth/facebook/callback', authenticateFacebookCallback);

// Google authentication endpoints

// This endpoint is called when user wants to initiate authenticaiton with Google
router.get('/auth/google', authenticateGoogle);

// This is the route for callback URL the user is redirected after authenticating
// with Google. In this route a Passport.js custom callback is used for calling
// loginWithIdp endpoint in Sharetribe Auth API to authenticate user to the marketplace
router.get('/auth/google/callback', authenticateGoogleCallback);

module.exports = router;
