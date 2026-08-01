# The CGC Network — setup guide

Everything in this repo is code. The steps below are the parts that **cannot** live
in code, because Sharetribe's hosted configuration (set in Console) always
overrides the local files in `src/config/`. Work through them in order — the app
will not function correctly until all of them are done.

---

## 1. Push the transaction process

The custom process lives in [`ext/transaction-processes/cgc-ugc-approval/`](ext/transaction-processes/cgc-ugc-approval/).
It must be pushed to each environment (test and live) with the Sharetribe CLI.

```bash
flex-cli login
```

```bash
flex-cli process push --process cgc-ugc-approval --path ext/transaction-processes/cgc-ugc-approval --marketplace YOUR_MARKETPLACE_ID
```

Then create the alias the app expects. The app is hard-wired to
`cgc-ugc-approval/release-1` in [`src/transactions/transaction.js`](src/transactions/transaction.js) —
if you use a different alias name, the app will throw when loading a transaction.

```bash
flex-cli process create-alias --process cgc-ugc-approval --version 1 --alias release-1 --marketplace YOUR_MARKETPLACE_ID
```

Verify:

```bash
flex-cli process list --marketplace YOUR_MARKETPLACE_ID
```

> When you later change `process.edn`, push a **new version** and point the alias at
> it (`flex-cli process update-alias`). Never edit a version that has live
> transactions on it.

> **Self-transitions:** `process.edn` includes
> `transition/provider-add-shipping-address`, a self-transition (`:from` and `:to`
> both `:state/purchased`; see CGC-FRONTEND-PLAN.md §1.3). **Confirmed** — pushed
> to `warungurang-test` as version 2 and pulled back down for comparison; it
> round-tripped byte-for-byte (modulo comments/whitespace, which the server
> strips), so the v3 format accepts self-transitions in production, not just in
> local parsing. No fallback needed.
>
> One gotcha hit during this push: `warungurang-test` already had a stale
> version 1 (an early draft, unrelated to the current design — no self-transition,
> far fewer transitions) from a prior attempt. `process push` always creates a new
> version rather than overwriting, so pushing landed as version 2, but
> `create-alias` was initially pointed at version 1 by mistake. Always double check
> which version an alias points at with `flex-cli process list`, and use
> `flex-cli process pull --process <name> --version <n> --path <dir>` to inspect a
> specific version's contents if there's any doubt.

---

## 2. Listing types

The money in Sharetribe always flows `customer → provider`, and the **provider is
the listing author**. Creators get paid, so creators must own the purchasable
listings. That's why there are two listing types rather than one.

Create both under **Console → Build → Listings → Listing types**.

### 2a. `creator-profile` — the purchasable one

| Setting | Value |
|---|---|
| Listing type ID | `creator-profile` |
| Label | Creator profile |
| Transaction process | `cgc-ugc-approval` |
| Process alias | `cgc-ugc-approval/release-1` |
| Unit type | `item` |
| Stock type | Multiple items (a creator can take several bookings) |
| Payout details required | Yes |
| Location | Optional |
| Pickup / shipping delivery methods | **Disabled — see warning below** |
| File attachments in messages | Enabled |

> **Do not enable Sharetribe's pickup or shipping delivery methods on this listing
> type.** Sharetribe's delivery model is provider → customer. CGC is the inverse:
> the brand ships to the creator. Enabling it would make the *creator* set a
> shipping fee that gets charged to the brand and paid out to the creator, and it
> would collect the brand's own address as the shipping destination. Product
> shipping in CGC is signalled by the `requiresProduct` listing field instead — see
> CGC-FRONTEND-PLAN.md §1.3, which also covers collecting the creator's address.

Authored by creators. Brands browse these and check out against them, which is
what makes the creator the payee.

### 2b. `project-brief` — the free one

| Setting | Value |
|---|---|
| Listing type ID | `project-brief` |
| Label | Project brief |
| Transaction process | `default-inquiry` |
| Process alias | `default-inquiry/release-1` |
| Price | Disabled |
| Payout details required | No |
| Photos required | No — a brief is text (title + description + the fields below), not a product listing, so don't require an image upload for it |

Authored by brands. This is how "brands post projects" works without reversing
the payment direction: creators apply via inquiry, then the brand books the
creator on that creator's own `creator-profile` listing.

### 2c. Listing fields

Add under **Console → Build → Listings → Listing fields**. Scope all of these to
`public` so they can be used as search filters.

For `creator-profile` (limit to that listing type):

| Key | Schema | Notes |
|---|---|---|
| `contentNiche` | multi-enum | Beauty, Fashion, Food, Fitness, Tech, Home, Travel, Parenting, Gaming, Finance |
| `platforms` | multi-enum | TikTok, Instagram Reels, YouTube Shorts, Facebook, Pinterest, Amazon |
| `deliverableCount` | long | How many assets the package includes |
| `turnaroundDays` | long | Working days from brief to first delivery |
| `usageRights` | enum | Organic only, Paid ads (6 months), Paid ads (12 months), Full buyout |
| `requiresProduct` | boolean | Whether the brand must ship a product to the creator. Read by `TransactionPage.stateDataCGCUGC.js` (see CGC-FRONTEND-PLAN.md §1.3) to decide whether the shipping-address and shipping-confirmation steps appear at all. |

