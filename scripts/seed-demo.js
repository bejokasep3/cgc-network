/**
 * Seeds a complete, presentable demo scenario for The CGC Network.
 *
 * Produces: 1 brand with a real (test-mode) Stripe subscription, 1 operator,
 * 6 creators with full creator-profile listings and profile photos, and a set
 * of project listings with briefs that read like real campaigns.
 *
 * WHY THIS WAS REWRITTEN
 * ----------------------
 * The previous version looked like it worked and did almost nothing. Two bugs:
 *
 *  1. It used `integrationSdk.users.query({ email })` as an existence check.
 *     The Integration API does not support an `email` filter on users.query —
 *     the parameter is silently ignored and the call returns *every* user. So
 *     `data[0]` always matched somebody, every account was treated as already
 *     existing, and each run wrote one persona's privateData onto whichever
 *     unrelated user happened to sort first. `users.show({ email })` is the
 *     documented lookup and 404s cleanly when the user is absent.
 *
 *  2. Every `users.approve()` sat inside an empty `catch {}`. The approvals
 *     were being applied to the wrong user and failing, and nothing was ever
 *     printed. That is why the brand and operator accounts stayed
 *     `pendingApproval` — unable to transact — while the log read as success.
 *
 * Nothing here swallows an error. If a step fails the script says so and exits
 * non-zero, because a seeder that lies is worse than no seeder.
 *
 * Also fixed: `platforms` values now use the enum actually defined in
 * src/config/configListing.js (`instagram-reels`, not `ig-reels`). Unknown enum
 * values don't match search filters and render without a label.
 *
 * WHAT THIS SCRIPT CANNOT DO
 * --------------------------
 * Applications and collaborations are deliberately absent. The Integration API
 * can only *transition* transactions, never initiate them, and both entry
 * points (`transition/apply`, `transition/request-payment`) are privileged
 * transitions that must go through the app's own server plus a Stripe payment
 * confirmation. Those states are created by walking the UI once — see DEMO.md.
 *
 * Idempotent: safe to re-run. Existing users are updated in place, listings are
 * matched by title per author, and photos are only uploaded when missing.
 *
 * Usage: node scripts/seed-demo.js
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../server/env').configureEnv();

const fs = require('fs');
const os = require('os');
const path = require('path');
const sharetribeSdk = require('sharetribe-flex-sdk');
const { getIntegrationSdk } = require('../server/api-util/integrationSdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const baseUrlMaybe = BASE_URL ? { baseUrl: BASE_URL } : {};

if (!CLIENT_ID) {
  console.error('Missing REACT_APP_SHARETRIBE_SDK_CLIENT_ID — check your .env file.');
  process.exit(1);
}

// Shared by every seeded account, including the brand and operator that an
// earlier run already created with this password. One credential set keeps
// DEMO.md short enough to actually follow during a live demo.
const DEMO_PASSWORD = 'SeedDemoPassword123!';

const USD = amount => ({ amount, currency: 'USD' });
const daysFromNow = n => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const dateOnly = d => d.toISOString().split('T')[0];

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

const BRAND = {
  email: 'demo.brand@cgcnetwork.com',
  firstName: 'GlowUp',
  lastName: 'Beauty',
  publicData: { userType: 'brand' },
  privateData: {
    accessRequest: {
      company: 'GlowUp Beauty Co.',
      website: 'https://glowupbeauty.example.com',
      category: 'beauty',
      monthlyVolume: '10-25',
      budgetRange: '$5k-$10k',
      submittedAt: new Date().toISOString(),
    },
  },
};

const OPERATOR = {
  email: 'demo.operator@cgcnetwork.com',
  firstName: 'CGC',
  lastName: 'Operator',
  publicData: { userType: 'operator' },
};

// Photos come from Unsplash, whose license allows commercial use without
// attribution. They are stand-ins for a demo — before any public launch these
// should be replaced with real creator photos or model-released stock, since
// the Unsplash license does not cover implying that a person endorses a product.
const CREATORS = [
  {
    email: 'demo.creator.claire@cgcnetwork.com',
    firstName: 'Claire',
    lastName: 'Kensington',
    photo: 'photo-1494790108377-be9c29b29330',
    listing: {
      title: 'Beauty & skincare UGC — TikTok-first, 5 day turnaround',
      description:
        'I make skincare content that looks like a friend recommending something, not an ad. Six years on camera, mostly close-up texture shots and honest first-impression reactions. I shoot in natural light in a home bathroom setup, which tests better for skincare than studio lighting.',
      price: USD(45000),
      contentNiche: ['beauty', 'fashion'],
      platforms: ['tiktok', 'instagram-reels'],
      usageRights: 'paid-ads-6m',
    },
    application: {
      handles: [
        { platform: 'tiktok', url: 'https://tiktok.com/@clairek_ugc', followers: 145000 },
        { platform: 'instagram-reels', url: 'https://instagram.com/clairek', followers: 62000 },
      ],
      niches: ['beauty', 'fashion'],
      typicalTurnaroundDays: 5,
      indicativeRateInSubunits: 45000,
    },
  },
  {
    email: 'demo.creator.marcus@cgcnetwork.com',
    firstName: 'Marcus',
    lastName: 'Hale',
    photo: 'photo-1507003211169-0a1dd7228f2d',
    listing: {
      title: 'Fitness & supplement UGC — high-energy hooks that hold',
      description:
        'Gym-floor content shot mid-session, not staged afterwards. I specialise in the first three seconds: the hook is where supplement ads lose people. Happy to shoot multiple hook variations against the same body so you can test.',
      price: USD(50000),
      contentNiche: ['fitness', 'tech'],
      platforms: ['tiktok', 'youtube-shorts'],
      usageRights: 'paid-ads-12m',
    },
    application: {
      handles: [{ platform: 'tiktok', url: 'https://tiktok.com/@marcus_trains', followers: 210000 }],
      niches: ['fitness', 'tech'],
      typicalTurnaroundDays: 4,
      indicativeRateInSubunits: 50000,
    },
  },
  {
    email: 'demo.creator.priya@cgcnetwork.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    photo: 'photo-1438761681033-6461ffad8d80',
    listing: {
      title: 'Wellness & self-care UGC — calm, slow, voiceover-led',
      description:
        'Softer, slower content for brands that do not want to shout. Voiceover-led routines and unboxings, usually 45–60 seconds. Works well for supplements, teas, sleep and skincare where trust matters more than urgency.',
      price: USD(40000),
      contentNiche: ['beauty', 'home'],
      platforms: ['instagram-reels', 'instagram-static'],
      usageRights: 'paid-ads-6m',
    },
    application: {
      handles: [
        { platform: 'instagram-reels', url: 'https://instagram.com/priya.wellness', followers: 75000 },
      ],
      niches: ['beauty', 'home'],
      typicalTurnaroundDays: 6,
      indicativeRateInSubunits: 40000,
    },
  },
  {
    email: 'demo.creator.diego@cgcnetwork.com',
    firstName: 'Diego',
    lastName: 'Morales',
    photo: 'photo-1500648767791-00dcc994a43e',
    listing: {
      title: 'Food & beverage UGC — kitchen-realistic, no food styling',
      description:
        'Food content shot in an actual kitchen with actual mess. Brands keep telling me the unpolished version outperforms the styled one, so that is what I lean into. Recipe-format and taste-reaction both available.',
      price: USD(38000),
      contentNiche: ['food', 'home'],
      platforms: ['tiktok', 'instagram-reels'],
      usageRights: 'organic-only',
    },
    application: {
      handles: [{ platform: 'tiktok', url: 'https://tiktok.com/@diegoeats', followers: 98000 }],
      niches: ['food', 'home'],
      typicalTurnaroundDays: 7,
      indicativeRateInSubunits: 38000,
    },
  },
  {
    email: 'demo.creator.aaliyah@cgcnetwork.com',
    firstName: 'Aaliyah',
    lastName: 'Jones',
    photo: 'photo-1534528741775-53994a69daeb',
    listing: {
      title: 'Fashion & accessories UGC — styling and try-on hauls',
      description:
        'Try-on and styling content for fashion and accessories, size 14, which most UGC rosters are missing. Multiple outfit combinations per shoot so one session gives you several ad variants.',
      price: USD(42000),
      contentNiche: ['fashion', 'beauty'],
      platforms: ['instagram-reels', 'tiktok'],
      usageRights: 'paid-ads-3m',
    },
    application: {
      handles: [
        { platform: 'instagram-reels', url: 'https://instagram.com/aaliyahstyles', followers: 118000 },
      ],
      niches: ['fashion', 'beauty'],
      typicalTurnaroundDays: 5,
      indicativeRateInSubunits: 42000,
    },
  },
  {
    email: 'demo.creator.owen@cgcnetwork.com',
    firstName: 'Owen',
    lastName: 'Tran',
    photo: 'photo-1506794778202-cad84cf45f1d',
    listing: {
      title: 'Tech & gadget UGC — hands-on demos and setup walkthroughs',
      description:
        'Straightforward product demos for tech: what it does, whether it works, who it is for. Longer YouTube cuts and short-form versions from the same shoot. I read the manual before filming, which apparently is unusual.',
      price: USD(55000),
      contentNiche: ['tech', 'gaming'],
      platforms: ['youtube', 'youtube-shorts', 'tiktok'],
      usageRights: 'perpetual',
    },
    application: {
      handles: [
        { platform: 'youtube', url: 'https://youtube.com/@owentran', followers: 164000 },
        { platform: 'tiktok', url: 'https://tiktok.com/@owentech', followers: 89000 },
      ],
      niches: ['tech', 'gaming'],
      typicalTurnaroundDays: 6,
      indicativeRateInSubunits: 55000,
    },
  },
];

const PROJECTS = [
  {
    title: 'Botanical Hydrating Serum — 30s TikTok demo',
    description:
      'We are launching our Botanical Hydrating Serum and need honest first-impression content, not a polished commercial. Show the dropper, the texture on the back of the hand, then application. Say what it actually feels like — if it is tacky, say it is tacky. Natural light only, no filters, no trending audio.',
    price: USD(45000),
    publicData: {
      contentNiche: ['beauty'],
      platforms: ['tiktok'],
      usageRights: 'paid-ads-6m',
      requiresProduct: true,
      contentDueDate: dateOnly(daysFromNow(14)),
      deliverables: [
        {
          id: 'd1',
          type: 'video',
          spec: '30s vertical (9:16) — hook, texture close-up, application, one-line verdict',
          platform: 'tiktok',
          quantity: 1,
        },
      ],
      projectStatus: 'open',
    },
  },
  {
    title: 'SPF50 Sunscreen — summer routine Reel + 3 hook variants',
    description:
      'Main deliverable is a 45-second morning routine Reel where our SPF50 appears as a natural step, not the hero. Plus three alternative opening hooks shot against the same footage so we can test which one holds. Please avoid the word "holy grail".',
    price: USD(60000),
    publicData: {
      contentNiche: ['beauty', 'home'],
      platforms: ['instagram-reels'],
      usageRights: 'paid-ads-12m',
      requiresProduct: true,
      contentDueDate: dateOnly(daysFromNow(21)),
      deliverables: [
        { id: 'd1', type: 'video', spec: '45s Instagram Reel — morning routine', platform: 'instagram-reels', quantity: 1 },
        { id: 'd2', type: 'video', spec: '3x alternative 5s opening hooks', platform: 'instagram-reels', quantity: 3 },
      ],
      projectStatus: 'open',
    },
  },
  {
    title: 'Recovery Protein Blend — gym-floor UGC, 2 creators',
    description:
      'Post-workout content shot at the gym, mid-session, sweaty. We want the shake being made and drunk in context rather than a kitchen-counter setup. Two creators so we can A/B different audiences. Mention the 24g protein figure once, naturally.',
    price: USD(50000),
    publicData: {
      contentNiche: ['fitness'],
      platforms: ['tiktok', 'youtube-shorts'],
      usageRights: 'paid-ads-12m',
      requiresProduct: true,
      contentDueDate: dateOnly(daysFromNow(10)),
      deliverables: [
        { id: 'd1', type: 'video', spec: '30s vertical — mixing and drinking, gym setting', platform: 'tiktok', quantity: 1 },
      ],
      projectStatus: 'open',
    },
  },
  {
    title: 'Ceramic Cookware — kitchen-real recipe content',
    description:
      'Cook something genuinely messy in our ceramic pan and show the clean-up afterwards. The non-stick claim is the whole point, so the clean-up shot matters more than the cooking shot. No food styling, no perfect plating.',
    price: USD(38000),
    publicData: {
      contentNiche: ['food', 'home'],
      platforms: ['tiktok', 'instagram-reels'],
      usageRights: 'organic-only',
      requiresProduct: true,
      contentDueDate: dateOnly(daysFromNow(28)),
      deliverables: [
        { id: 'd1', type: 'video', spec: '60s recipe + clean-up demonstration', platform: 'tiktok', quantity: 1 },
      ],
      projectStatus: 'open',
    },
  },
];

// ---------------------------------------------------------------------------
// Sharetribe helpers
// ---------------------------------------------------------------------------

const sdk = getIntegrationSdk();

const findUserByEmail = async email => {
  try {
    const res = await sdk.users.show({ email });
    return res?.data?.data || null;
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
};

/** Creates the account if missing, then brings publicData, privateData and
 *  approval state in line with the persona regardless of how it got there. */
