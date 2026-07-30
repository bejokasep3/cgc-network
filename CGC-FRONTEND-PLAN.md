# The CGC Network — frontend implementation plan

**Audience:** the engineer (or agent) implementing this. Read the whole document
before starting; the phases are ordered by dependency, not by preference.

**Goal:** make the frontend match what the client actually asked for — a
*premium, invite-only* network where "the workflow clearly tracks each stage of
the project." Right now the app looks and behaves like an unmodified Sharetribe
template, which reads as generic and cheap, and undersells an invite-only
proposition.

The backend work is done (see [CGC-SETUP.md](CGC-SETUP.md)). This is purely the
UI layer.

---

## Non-negotiable ground rules

Violating any of these will break other parts of the marketplace or make the work
unshippable. They are not stylistic preferences.

1. **Never hardcode colors, fonts, or spacing values in components.** Use the CSS
   custom properties in [`src/styles/marketplaceDefaults.css`](src/styles/marketplaceDefaults.css).
   Branding colors are overridden at runtime by Console hosted assets, so a
   hardcoded hex will silently diverge from the client's real brand.
   *There is already one violation to fix — see Phase 0.3.*
2. **Never hardcode user-facing copy.** Every string goes through `react-intl`
   into [`src/translations/en.json`](src/translations/en.json), alphabetically
   sorted. Hosted translations from Console override this file, which is how the
   client edits copy without a developer.
3. **Landing page content is CMS-driven.** It is assembled in Console from
   PageBuilder sections. Restyle the section *components* in
   `src/containers/PageBuilder/SectionBuilder/`; never hardcode landing copy into
   React. Same for all `CMSPage` routes.
4. **Several components are shared across transaction processes.** `TransactionPanel`,
   `ListingCard`, `OrderPanel`, `InboxPage`, and `ActivityFeed` also serve
   `default-purchase`, `default-booking`, `default-inquiry`, `default-negotiation`,
   and `default-download`. Gate CGC-specific rendering behind
   `processName === CGC_UGC_PROCESS_NAME`, the way
   [`CollaborationDetailsMaybe.js`](src/containers/TransactionPage/TransactionPanel/CollaborationDetailsMaybe.js)
   already does. Do not restructure their shared markup.
5. **Follow the existing CSS conventions.** One `.module.css` per component,
   `composes: … from global` for shared type styles, mobile-first with two
   breakpoints (`--viewportMedium` 768px, `--viewportLarge` 1024px), 6px spacing
   baseline on mobile and 8px from `--viewportMedium` up. See `AGENTS.md`.
6. **After every phase, run all three:**
   ```bash
   yarn verify-cgc && npx jest --runInBand && yarn build-web
   ```
   `yarn verify-cgc` guards the process ↔ translations ↔ UI wiring. The full test
   suite is flaky under parallel workers (`LandingPage` can time out on a cold
   run); `--runInBand` is the reliable signal.
7. **Add translation keys for every new state or role you render.** The verify
   script checks the `cgc-ugc-approval` process, but it cannot know about new
   components you invent — extend `scripts/verify-cgc.js` when you add a surface
   with per-state copy.

---

## Phase 0 — Design foundation

Everything downstream inherits from this, so do it first and get it approved
before building screens. Nothing here should change behaviour.

### 0.1 Retune the design tokens

**File:** [`src/styles/marketplaceDefaults.css`](src/styles/marketplaceDefaults.css)

The single biggest reason the app reads as "template" is the token layer, not the
layouts. Current values and what to change:

| Token | Now | Target | Why |
|---|---|---|---|
| `--borderRadius` | `2px` | `8px` | 2px is the strongest "unstyled Sharetribe" tell |
| `--borderRadiusMedium` | `4px` | `12px` | Cards, inputs, modals |
| `--borderRadiusLarge` | *(missing)* | `20px` | Add it; for hero panels and media |
| `--boxShadowListingCard` | `0 0 50px rgba(0,0,0,.1)` | layered, tighter | A 50px blur with no offset reads as a glow, not elevation |