For `project-brief` (limit to that listing type):

| Key | Schema | Notes |
|---|---|---|
| `contentNiche` | multi-enum | Reuse the same options so filters line up |
| `platforms` | multi-enum | Reuse the same options |
| `budgetRange` | enum | Under $250, $250–500, $500–1000, $1000+ |
| `deadline` | text | Target delivery date |

Enable `indexForSearch` on `contentNiche`, `platforms`, and `usageRights` so
brands can filter the creator directory. That requires a search schema:

```bash
flex-cli search set --key contentNiche --type multi-enum --scope public --marketplace YOUR_MARKETPLACE_ID
```

Repeat for `platforms` and `usageRights`.

---

## 3. Invite-only access (creator vetting)

No code needed — the template already gates every relevant surface on
`isUserAuthorized` ([`src/util/userHelpers.js`](src/util/userHelpers.js)), which
checks for user state `active`.

In **Console → Build → Users → Access control**, enable:

- **User approval required** — new signups land in `pending-approval`. They can
  browse but cannot publish a profile or start a transaction. Approve each creator
  manually under Console → Manage → Users.
- **Listing approval required** — creator profiles go to `pendingApproval` before
  becoming public, so you review the actual profile, not just the account.

Pending users see [`NoAccessPage`](src/containers/NoAccessPage/NoAccessPage.js);
its copy has been rewritten for the invite-only flow (see
`NoAccessPage.userPendingApproval.*` in `src/translations/en.json`).

---

## 4. Brand subscriptions

Brands pay a recurring fee for access. Sharetribe has no concept of a platform
subscription, so this is a thin layer over Stripe Billing:
[`server/api/subscription.js`](server/api/subscription.js).

1. In the **Stripe dashboard** (the same account connected to Sharetribe is fine),
   create a Product called "Brand membership" with a **recurring** price. Copy the
   price id (`price_...`).
2. Copy your Stripe **secret** key (`sk_...`).
3. Set both as environment variables — locally in `.env`, and in your host's
   config for staging/production:

```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_BRAND_SUBSCRIPTION_PRICE_ID=price_xxx
```

If either variable is missing the endpoints return HTTP 501 and the feature stays
dormant, so the app still runs without them.

**How it works.** Card details are collected on Stripe-hosted Checkout and cards
are managed in Stripe's billing portal — this app never sees or stores payment
details. Stripe remains the source of truth for whether a subscription is active;
we only cache the Stripe customer id on the user's profile. That deliberately
avoids mirroring an `isSubscribed` flag, which is the usual thing that drifts out
of sync and lets cancelled brands keep access.

Gating rules live in [`src/util/subscription.js`](src/util/subscription.js). The
three call sites are wired: `EditListingPage` (posting a `project-brief`
listing), the `ListingPage` contact/inquiry entry point, and
`CheckoutPageAccessWrapper`. All three redirect an unsubscribed brand to
`/subscription` once `fetchBrandSubscription()` (dispatched on app load for
authorized users, see `src/ducks/user.duck.js`) has resolved — never before,
so a paying brand never sees a false paywall flash.

---

## 5. Marketplace identity

Done: the marketplace has been renamed to **The CGC Network** in
**Console → Build → General**, and the runtime workaround that used to
string-replace `"Warung Urang"` with `"CGC Network"` across hosted assets has
been deleted from `src/ducks/hostedAssets.duck.js` (see commit `da5d0628e`).

That removal surfaced the actual problem the workaround was masking: the
landing-page CMS content in Console still contains literal `"Warung Urang"`
text, left over from the reused Console marketplace this project started
from. That text has to be fixed by hand in Console — there is no code fix,
since it lives in hosted content, not in the repo. Follow
[CGC-CONSOLE-LANDING.md](CGC-CONSOLE-LANDING.md), which has ready-to-paste
copy for every landing page section. Until that's done, the old name will
keep showing up anywhere the CMS content wasn't already covered by that guide.

---

## 6. Also required before launch

- **Stripe publishable key** — `REACT_APP_STRIPE_PUBLISHABLE_KEY` in `.env` is
  currently empty. Marketplace checkout cannot work without it.
- **Email texts** — every notification template uses the `t` helper, so all copy
  is editable from Console via `content/email-texts.json` without touching code.

---

## Verifying the transaction process end to end

Use two test accounts (one brand, one creator) and walk the happy path:

1. Creator publishes a `creator-profile` listing → approve it in Console.
2. Brand checks out → transaction enters `purchased`.
3. Brand clicks **I've shipped the product**, enters carrier + tracking →
   `shipped`. Creator gets an email with the tracking details.
4. Creator clicks **I've received the product** → `product-received`.
5. Creator clicks **Submit content for review**, pastes links → `content-submitted`.
6. Brand clicks **Request a revision** with notes → `revision-requested-1`.
7. Creator resubmits → `content-submitted-revised-1`.
8. Brand clicks **Approve & release payment** → `received`, payout created,
   auto-completes to `completed`.
9. Both parties leave reviews → `reviewed`.

Then check the escape hatches, which is where the original implementation was
broken: cancel from an operator account at each stage, and confirm a transaction
left alone in `completed` still reaches `reviewed` after the review window.
