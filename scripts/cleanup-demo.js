/**
 * Closes leftover test listings so the marketplace is presentable in a demo.
 *
 * Months of manual testing left listings titled "asd", "test", "tes" sitting in
 * /projects right next to real briefs, plus listings on two listing types that
 * no longer exist in configListing.js (sell-services, project-brief). A client
 * browsing the marketplace sees all of them.
 *
 * Closing rather than deleting is deliberate: the Integration API has no listing
 * delete, and closed listings drop out of search while staying inspectable if we
 * ever need to check what the old data looked like.
 *
 * User accounts are left alone. The leftover seed accounts are userType
 * "provider", and server/api/list-creators.js only surfaces userType "creator",
 * so they are already invisible to the app — seed-demo.js promotes the ones we
 * actually want rather than this script deleting anything.
 *
 * Usage:
 *   node scripts/cleanup-demo.js           # dry run, prints what it would close
 *   node scripts/cleanup-demo.js --apply   # actually closes them
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('../server/env').configureEnv();

const { getIntegrationSdk } = require('../server/api-util/integrationSdk');

const APPLY = process.argv.includes('--apply');

// Listing types that predate the current configListing.js and can never render
// correctly again.
const STALE_LISTING_TYPES = ['sell-services', 'project-brief'];

// Titles that are obviously scratch data. Matched case-insensitively against the
// whole trimmed title, never as a substring — a real brief could legitimately
// contain the word "test".
const JUNK_TITLES = ['asd', 'asdf', 'test', 'tes', 'test 2', 'all', 'qwe', '123'];

// Listings written by the first, broken seeding round. They carry
// `platforms: ['ig-reels']`, which is not one of the enum options in
// src/config/configListing.js — unknown enum values match no search filter and
// render without a label. seed-demo.js now writes the same campaigns with
// correct values under different titles, so these are duplicates too.
const SUPERSEDED_TITLES = [
  'glowup botanical face serum - 30s tiktok ugc video',
  'summer skincare routine ugc reel & raw footage',
];

const PER_PAGE = 100;

const fetchAllListings = async sdk => {
  const out = [];
  let page = 1;
  while (page <= 50) {
    // include: ['author'] is required for relationships.author to be populated
    // at all on the Integration API — without it every listing comes back with
    // empty relationships and the stray-creator check matches nobody.
    const res = await sdk.listings.query({ page, perPage: PER_PAGE, include: ['author'] });
    out.push(...(res?.data?.data || []));
    const meta = res?.data?.meta || {};
    if (!meta.totalPages || page >= meta.totalPages) break;
    page += 1;
  }
  return out;
};

const reasonToClose = listing => {
  const attrs = listing.attributes || {};
  const title = (attrs.title || '').trim().toLowerCase();
  const type = attrs.publicData?.listingType;

  if (STALE_LISTING_TYPES.includes(type)) {
    return `stale listing type "${type}"`;
  }
  if (JUNK_TITLES.includes(title)) {
    return `scratch title "${attrs.title}"`;
  }
  if (SUPERSEDED_TITLES.includes(title)) {
    return 'superseded by the corrected seed round';
  }
  return null;
};

/**
 * Accounts left as userType "creator" with no published creator-profile listing
 * show up in /creators as a card with no package, no tags and a dead "Collab"
 * button. Demoting the seed leftovers to "provider" drops them out of
 * server/api/list-creators.js without deleting anything.
 *
 * Only @example.com addresses are touched — those came from seed-creators.js.
 * Real accounts are reported instead, because deciding what to do with someone's
 * own test login is not this script's call.
 */
const reviewStrayCreators = async (sdk, listings) => {
  const res = await sdk.users.query({ perPage: 100 });
  const users = res?.data?.data || [];

  const authorsWithProfile = new Set(
    listings
      .filter(
        l =>
          l.attributes?.publicData?.listingType === 'creator-profile' &&
          l.attributes?.state === 'published'
      )
      .map(l => l.relationships?.author?.data?.id?.uuid)
      .filter(Boolean)
  );

  const strays = users.filter(
    u =>
      u.attributes?.profile?.publicData?.userType === 'creator' &&
      !authorsWithProfile.has(u.id.uuid)
  );

  if (strays.length === 0) return [];

  console.log(`\n${strays.length} creator account(s) with no published profile listing:`);
  const demotable = [];
  for (const user of strays) {
    const email = user.attributes?.email || '';
    const isSeedLeftover = email.endsWith('@example.com');
    console.log(
      `  ${user.id.uuid}  ${(user.attributes?.profile?.displayName || '?').padEnd(16)}  ` +
        `${email || '(email hidden)'}  ${isSeedLeftover ? '-> demote' : '-> left alone, yours'}`
    );
    if (isSeedLeftover) demotable.push(user);
  }
  return demotable;
};

const run = async () => {
  const sdk = getIntegrationSdk();
  const listings = await fetchAllListings(sdk);

  // Drafts are skipped alongside already-closed listings: Sharetribe rejects
  // closing a draft ("listing-invalid-state"), and a draft is never public
  // anyway, so there is nothing to hide.
  const invisibleStates = ['closed', 'draft'];
  const candidates = listings
    .map(listing => ({ listing, reason: reasonToClose(listing) }))
    .filter(({ listing, reason }) => reason && !invisibleStates.includes(listing.attributes?.state));

  console.log(`Scanned ${listings.length} listings.`);

  if (candidates.length === 0) {
    console.log('No listings to close.');
  } else {
    console.log(`\n${candidates.length} listing(s) to close:\n`);
    candidates.forEach(({ listing, reason }) => {
      console.log(
        `  ${listing.id.uuid}  ${(listing.attributes.state || '-').padEnd(9)}  ` +
          `${JSON.stringify(listing.attributes.title || '')}  — ${reason}`
      );
    });
  }

  const demotable = await reviewStrayCreators(sdk, listings);

  if (candidates.length === 0 && demotable.length === 0) {
    console.log('\nMarketplace is already clean.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to make these changes.');
    return;
  }

  let changed = 0;
  let failed = 0;

  if (candidates.length > 0) {
    console.log('\nClosing listings...');
    for (const { listing } of candidates) {
      try {
        await sdk.listings.close({ id: listing.id });
        console.log(`  closed ${listing.id.uuid}`);
        changed += 1;
      } catch (e) {
        // Surfaced, never swallowed — a silent failure here is what let the
        // previous seeding round look successful while doing nothing.
        const errors = e?.data?.errors ? JSON.stringify(e.data.errors) : e.message;
        console.error(`  FAILED ${listing.id.uuid}: ${errors}`);
        failed += 1;
      }
    }
  }

  if (demotable.length > 0) {
    console.log('\nDemoting stray creator accounts...');
    for (const user of demotable) {
      try {
        await sdk.users.updateProfile({
          id: user.id,
          publicData: { userType: 'provider' },
          // Clear the brand-shaped keys the first broken seeder wrote onto
          // creator accounts. Sharetribe deletes a key set to null.
          privateData: { accessRequest: null, subscription: null },
        });
        console.log(`  demoted ${user.id.uuid}`);
        changed += 1;
      } catch (e) {
        const errors = e?.data?.errors ? JSON.stringify(e.data.errors) : e.message;
        console.error(`  FAILED ${user.id.uuid}: ${errors}`);
        failed += 1;
      }
    }
  }

  console.log(`\nDone. ${changed} change(s), ${failed} failure(s).`);
  if (failed > 0) process.exitCode = 1;
};

run().catch(e => {
  console.error('Cleanup failed:', e?.data?.errors ? JSON.stringify(e.data.errors, null, 2) : e);
  process.exit(1);
});