Add a proper elevation ramp rather than the current ad-hoc set — three levels
(`--boxShadowXs`, `--boxShadowSm`, `--boxShadowMd`), each combining a tight
ambient shadow with a soft directional one. Keep every existing `--boxShadow*`
variable name in place and redefine it in terms of the new ramp; components
reference them by name and deleting one breaks unrelated pages.

Tighten the type scale: the template's headings are close in size, which flattens
hierarchy. A premium editorial feel needs a wider ratio between `h1` and body,
and tighter letter-spacing on large headings only.

**Acceptance:** run `yarn build-web`, then load the landing page, a listing page,
and a transaction page. Nothing should be misaligned, and the change should feel
like the same app with better craft — not a different app.

### 0.2 Rebuild `Logo` properly

**File:** [`src/components/Logo/Logo.js`](src/components/Logo/Logo.js)

Current state is a stopgap: it hardcodes an inline SVG with hex colors and inline
styles, and **deletes the `layout === 'desktop'` branch entirely**, so the desktop
topbar renders the mobile logo. Fix by:

- Restoring the `mobile` / `desktop` layout branches.
- Moving styles into `Logo.module.css` and using `--marketplaceColor` instead of
  `#6366F1` / `#0F172A`.
- Keeping the image-based path working, since the client will upload a real logo
  in Console and that must win over any coded fallback.

### 0.3 Fix shared copy that reads wrong for CGC

- `TransactionPanel.disputeOrder` currently says "dispute this order" and is shared
  with other processes. Add a CGC-specific key and select it by `processName` in
  [`TransactionPanel.js`](src/containers/TransactionPage/TransactionPanel/TransactionPanel.js);
  the wording should be "Escalate to the CGC team", not "dispute".
- Audit `TransactionPage.*` and `InboxPage.*` copy for "order"/"listing" language
  that should read "collaboration"/"creator" for this process.

---

## Phase 1 — Close the remaining functional gaps

These are bugs and missing wiring, not design. Do them before styling screens, or
you will be styling broken states.

### 1.1 `InboxPage` shows no status for CGC transactions

**Same bug class that made `TransactionPage` unusable.**
[`InboxPage.stateData.js:53`](src/containers/InboxPage/InboxPage.stateData.js) falls
through to `return {}` for unknown processes, so CGC collaborations appear in the
inbox with no state label and no "action needed" flag.

Create `src/containers/InboxPage/InboxPage.stateDataCGCUGC.js` mirroring
[`InboxPage.stateDataPurchase.js`](src/containers/InboxPage/InboxPage.stateDataPurchase.js),
and add the branch in `InboxPage.stateData.js`. Mark `actionNeeded: true` for the
states where that role must act — they are already enumerated as
`statesNeedingCustomerAttention` and `statesNeedingProviderAttention` in
[`transactionProcessCGCUGC.js`](src/transactions/transactionProcessCGCUGC.js);
reuse those lists rather than re-deriving them.

Then add `InboxPage.cgc-ugc-approval.*` state labels to `en.json` (see the 12
existing `InboxPage.default-purchase.*` keys for the pattern), and extend
`scripts/verify-cgc.js` with a check that every state has an inbox label for both
roles.

### 1.2 Wire the subscription gates

The gate helper ([`src/util/subscription.js`](src/util/subscription.js)) and the
`/subscription` page exist, but nothing calls the gate yet. Add checks at three
call sites, each redirecting an unsubscribed brand to `SubscriptionPage` rather
than failing silently:

| Action | Where |
|---|---|
| Posting a project brief | `EditListingPage` — only for the `project-brief` listing type |
| Contacting / inviting a creator | `ListingPage` inquiry entry point |
| Checkout | `CheckoutPageAccessWrapper.js` — mirror how it already handles `NO_ACCESS_PAGE_USER_PENDING_APPROVAL` |

Dispatch `fetchBrandSubscription()` once on app load for logged-in users, and use
`isSubscriptionStatusResolved` to render a spinner while it's unknown.
**Never flash a paywall at a paying customer** — that is worse than a brief delay.

