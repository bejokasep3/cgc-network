# Applying the CGC theme to the landing page — Console guide

> **Rev. 2.** The nav paths and the Listings section instructions in the previous
> revision were wrong — written from a template screenshot, not verified against
> Sharetribe's own documentation. This revision is checked against
> [sharetribe.com/docs](https://www.sharetribe.com/docs/) and the actual Console
> screenshot you sent. If something here still doesn't match what you see, trust
> your screen over this document and tell me — Console UI can differ by plan/version.

The landing page is assembled in Console, not in code. This guide covers what to
set there so the design direction actually lands. Do it in the order given —
branding is global and affects every step after it.

**Do this in the Test environment, not Dev.** No-code changes (content, branding,
listing types) don't carry across environments automatically — work done in Dev
has to be manually recreated elsewhere. Test has a **"Copy changes to..."** button
that pushes everything to Live in one click (~5 min to propagate) once you're happy
with it, so you only do this once. If your Console currently shows a "dev" badge,
switch environments first.

There is no API, CLI, or MCP shortcut for any of this — Sharetribe's Integration
API, `flex-cli`, and every MCP wrapper around them only touch operational data
(users, listings, transactions). Branding, Pages, listing types and search config
are Console-UI-only by design. So this is manual either way; doing it once in the
right environment is the only real time-saver available.

---

## First, what Console can and can't style

Per section, Console exposes exactly four appearance fields (confirmed against
Sharetribe's [page asset schema reference](https://www.sharetribe.com/docs/references/page-asset-schema/)):

| Field | Effect |
|---|---|
| `backgroundColor` | Section background, hex |
| `backgroundImage` | Section background image. **Minimum 1600×1200px, max 20MB** |
| `backgroundImageOverlay` | A darkening preset over that image: `none`, `dark`, or `darker` — not a custom value |
| `textColor` | `black` (default) or `white`. `white` switches the section to a dark theme |

That is the whole styling surface. **Everything else is code** — spacing, card
treatment, corner radius, typography, how blocks lay out in columns. Those have
already been changed to support this guide, so you only need to supply structure,
colour and copy.

Section and block limits, for reference: max 20 sections per page, max 20 blocks
per section, columns support 1/2/3/4 only.

### Two things that trip people up

- **Local code is the fallback, Console is the override.** For branding, the merge
  is `marketplaceColors?.mainColor ?? defaultBranding.marketplaceColor`. If Console
  is empty, you get the value from `src/config/configBranding.js`. That is why the
  site currently shows a colour nobody chose in Console.
- **Don't set `textColor: white` on its own.** It only makes sense paired with a
  dark `backgroundColor` or a `backgroundImage` + overlay. On a light section it
  makes the text invisible, and it also suppresses the card fills described below.

---

## Step 1 — Branding (Build → Design → Branding)

This is global and the highest-impact change.

| Setting | Value |
|---|---|
| Main colour | Your chosen accent, e.g. `#2C5CF0` |
| Primary button colour | Same as main colour |
| Logo | Upload the CGC logo. **Landscape orientation**, and supply it at 2× for retina |
| Logo height | 24, 36 or 48 px — those are the only supported values |

Until a logo is uploaded here, the app falls back to
`src/assets/biketribe-logo-desktop.png`, which is Sharetribe's demo logo — that is
the "YOUR LOGO" placeholder currently in the topbar.

Also replace, in the same place: the login background image and the social sharing
image. Both still point at biketribe demo assets.

---

## Step 2 — Marketplace name (Build → General)

Rename the marketplace to **The CGC Network**.

This matters beyond cosmetics: there is a workaround in
[`src/ducks/hostedAssets.duck.js`](src/ducks/hostedAssets.duck.js) that
string-replaces `"Warung Urang"` with `"CGC Network"` across every hosted asset at
runtime. Once the rename is done, that function and its three call sites should be
deleted. Leaving it in means the replacement runs on every render and will leak the
old name anywhere it doesn't happen to match.

---

## Step 3 — Search (Build → Listings → Listing search)

Two fixes, both real bugs rather than preferences:

- **Main search: keywords, not location.** Creators aren't location-bound, and
  location search hides every creator who hasn't set one.
- **Date range filter: off.** `creator-profile` listings are item-based and carry no
  availability data, so a date picker can only ever return empty results.

Both are already disabled in `src/config/configSearch.js`, but Console wins if it
has its own search config — so turn them off here too or the fix won't hold.

Separately — the search bar you saw sitting inside the hero on the screenshot isn't
part of the hero section itself; it's the topbar's search form, whose visibility is
controlled at **Build → Content → Top bar**, under the search bar's display setting
(`always` / `only on search page` / `not on landing page`). Default is `always`. If
you'd rather the landing page open on the hero message alone and let the topbar
search stay in the topbar (not duplicated below the headline), set it to `not on
landing page` — that's a preference, not a bug, so decide based on how you want the
hero to read.

---

## Step 4 — The landing page (Build → Content → Pages → landing-page)

Six sections. Backgrounds alternate between white and a very light grey so the page
reads as distinct bands without going dark.

Use `textColor: black` on **all** of them.

### 1. Hero

| Field | Value |
|---|---|
| Section type | Hero |
| Background colour | `#F4F5F7` |

- **Title:** `Vetted creators. Licensed content. No guesswork.`
- **Description:** `The CGC Network is invite-only. We approve every creator one by one, so you're choosing from people who have already proven they can deliver. Your payment is held until you approve the work.`
- **CTA:** `Browse creators` → link to `/s`

The hero used to be pinned to 80% of the viewport height, which left a third of the
screen empty. It is now content-driven with a floor, so a short headline no longer
produces a vast blank band.

### 2. Featured creators

| Field | Value |
|---|---|
| Section type | Listings |
| Columns | 3 or 4 (only values Listings sections support) |
| Background colour | `#FFFFFF` |

- **Title:** `Creators on the network`

For which listings to show, pick **"Specific listings"**, not "All listings" — the
"all listings" option would also pull in `project-brief` listings, which don't
belong in a creator showcase. Specific listings runs off a search query, and you
have two ways to build it:

- Fastest: go to **Manage → Listings**, filter to listing type `creator-profile`,
  click **Copy search query**, and paste it into the section.
- More control: use Sharetribe's
  [Featured Listings Query Generator](https://www.sharetribe.com/tools/featured-listings-query-generator/),
  which also lets you filter by category, custom listing fields (e.g. `contentNiche`),
  and sort order.

Either way, this is a **live query, not a fixed pick** — it auto-updates as new
creators get approved, so newly vetted creators show up here without you touching
the page again. Sort by newest first unless you want to hand-curate a rotating set
via a "featured" metadata tag (see the same help article if you want that later).

Put this high on the page. For a marketplace, visible supply is the single most
persuasive thing you can show, and it is what makes an invite-only claim credible.

### 3. How it works

| Field | Value |
|---|---|
| Section type | Features |
| Background colour | `#F4F5F7` |

Four blocks, in order. This is a genuine sequence, so numbering it is meaningful:

1. **Post a brief or invite a creator** — `Describe the content you need, or invite a creator directly from their profile.`
2. **Ship the product, if one's needed** — `Add tracking so your creator knows when to expect it.`
3. **Review the work** — `Approve it, or request a revision. You get up to two.`
4. **Payment is released** — `Funds only move once you approve. Then you both leave a public review.`

This section is the client's own differentiator — the streamlined, trackable
workflow — so it earns a prominent place.

### 4. For brands / for creators

| Field | Value |
|---|---|
| Section type | Columns |
| Number of columns | **2** |
| Background colour | `#FFFFFF` |

- **Title:** `Two sides, one standard`

Block 1 — **For brands**
`Browse the full roster, post unlimited briefs, and manage every deliverable in one place. Your payment is held securely until you approve the content.`
CTA: `Browse creators` → `/s`

Block 2 — **For creators**
`Apply once. If you're approved, you get access to paid briefs from vetted brands — no cold outreach, no chasing invoices.`
CTA: `Apply to join` → `/signup`

With two or more columns, each block now renders as a card with a light fill, no
border and no shadow. That is what stops multi-column sections reading as text
floating in space, which is how this section looks today.

### 5. Why brands trust it

| Field | Value |
|---|---|
| Section type | Columns |
| Number of columns | **3** |
| Background colour | `#F4F5F7` |

- **Title:** `Built so nobody gets burned`

1. **Payment held until approval** — `Funds are captured up front and released only when you approve the content. If nothing is delivered, you're refunded automatically.`
2. **Two revisions, in writing** — `Every revision request and resubmission is recorded on the collaboration, so there's no argument about what was asked for.`
3. **Usage rights up front** — `Every package states its licence — organic only, paid ads, or full buyout — before you book.`

On a tinted section like this one, the cards switch from a fill to a hairline
outline automatically, so they stay visible against the grey.

### 6. Creator application

| Field | Value |
|---|---|
| Section type | Article |
| Background colour | `#FFFFFF` |

- **Title:** `Applications are reviewed by hand`
- **Text:** `We read every application. If your work is a fit, you'll hear from us and your profile goes live on the network. If it isn't, we'll tell you that too.`
- **CTA:** `Apply to join` → `/signup`

---

## Step 5 — Access control (Build → General → Access control)

Not landing-page styling, but it's what makes "invite-only" true rather than a
claim in a headline:

- **User approval required** — new signups land in `pending-approval`. What that
  state can see depends on one more setting:
  - **Public marketplace** (recommended for CGC): pending users can browse listings
    and profiles, but can't publish a profile or transact until approved.
  - **Private marketplace**: pending users see nothing but their own profile — not
    even the creator directory. Don't use this for CGC: brands need to see the
    roster to be convinced enough to subscribe. Reserve private mode for a
    marketplace that's members-only even to look at.
- **Listing approval required** (`requireApprovalToPublish`) — creator profiles
  need review before going public.

No code needed; the app already gates every relevant surface on `isUserAuthorized`.

---

## After you're done

Rebuild and reload. If something looks off:

- **Colour didn't change** → Console main colour is still empty, so the fallback in
  `configBranding.js` is being used.
- **Cards didn't appear** → the section is set to 1 column, or `textColor` is
  `white`. Cards only render at 2+ columns.
- **Still seeing "YOUR LOGO"** → no logo uploaded in Branding, or the uploaded logo
  isn't `format: image` at a supported height (24/36/48).
- **Old marketplace name showing** → hosted assets are cached; asset-by-alias isn't
  cached by default but your browser may be. Hard-reload.

Content lives in Console, so you can iterate on copy without a developer and
without a deploy. Section structure and colour are safe to change freely; the code
side adapts.
