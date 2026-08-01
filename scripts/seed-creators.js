/**
 * Seeds a handful of test creator (provider) accounts so ExploreCreatorsPage
 * has real users to list. Each account goes through the same signup call the
 * app itself uses (sdk.currentUser.create), so this needs no special
 * credentials beyond the regular public Client ID — it does not touch the
 * Integration API.
 *
 * Usage: node scripts/seed-creators.js
 *
 * Profile photos are NOT seeded here (no real creator photos to use as
 * placeholders) — cards will fall back to the initial-letter avatar until
 * creators upload their own photo. See CreatorThumbnail in
 * src/containers/ExploreCreatorsPage/ExploreCreatorsPage.js.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../server/env').configureEnv();

const sharetribeSdk = require('sharetribe-flex-sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const baseUrlMaybe = BASE_URL ? { baseUrl: BASE_URL } : {};

if (!CLIENT_ID) {
  console.error('Missing REACT_APP_SHARETRIBE_SDK_CLIENT_ID — check your .env file.');
  process.exit(1);
}

// Edit this list to add/remove seed creators. Emails must be unique per
// marketplace; re-running the script skips ones that already exist.
const SEED_CREATORS = [
  { firstName: 'Claire', lastName: 'K.', email: 'seed.creator.claire@example.com' },
  { firstName: 'Liz', lastName: 'Q.', email: 'seed.creator.liz@example.com' },
  { firstName: 'Nneoma', lastName: 'P.', email: 'seed.creator.nneoma@example.com' },
  { firstName: 'Lesley', lastName: 'G.', email: 'seed.creator.lesley@example.com' },
  { firstName: 'Tyler', lastName: 'D.', email: 'seed.creator.tyler@example.com' },
  { firstName: 'Phil', lastName: 'T.', email: 'seed.creator.phil@example.com' },
  { firstName: 'Savannah', lastName: 'B.', email: 'seed.creator.savannah@example.com' },
  { firstName: 'Holly', lastName: 'N.', email: 'seed.creator.holly@example.com' },
  { firstName: 'Joshua', lastName: 'D.', email: 'seed.creator.joshua@example.com' },
  { firstName: 'Brady', lastName: 'E.', email: 'seed.creator.brady@example.com' },
  { firstName: 'Alyssa', lastName: 'R.', email: 'seed.creator.alyssa@example.com' },
  { firstName: 'Nyssa', lastName: 'P.', email: 'seed.creator.nyssa@example.com' },
  { firstName: 'Chris', lastName: 'P.', email: 'seed.creator.chris@example.com' },
  { firstName: 'Nicole', lastName: 'B.', email: 'seed.creator.nicole@example.com' },
  { firstName: 'Marcus', lastName: 'H.', email: 'seed.creator.marcus@example.com' },
  { firstName: 'Priya', lastName: 'S.', email: 'seed.creator.priya@example.com' },
  { firstName: 'Diego', lastName: 'M.', email: 'seed.creator.diego@example.com' },
  { firstName: 'Emma', lastName: 'W.', email: 'seed.creator.emma@example.com' },
  { firstName: 'Jamal', lastName: 'F.', email: 'seed.creator.jamal@example.com' },
  { firstName: 'Sofia', lastName: 'C.', email: 'seed.creator.sofia@example.com' },
  { firstName: 'Ryan', lastName: 'K.', email: 'seed.creator.ryan@example.com' },
  { firstName: 'Aaliyah', lastName: 'J.', email: 'seed.creator.aaliyah@example.com' },
  { firstName: 'Owen', lastName: 'T.', email: 'seed.creator.owen@example.com' },
  { firstName: 'Mei', lastName: 'L.', email: 'seed.creator.mei@example.com' },
  { firstName: 'Gabriel', lastName: 'A.', email: 'seed.creator.gabriel@example.com' },
];

const SEED_PASSWORD = 'SeedCreator123!';

const createOneCreator = ({ firstName, lastName, email }) => {
  // Each signup is its own anonymous session, same as a real browser signup.
  const sdk = sharetribeSdk.createInstance({
    clientId: CLIENT_ID,
    ...baseUrlMaybe,
  });

  return sdk.currentUser
    .create({
      email,
      password: SEED_PASSWORD,
      firstName,
      lastName,
      publicData: { userType: 'provider' },
    })
    .then(() => {
      console.log(`  created  ${firstName} ${lastName} <${email}>`);
      return false;
    })
    .catch(e => {
      const errorCode = e?.data?.errors?.[0]?.code;
      if (errorCode === 'email-taken') {
        console.log(`  skipped  ${email} (already exists)`);
        return false;
      } else if (errorCode === 'too-many-requests') {
        console.log(`  rate-limited  ${email} (will retry)`);
        return true;
      } else {
        console.error(`  FAILED   ${email}:`, e?.data?.errors || e.message);
        return false;
      }
    });
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Signup is rate-limited per marketplace — space requests out and retry
// once (with a longer pause) if a batch still trips the limit.
const DELAY_MS = 4000;
const RETRY_DELAY_MS = 60000;

const run = async () => {
  console.log(`Seeding ${SEED_CREATORS.length} creator account(s)...`);
  const rateLimited = [];

  for (const creator of SEED_CREATORS) {
    const hitRateLimit = await createOneCreator(creator);
    if (hitRateLimit) rateLimited.push(creator);
    await wait(DELAY_MS);
  }

  if (rateLimited.length > 0) {
    console.log(`\n${rateLimited.length} hit the rate limit — waiting and retrying once...`);
    await wait(RETRY_DELAY_MS);
    for (const creator of rateLimited) {
      await createOneCreator(creator);
      await wait(DELAY_MS);
    }
  }

  console.log('Done.');
};

run();