const ensureUser = async persona => {
  const { email, firstName, lastName, publicData, privateData } = persona;
  let user = await findUserByEmail(email);

  if (!user) {
    const marketplaceSdk = sharetribeSdk.createInstance({ clientId: CLIENT_ID, ...baseUrlMaybe });
    const res = await marketplaceSdk.currentUser.create({
      email,
      password: DEMO_PASSWORD,
      firstName,
      lastName,
      publicData,
    });
    user = res.data.data;
    console.log(`  created  ${email}  (${user.id.uuid})`);
  } else {
    console.log(`  found    ${email}  (${user.id.uuid})`);
  }

  // Always re-apply publicData: accounts left over from an earlier seeding
  // round carry userType "provider", and server/api/list-creators.js only
  // surfaces userType "creator", so without this they stay invisible.
  const updated = await sdk.users.updateProfile(
    { id: user.id, publicData, ...(privateData ? { privateData } : {}) },
    { expand: true }
  );
  user = updated?.data?.data || user;

  const state = user.attributes?.state;
  if (state === 'pendingApproval') {
    const approved = await sdk.users.approve({ id: user.id }, { expand: true });
    const newState = approved?.data?.data?.attributes?.state;
    console.log(`  approved ${email}  ${state} -> ${newState}`);
    user = approved?.data?.data || user;
  }

  return user;
};