Creators must never see a subscription gate. Pass the user's role explicitly;
`checkBrandAccess` already takes `isBrand`.

### 1.3 The shipping direction is inverted — fix before styling it

**This is an architectural bug, not a cosmetic one.** Sharetribe's delivery model
is provider → customer. CGC is the inverse: the **brand (customer) ships to the
creator (provider)**. The backend currently reuses
`protectedData.deliveryMethod === 'shipping'` as the signal
([`TransactionPage.stateDataCGCUGC.js`](src/containers/TransactionPage/TransactionPage.stateDataCGCUGC.js)),
which breaks in three ways:

1. **Money flows the wrong way.** For `deliveryMethod` to ever equal `'shipping'`,
   the *creator* must enable shipping on their own listing and set a shipping fee.
   That fee is then charged to the brand and paid out to the creator — but the
   brand pays its own courier directly.
2. **It surfaces the wrong address.** `getShippingDetailsMaybe` in
   [`CheckoutPageTransactionHelpers.js`](src/containers/CheckoutPage/CheckoutPageTransactionHelpers.js)
   collects the *recipient* address from the brand at checkout, i.e. the brand's
   own address. `DeliveryInfoMaybe` then renders it on the transaction page as
   "shipping info", so the brand is shown its own address.
3. **The creator's address is never collected.** Nothing in the flow asks the
   creator where the product should be sent, so the brand cannot actually ship.

The client listed *Shipping confirmation*, *Tracking information* and *Delivery
confirmation* explicitly. Tracking works today; the destination does not.

**Fix, in order:**

- Switch the signal from `protectedData.deliveryMethod` to the `requiresProduct`
  listing field. Note that field is currently a **dangling spec** — it is written
  up in CGC-SETUP.md §2c but `grep` finds zero references in the codebase.
- **Do not enable Sharetribe's pickup/shipping delivery methods on the
  `creator-profile` listing type at all.** That removes problem 1 entirely and
  stops a nonsensical shipping fee line item from ever being created.
- Stop rendering `DeliveryInfoMaybe` for this process, or the brand keeps seeing
  its own address labelled as shipping info.
- Collect the creator's address. Preferred: add a self-transition
  `provider-add-shipping-address` (`:from` and `:to` both `:state/purchased`) so
  the creator supplies it after payment, reusing the existing `CGCActionModal`
  pattern. **Verify this first** — it is not confirmed that Sharetribe's v3 process
  format permits self-transitions, and `flex-cli process push` is the validator.
  If it rejects the self-transition, either add an `awaiting-address` state
  between `purchased` and `shipped`, or fall back for v1 to exchanging the address
  in the existing message thread and note it as a known limitation.

Any process change means a new version and an alias update (CGC-SETUP.md §1), and
`yarn verify-cgc` must pass afterwards — it cross-checks `process.edn` against the
JS mirror, which is what catches a drifting graph.

---

## Phase 2 — The collaboration workspace

**This is the highest-value work in the whole plan.** The client wrote, verbatim:
*"The workflow should clearly track each stage of the project, including
submission, revision requests, approvals, and completion."* Today that is a chat
thread with two buttons underneath. The stage of a project is invisible.

### 2.1 `StageTracker` component

**New:** `src/containers/TransactionPage/StageTracker/`

A horizontal (desktop) / vertical (mobile) tracker pinned above the transaction
panel, showing where the collaboration stands. Derive it from the process graph —
do not hardcode a stage list, or it will drift from `process.edn`.

Collapse the 19 process states into five human stages:

| Stage | States |
|---|---|
| Booked | `purchased` |
| Product shipped | `shipped`, `product-received` — skip entirely when no product is involved |
| Content submitted | `content-submitted`, `content-submitted-revised-1`, `content-submitted-revised-2` |
| In revision | `revision-requested-1`, `revision-requested-2` |
| Approved & paid | `received`, `completed`, `reviewed-by-*`, `reviewed` |

