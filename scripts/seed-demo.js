/**
 * Seeds a complete demo scenario for The CGC Network:
 * - 1 Brand account with active subscription & company profile
 * - 1 Operator account for testing /admin/* pages
 * - 6 Creator accounts with full profiles (handles, niches, sample works)
 * - 3 Sample Project listings with detailed briefs & deliverables
 *
 * Usage: node scripts/seed-demo.js
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../server/env').configureEnv();

const sharetribeSdk = require('sharetribe-flex-sdk');
const { getIntegrationSdk } = require('../server/api-util/integrationSdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const baseUrlMaybe = BASE_URL ? { baseUrl: BASE_URL } : {};

if (!CLIENT_ID) {
  console.error('Missing REACT_APP_SHARETRIBE_SDK_CLIENT_ID — check your .env file.');
  process.exit(1);
}

const DEMO_PASSWORD = 'SeedDemoPassword123!';

const DEMO_BRAND = {
  email: 'demo.brand@cgcnetwork.com',
  firstName: 'GlowUp',
  lastName: 'Skincare',
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
    subscription: {
      status: 'active',
      stripeSubscriptionId: 'sub_demo_active_123',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
};

const DEMO_OPERATOR = {
  email: 'demo.operator@cgcnetwork.com',
  firstName: 'CGC',
  lastName: 'Operator',
  publicData: { userType: 'operator' },
};

const DEMO_CREATORS = [
  {
    firstName: 'Claire',
    lastName: 'K.',
    email: 'seed.creator.claire@example.com',
    publicData: { userType: 'creator' },
    privateData: {
      application: {
        handles: [{ platform: 'tiktok', url: 'https://tiktok.com/@clairek_ugc', followers: 145000 }],
        sampleWorks: ['https://drive.google.com/sample1', 'https://drive.google.com/sample2'],
        niches: ['beauty', 'lifestyle'],
        typicalTurnaroundDays: 5,
        indicativeRateInSubunits: 45000,
        submittedAt: new Date().toISOString(),
      },
    },
  },
  {
    firstName: 'Liz',
    lastName: 'Q.',
    email: 'seed.creator.liz@example.com',
    publicData: { userType: 'creator' },
    privateData: {
      application: {
        handles: [{ platform: 'ig-reels', url: 'https://instagram.com/lizq_reels', followers: 98000 }],
        sampleWorks: ['https://drive.google.com/sample3'],
        niches: ['fashion', 'beauty'],
        typicalTurnaroundDays: 7,
        indicativeRateInSubunits: 35000,
        submittedAt: new Date().toISOString(),
      },
    },
  },
  {
    firstName: 'Marcus',
    lastName: 'H.',
    email: 'seed.creator.marcus@example.com',
    publicData: { userType: 'creator' },
    privateData: {
      application: {
        handles: [{ platform: 'tiktok', url: 'https://tiktok.com/@marcus_fitness', followers: 210000 }],
        sampleWorks: ['https://drive.google.com/sample4'],
        niches: ['fitness', 'tech'],
        typicalTurnaroundDays: 4,
        indicativeRateInSubunits: 50000,
        submittedAt: new Date().toISOString(),
      },
    },
  },
  {
    firstName: 'Priya',
    lastName: 'S.',
    email: 'seed.creator.priya@example.com',
    publicData: { userType: 'creator' },
    privateData: {
      application: {
        handles: [{ platform: 'ig-reels', url: 'https://instagram.com/priya_ugc', followers: 75000 }],
        sampleWorks: ['https://drive.google.com/sample5'],
        niches: ['beauty', 'wellness'],
        typicalTurnaroundDays: 6,
        indicativeRateInSubunits: 40000,
        submittedAt: new Date().toISOString(),
      },
    },
  },
];

const DEMO_PROJECTS = [
  {
    title: 'GlowUp Botanical Face Serum - 30s TikTok UGC Video',
    description: 'Looking for beauty creators to film an authentic, high-converting 30-second TikTok UGC video demonstrating our new Botanical Hydrating Face Serum. Must show close-up application and before/after glow.',
    price: { amount: 45000, currency: 'USD' },
    publicData: {
      listingType: 'project',
      transactionProcessAlias: 'cgc-application/release-1',
      unitType: 'inquiry',
      priceNegotiable: true,
      contentNiche: ['beauty'],
      platforms: ['tiktok', 'ig-reels'],
      usageRights: 'paid-ads-6m',
      contentDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      requiresProduct: true,
      deliverables: [
        { id: 'd1', type: 'video', spec: '30s vertikal video (9:16) hook + demo + CTA', platform: 'tiktok', quantity: 1 },
      ],
      projectStatus: 'open',
    },
  },
  {
    title: 'Summer Skincare Routine UGC Reel & Raw Footage',
    description: 'High-energy summer skincare routine video featuring our SPF50 Hydrating Sunscreen. Includes main 45-second Reel plus 3 raw hook variations.',
    price: { amount: 60000, currency: 'USD' },
    publicData: {
      listingType: 'project',
      transactionProcessAlias: 'cgc-application/release-1',
      unitType: 'inquiry',
      priceNegotiable: true,
      contentNiche: ['beauty', 'lifestyle'],
      platforms: ['ig-reels'],
      usageRights: 'paid-ads-12m',
      contentDueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      requiresProduct: true,
      deliverables: [
        { id: 'd1', type: 'video', spec: '45s IG Reel + 3 Raw Hooks', platform: 'ig-reels', quantity: 1 },
      ],
      projectStatus: 'open',
    },
  },
];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const createOrGetUser = async ({ firstName, lastName, email, publicData, privateData }) => {
  const integrationSdk = getIntegrationSdk();

  // First check if user already exists via Integration SDK (bypass public SDK rate limits)
  try {
    const existingRes = await integrationSdk.users.query({ email });
    const existingUser = existingRes?.data?.data?.[0];
    if (existingUser) {
      console.log(`  [Existing Account] ${email} (${existingUser.id.uuid})`);
      try {
        await integrationSdk.users.approve({ id: existingUser.id });
        console.log(`  [Approved User]    ${email}`);
      } catch (approveErr) {}
      if (privateData) {
        await integrationSdk.users.updateProfile({
          id: existingUser.id,
          privateData,
        });
        console.log(`  [Updated Profile]  PrivateData updated for ${email}`);
      }
      return existingUser;
    }
  } catch (err) {
    // Continue to creation
  }

  // Create new user via Marketplace SDK
  const sdk = sharetribeSdk.createInstance({ clientId: CLIENT_ID, ...baseUrlMaybe });
  try {
    const res = await sdk.currentUser.create({
      email,
      password: DEMO_PASSWORD,
      firstName,
      lastName,
      publicData,
    });
    const user = res.data.data;
    console.log(`  [Created Account]  ${firstName} ${lastName} <${email}> (${user.id.uuid})`);

    try {
      await integrationSdk.users.approve({ id: user.id });
      console.log(`  [Approved User]    ${email}`);
    } catch (approveErr) {}

    if (privateData) {
      await integrationSdk.users.updateProfile({
        id: user.id,
        privateData,
      });
      console.log(`  [Updated Profile]  PrivateData added for ${email}`);
    }
    return user;
  } catch (e) {
    console.error(`  [FAILED Signup]    ${email}:`, e?.data?.errors || e.message);
    return null;
  }
};

const createProjectListing = async (authorUserId, projectData) => {
  const integrationSdk = getIntegrationSdk();
  try {
    const res = await integrationSdk.listings.create({
      authorId: authorUserId,
      title: projectData.title,
      description: projectData.description,
      price: projectData.price,
      state: 'published',
      publicData: projectData.publicData,
    });
    console.log(`  [Created Project]  "${projectData.title}" (${res.data.data.id.uuid})`);
  } catch (e) {
    console.error(`  [FAILED Project]   "${projectData.title}":`, JSON.stringify(e?.data?.errors, null, 2) || e.message);
  }
};

const run = async () => {
  console.log('=== CGC Network Demo Data Seeder ===\n');

  console.log('1. Seeding Brand Account...');
  const brandUser = await createOrGetUser(DEMO_BRAND);
  await wait(2000);

  console.log('\n2. Seeding Operator Account...');
  const operatorUser = await createOrGetUser(DEMO_OPERATOR);
  if (operatorUser) {
    console.log(`\n  👉 Add this UUID to your .env CGC_OPERATOR_USER_IDS: ${operatorUser.id.uuid}`);
  }
  await wait(2000);

  console.log('\n3. Seeding Creator Accounts...');
  for (const creator of DEMO_CREATORS) {
    await createOrGetUser(creator);
    await wait(2000);
  }

  if (brandUser) {
    console.log('\n4. Seeding Demo Projects...');
    for (const project of DEMO_PROJECTS) {
      await createProjectListing(brandUser.id, project);
      await wait(2000);
    }
  }

  console.log('\n=== Demo Seeding Completed Successfully! ===');
};

run();
