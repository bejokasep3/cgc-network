const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
// Normalise line endings so the structural regexes below don't depend on CRLF.
const read = p => fs.readFileSync(root + p, 'utf8').replace(/\r\n/g, '\n');
const t = JSON.parse(read('/src/translations/en.json'));
const page = read('/src/containers/SubscriptionPage/SubscriptionPage.js');

let fail = 0;
const err = m => {
  console.log('  FAIL ' + m);
  fail++;
};

// Plain string ids: id="X" or id={'X'} or id={cond ? 'X' : 'Y'}
const ids = new Set(
  [...page.matchAll(/['\"](SubscriptionPage\.[A-Za-z0-9]+)['\"]/g)].map(m => m[1])
);
// Template-literal ids: `SubscriptionPage.benefit${i + 1}` -> expand over the loop bound
const benefitCount = Number(page.match(/PLAN_BENEFIT_COUNT = (\d+)/)?.[1] || 0);
for (let i = 1; i <= benefitCount; i++) {
  ids.add(`SubscriptionPage.benefit${i}`);
}
if (!benefitCount) err('could not read PLAN_BENEFIT_COUNT');

console.log(`SubscriptionPage ids referenced: ${ids.size} (benefits: ${benefitCount})`);
for (const id of ids) {
  if (!t[id]) err(`missing translation: ${id}`);
}

// Orphan check: keys defined but never referenced (catches typos in either direction)
const defined = Object.keys(t).filter(k => k.startsWith('SubscriptionPage.'));
const orphans = defined.filter(k => !ids.has(k));
if (orphans.length) {
  console.log(`  NOTE ${orphans.length} defined-but-unreferenced: ${orphans.join(', ')}`);
}

// util/subscription.js sanity: the reasons it returns should be handled somewhere
const util = read('/src/util/subscription.js');
for (const reason of ['paymentFailed', 'noSubscription']) {
  if (!util.includes(`'${reason}'`)) err(`util/subscription.js no longer returns '${reason}'`);
}

// The duck must be registered in the root reducer, or state.brandSubscription is undefined
const ducksIndex = read('/src/ducks/index.js');
if (!/import brandSubscription from '\.\/brandSubscription\.duck'/.test(ducksIndex)) {
  err('brandSubscription duck is not imported in ducks/index.js');
}
if (!/^\s*brandSubscription,$/m.test(ducksIndex)) {
  err('brandSubscription is not exported from ducks/index.js');
}
if (!page.includes('state.brandSubscription')) err('page does not read state.brandSubscription');

// Route must exist, and the server redirect URLs must point at it
const routes = read('/src/routing/routeConfiguration.js');
const routePath = routes.match(/path: '([^']+)',\n\s+name: 'SubscriptionPage'/)?.[1];
if (!routePath) err('SubscriptionPage route is not registered');
const server = read('/server/api/subscription.js');
for (const key of ['success_url', 'cancel_url', 'return_url']) {
  const url = server.match(new RegExp(`${key}: \`\\$\\{[a-zA-Z()]+\\}([^\`?]*)`))?.[1];
  if (url === undefined) {
    err(`could not parse ${key} in server/api/subscription.js`);
  } else if (routePath && url !== routePath) {
    err(`${key} points at "${url}" but the route is "${routePath}"`);
  }
}

// Every endpoint the client calls must be registered in apiRouter
const api = read('/src/util/api.js');
const router = read('/server/apiRouter.js');
const called = [...api.matchAll(/'(\/api\/subscription\/[a-z-]+)'/g)].map(m => m[1]);
console.log(`client subscription endpoints: ${called.length}`);
for (const path of called) {
  const routerPath = path.replace('/api', '');
  if (!router.includes(`'${routerPath}'`)) {
    err(`client calls ${path} but apiRouter has no route for '${routerPath}'`);
  }
}
for (const handler of ['subscriptionStatus', 'createCheckoutSession', 'createBillingPortalSession']) {
  if (!server.includes(`module.exports`) || !new RegExp(`\\b${handler}\\b`).test(server)) {
    err(`server/api/subscription.js does not define ${handler}`);
  }
  if (!router.includes(handler)) err(`apiRouter does not wire ${handler}`);
}

console.log(fail === 0 ? '\nSubscription wiring checks passed.' : `\n${fail} problem(s) found.`);
process.exit(fail === 0 ? 0 : 1);