Requirements:
- Each stage: done / current / upcoming, plus the date it was reached (read from
  the transaction's `transitions` array).
- Show the revision counter explicitly — "Revision 1 of 2" — because the two-revision
  cap is a core client rule and is currently invisible to both parties.
- Surface the deadline that actually matters in the current state, driven by the
  time-based transitions already in `process.edn`: the 7-day auto-approve window
  in the content-submitted states, the 14-day auto-cancel elsewhere. Brands and
  creators both need to know money moves on a clock.
- Terminal states (`canceled`, `payment-expired`, `disputed`) get their own
  treatment, not a stage in the happy path.
- Gate on `processName === CGC_UGC_PROCESS_NAME`.

### 2.2 Content review experience

Right now the brand approves content via a plain button and reads links from a
text row. For the surface where money is released, that is too thin.

Upgrade [`CollaborationDetailsMaybe.js`](src/containers/TransactionPage/TransactionPanel/CollaborationDetailsMaybe.js):
- Render submitted links as a deliverables list with per-item affordances, not a
  wall of URLs.
- Show the revision history as a timeline: what was asked for each round, and what
  came back. Both are already in protected data (`revisionNote`, `contentLinks`,
  `submissionNote`).
- Keep the existing `isSafeUrl` check. Creator-submitted strings are untrusted
  input; do not render them as links or embeds without validation, and do not
  add an iframe-based preview of arbitrary user URLs.

Make the approve action feel consequential — a confirmation step that states
plainly that approving releases payment and cannot be undone.

### 2.3 Approve/revise decision panel

Give the brand a single clear decision area in the content-submitted states
instead of a primary button, a secondary button, and an unrelated "dispute" link
in a different part of the page. When the revision allowance is exhausted
(`content-submitted-revised-2`), the UI must explain *why* there is no revision
button — currently it just silently disappears.

---

## Phase 3 — Creator directory and profiles

"Browse creator profiles" for a network selling *quality over quantity*. The
generic `ListingCard` price-and-title grid actively works against that.

### 3.1 `CreatorCard`

**New:** `src/components/CreatorCard/` — do not edit `ListingCard` in place; it
serves every other listing type.

Portfolio-first: media the dominant element, creator identity second, price
tertiary. Surface the fields defined in CGC-SETUP.md §2c — `contentNiche`,
`platforms`, `deliverableCount`, `turnaroundDays`, `usageRights` — as compact
metadata, plus a rating summary and a vetted badge. The vetted badge is the whole
premise of an invite-only network and should be visible everywhere a creator
appears.

Render it from `SearchResultsPanel` when the listing type is `creator-profile`,
falling back to `ListingCard` otherwise.

### 3.2 Creator profile page

**Files:** `ListingPageCarousel.js` / `ListingPageCoverPhoto.js` and their sections.

Reorder for a creator, not a product: portfolio gallery → who they are and niche
→ what a package includes and usage rights → reviews → booking panel. Usage
rights and deliverable counts must be unmissable, since ambiguity there is the
main source of UGC licensing disputes — and "transparent partnerships" is the
client's own stated positioning.

The booking panel (`OrderPanel`) is shared; restyle via CSS and CGC-gated props
rather than restructuring it.

### 3.3 "Invite creators to collaborate" as its own flow

The client lists this as a distinct capability, but right now it resolves to the
generic inquiry entry point, which reads as "send a message". Give it a real
identity: a brand invites a specific creator *to a specific brief*.

Mechanically this is still `transition/inquire` — no process change needed. What's
missing is the framing: let the brand pick one of its open `project-brief`
listings, attach that context to the inquiry's protected data, and render it on the
creator's side as an invitation with the brief attached rather than a bare message.
A creator receiving "Lumen Skincare invited you to *Summer campaign — 3 Reels*"
converts very differently from receiving "Hi".

### 3.4 Filters

Restyle the existing filter components as premium chips. **Do not build new filter
logic** — `SelectMultipleFilter` and friends already work, and the search index
must be configured in Console first (CGC-SETUP.md §2c). Presentation only.

---

## Phase 4 — Brand dashboard

### 4.1 Inbox as a pipeline

Once Phase 1.1 gives inbox rows a real status, turn the inbox into the
"manage deliverables" surface the client asked for: group collaborations by stage,
lead with what needs the viewer's action, show the revision counter and the
relevant deadline per row. Two distinct views — brands see *their* projects,
creators see *their* bookings — driven by role, not two separate pages.

### 4.2 Long-term relationships

The client wrote: *"build long-term relationships with creators through a trusted
review system."* Nothing in the app serves this yet — every collaboration is a
dead end once it reaches `reviewed`. Three surfaces close it:

- **Roster / saved creators.** Let a brand keep the creators it wants to work with
  again. Store on the brand's own profile (`privateData`) via
  `sdk.currentUser.updateProfile` — a user can write their own extended data, so
  this needs no new server endpoint.
- **Collaboration history per creator.** On a creator's profile, show a brand its
  own past collaborations with that creator. The data is already there: query
  transactions filtered by listing.
- **Book again.** From a completed collaboration and from the roster, one click
  back into checkout with the same package. This is the highest-value item of the
  three — repeat bookings are the whole economic argument for a subscription.

None of this needs a backend change, which is why it belongs in the frontend plan
rather than a process revision.

---

## Phase 5 — Landing, onboarding, subscription

### 5.1 PageBuilder sections

Restyle `SectionHero`, `SectionColumns`, `SectionFeatures`, `SectionCarousel`,
`SectionListings` in `src/containers/PageBuilder/SectionBuilder/`. The client
writes the actual landing copy in Console; your job is to make any content poured
into these sections look premium. Test with the real hosted content, not lorem
ipsum.

### 5.2 Application / vetting flow

An invite-only network needs the application to feel like an application. The
gating already works ([`isUserAuthorized`](src/util/userHelpers.js)); the copy is
updated; what's missing is a signup experience that sets the expectation of
review, and a clear pending state after submitting. `NoAccessPage` is the surface.

### 5.3 Subscription page

[`SubscriptionPage`](src/containers/SubscriptionPage/SubscriptionPage.js) is
functional but visually plain. It is a paywall, so it has to sell. Note the plan
price is **not** in the code — it lives in Stripe. Either fetch it or let the
client set it as copy in Console; do not hardcode a number that will go stale.

---

## Phase 6 — Brief posting

Reshape the `EditListingPage` wizard for the `project-brief` listing type so it
reads as "post a project" rather than "create a listing": brief details, budget
range, deadline, niche and platforms, deliverables wanted. Listing type config in
Console (CGC-SETUP.md §2) must exist before this can be built or tested.

---

## Sequencing

Phases 0 and 1 are prerequisites for everything. After that, **Phase 2 delivers the
most client-visible value per hour** and should come next; it is the thing the
client described in the most detail and the thing the current UI fails at hardest.

| Order | Phase | Depends on |
|---|---|---|
| 1 | 0 — Foundation | — |
| 2 | 1 — Functional gaps (incl. §1.3 shipping direction) | 0 |
| 3 | 2 — Collaboration workspace | 0, 1 |
| 4 | 3 — Directory & profiles | 0; Console listing types |
| 5 | 4 — Dashboard | 1.1 |
| 6 | 5 — Landing & subscription | 0; Console CMS content |
| 7 | 6 — Brief posting | Console listing types |

## What cannot be verified locally

Be honest in your handover about these; do not report them as working.

- Anything touching listing types, listing fields, or search filters needs the
  Console configuration from CGC-SETUP.md §2 to exist first.
- The subscription gates cannot be tested end to end without
  `STRIPE_SECRET_KEY` and `STRIPE_BRAND_SUBSCRIPTION_PRICE_ID`.
- Checkout cannot be tested at all until `REACT_APP_STRIPE_PUBLISHABLE_KEY` is set.
- The full collaboration workflow requires the process pushed to a real
  marketplace (CGC-SETUP.md §1) plus two test accounts.