const listingsByAuthor = async authorId => {
  const out = [];
  let page = 1;
  while (page <= 20) {
    const res = await sdk.listings.query({ authorId, page, perPage: 100 });
    out.push(...(res?.data?.data || []));
    const meta = res?.data?.meta || {};
    if (!meta.totalPages || page >= meta.totalPages) break;
    page += 1;
  }
  return out;
};

/** Matched by title per author so re-runs update rather than duplicate. */
const ensureListing = async (authorId, { title, description, price, publicData }) => {
  const existing = (await listingsByAuthor(authorId)).find(
    l => (l.attributes?.title || '').trim() === title.trim() && l.attributes?.state !== 'closed'
  );

  if (existing) {
    await sdk.listings.update({ id: existing.id, title, description, price, publicData });
    console.log(`    updated listing  ${JSON.stringify(title.slice(0, 46))}`);
    return existing;
  }

  const res = await sdk.listings.create({
    authorId,
    title,
    description,
    price,
    state: 'published',
    publicData,
  });
  console.log(`    created listing  ${JSON.stringify(title.slice(0, 46))}`);
  return res?.data?.data;
};

const ensureProfilePhoto = async (user, unsplashId) => {
  if (user.relationships?.profileImage?.data) {
    console.log('    photo already set');
    return;
  }
  const url = `https://images.unsplash.com/${unsplashId}?w=600&h=600&fit=crop&crop=faces`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`photo download failed: ${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  // images.upload needs a named file stream, not a bare Buffer — a multipart
  // part with no filename comes back as a 500 from the Integration API.
  const tmpFile = path.join(os.tmpdir(), `cgc-seed-${unsplashId}.jpg`);
  fs.writeFileSync(tmpFile, buffer);
  try {
    const uploaded = await sdk.images.upload({ image: fs.createReadStream(tmpFile) });
    const imageId = uploaded?.data?.data?.id;
    await sdk.users.updateProfile({ id: user.id, profileImageId: imageId });
    console.log(`    uploaded photo   (${Math.round(buffer.length / 1024)} KB)`);
  } finally {
    fs.unlinkSync(tmpFile);
  }
};

// ---------------------------------------------------------------------------
// Stripe — a real test-mode subscription
// ---------------------------------------------------------------------------

const STRIPE_API = 'https://api.stripe.com/v1';

const formEncode = (obj, prefix = '') =>
  Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .flatMap(([k, v]) => {
      const key = prefix ? `${prefix}[${k}]` : k;
      return typeof v === 'object' && !Array.isArray(v)
        ? formEncode(v, key)
        : [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`];
    })
    .join('&');

const stripe = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(body ? { body: formEncode(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
};

/**
 * server/api/subscription.js treats Stripe as the source of truth and only
 * caches `stripeCustomerId` on the profile — it never reads a mirrored status
 * flag. Writing a fake `privateData.subscription` therefore does nothing at
 * all, which is why the demo brand was still being gated out of posting
 * projects. This creates an actual test-mode subscription instead.
 */
const ensureBrandSubscription = async brandUser => {
  const priceId = process.env.STRIPE_BRAND_SUBSCRIPTION_PRICE_ID;
  if (!process.env.STRIPE_SECRET_KEY || !priceId) {
    console.log('  SKIPPED subscription — STRIPE_SECRET_KEY / PRICE_ID not set');
    return;
  }

  let customerId = brandUser.attributes?.profile?.privateData?.stripeCustomerId;

  if (customerId) {
    const subs = await stripe(`/subscriptions?customer=${customerId}&status=all&limit=10`);
    const active = (subs.data || []).find(s => ['active', 'trialing'].includes(s.status));
    if (active) {
      console.log(`  subscription already active  (${active.id})`);
      return;
    }
  } else {
    const customer = await stripe('/customers', {
      method: 'POST',
      body: { email: BRAND.email, name: 'GlowUp Beauty Co.' },
    });
    customerId = customer.id;
    await sdk.users.updateProfile({
      id: brandUser.id,
      privateData: { stripeCustomerId: customerId },
    });
    console.log(`  created Stripe customer  ${customerId}`);
  }

  // pm_card_visa is Stripe's shared test payment method; it only exists in
  // test mode, so this can never touch a real card. Attaching it mints a new
  // payment method belonging to this customer — the literal "pm_card_visa"
  // string is not a valid default_payment_method, so use the returned id.
  const attached = await stripe(`/payment_methods/pm_card_visa/attach`, {
    method: 'POST',
    body: { customer: customerId },
  });
  await stripe(`/customers/${customerId}`, {
    method: 'POST',
    body: { invoice_settings: { default_payment_method: attached.id } },
  });

  const subscription = await stripe('/subscriptions', {
    method: 'POST',
    body: { customer: customerId, items: { 0: { price: priceId } } },
  });
  console.log(`  subscription ${subscription.status}  (${subscription.id})`);
};

// ---------------------------------------------------------------------------

const run = async () => {
  console.log('=== CGC Network demo seeder ===\n');

  console.log('Brand');
  const brand = await ensureUser(BRAND);
  await ensureBrandSubscription(brand);

  console.log('\nOperator');
  const operator = await ensureUser(OPERATOR);

  console.log('\nCreators');
  for (const creator of CREATORS) {
    const user = await ensureUser({
      email: creator.email,
      firstName: creator.firstName,
      lastName: creator.lastName,
      publicData: { userType: 'creator' },
      privateData: {
        application: { ...creator.application, submittedAt: new Date().toISOString() },
        // Clear brand-shaped keys that the previous buggy seeder wrote onto
        // creator accounts. Sharetribe deletes a key when it is set to null.
        accessRequest: null,
        subscription: null,
      },
    });
    await ensureProfilePhoto(user, creator.photo);
    await ensureListing(user.id, {
      title: creator.listing.title,
      description: creator.listing.description,
      price: creator.listing.price,
      publicData: {
        listingType: 'creator-profile',
        transactionProcessAlias: 'cgc-ugc-approval/release-1',
        unitType: 'item',
        contentNiche: creator.listing.contentNiche,
        platforms: creator.listing.platforms,
        usageRights: creator.listing.usageRights,
      },
    });
  }

  console.log('\nProjects');
  for (const project of PROJECTS) {
    await ensureListing(brand.id, {
      title: project.title,
      description: project.description,
      price: project.price,
      publicData: {
        listingType: 'project',
        transactionProcessAlias: 'cgc-application/release-1',
        unitType: 'inquiry',
        priceNegotiable: true,
        ...project.publicData,
      },
    });
  }

  console.log('\n=== Done ===');
  console.log(`\nAll demo accounts share the password: ${DEMO_PASSWORD}`);
  console.log(`Brand     ${BRAND.email}`);
  console.log(`Operator  ${OPERATOR.email}  (id ${operator.id.uuid})`);
  console.log(`Creators  ${CREATORS.map(c => c.email).join('\n          ')}`);
  console.log(`\nCGC_OPERATOR_USER_IDS must contain: ${operator.id.uuid}`);
};

run().catch(e => {
  // Deliberately narrow: dumping a raw Axios error prints the whole request
  // object, including the Authorization header holding a live API token.
  const apiErrors = e?.data?.errors;
  console.error('\nSEEDING FAILED');
  if (apiErrors) {
    console.error(JSON.stringify(apiErrors, null, 2));
  } else {
    console.error(`${e.message}${e.status ? ` (status ${e.status})` : ''}`);
  }
  process.exit(1);
});
