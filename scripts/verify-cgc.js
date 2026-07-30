// Cross-check process.edn <-> JS mirror <-> en.json for cgc-ugc-approval.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const edn = fs.readFileSync(
  path.join(root, 'ext/transaction-processes/cgc-ugc-approval/process.edn'),
  'utf8'
);
const js = fs.readFileSync(path.join(root, 'src/transactions/transactionProcessCGCUGC.js'), 'utf8');
const stateData = fs.readFileSync(
  path.join(root, 'src/containers/TransactionPage/TransactionPage.stateDataCGCUGC.js'),
  'utf8'
);
const tr = JSON.parse(fs.readFileSync(path.join(root, 'src/translations/en.json'), 'utf8'));

let fail = 0;
const err = m => {
  console.log('  FAIL ' + m);
  fail++;
};

// --- 1. transitions declared in the edn :transitions vector
const transitionsSection = edn.slice(edn.indexOf(':transitions'), edn.indexOf(':notifications'));
const ednTransitions = new Set(
  [...transitionsSection.matchAll(/:name :transition\/([a-z0-9-]+)/g)].map(m => m[1])
);
const jsTransitions = new Set(
  [...js.matchAll(/'transition\/([a-z0-9-]+)'/g)].map(m => m[1])
);

console.log(`\n[1] edn transitions: ${ednTransitions.size}, js transitions: ${jsTransitions.size}`);
for (const t of ednTransitions) {
  if (!jsTransitions.has(t)) err(`transition "${t}" in process.edn but missing from JS mirror`);
}
for (const t of jsTransitions) {
  if (!ednTransitions.has(t)) err(`transition "${t}" in JS mirror but MISSING from process.edn`);
}

// --- 2. states referenced by :from/:to must be reachable in the JS graph
const ednStates = new Set(
  [...transitionsSection.matchAll(/:(?:from|to) :state\/([a-z0-9-]+)/g)].map(m => m[1])
);
const jsStates = new Set([...js.matchAll(/^  [A-Z_0-9]+: '([a-z0-9-]+)',$/gm)].map(m => m[1]));
console.log(`[2] edn states: ${ednStates.size}, js states: ${jsStates.size}`);
for (const s of ednStates) {
  if (!jsStates.has(s)) err(`state "${s}" used in process.edn but missing from JS states`);
}

// --- 3. every non-terminal state must have an exit (no funds locked forever)
const terminal = new Set(['payment-expired', 'canceled', 'reviewed']);
const froms = new Set([...transitionsSection.matchAll(/:from :state\/([a-z0-9-]+)/g)].map(m => m[1]));
console.log('[3] checking every non-terminal state has an exit transition');
for (const s of ednStates) {
  if (!terminal.has(s) && !froms.has(s)) err(`state "${s}" has NO outgoing transition (dead end)`);
}

// --- 4. notification templates must exist on disk
const notifSection = edn.slice(edn.indexOf(':notifications'));
const templates = new Set([...notifSection.matchAll(/:template :([a-z0-9-]+)/g)].map(m => m[1]));
const tplDir = path.join(root, 'ext/transaction-processes/cgc-ugc-approval/templates');
console.log(`[4] notification templates referenced: ${templates.size}`);
const missingTpl = [];
for (const t of templates) {
  const subj = path.join(tplDir, t, `${t}-subject.txt`);
  const html = path.join(tplDir, t, `${t}-html.html`);
  if (!fs.existsSync(subj) || !fs.existsSync(html)) missingTpl.push(t);
}
if (missingTpl.length) {
  console.log(`  PENDING ${missingTpl.length} template dirs not created yet:`);
  missingTpl.forEach(t => console.log(`    - ${t}`));
}

// --- 5. every transition used as an action button must have translations
const usedInButtons = [
  ...stateData.matchAll(/actionButtonProps\(\s*transitions\.([A-Z_0-9]+),\s*([A-Z]+)/g),
].map(m => ({ key: m[1], role: m[2] }));
// Guard against the regex silently drifting out of sync with the source.
const expectedButtons = (stateData.match(/actionButtonProps\(/g) || []).length;
if (usedInButtons.length !== expectedButtons) {
  err(
    `only parsed ${usedInButtons.length} of ${expectedButtons} actionButtonProps calls — fix the regex`
  );
}
const roleMap = { CUSTOMER: 'customer', PROVIDER: 'provider' };
console.log(`[5] action buttons wired: ${usedInButtons.length}`);
for (const { key, role } of usedInButtons) {
  const m = js.match(new RegExp(`^  ${key}: 'transition/([a-z0-9-]+)',$`, 'm'));
  if (!m) {
    err(`stateData references transitions.${key} which is not defined in the JS mirror`);
    continue;
  }
  const name = m[1];
  for (const suffix of ['actionButton', 'actionError']) {
    const id = `TransactionPage.cgc-ugc-approval.${roleMap[role]}.transition-${name}.${suffix}`;
    if (!tr[id]) err(`missing translation: ${id}`);
  }
}

// --- 6. every state needs a panel title for both roles
console.log('[6] checking panel titles for every state x role');
for (const s of jsStates) {
  for (const role of ['customer', 'provider']) {
    const id = `TransactionPage.cgc-ugc-approval.${role}.${s}.title`;
    if (!tr[id]) err(`missing translation: ${id}`);
  }
}

// --- 7. transitionMessages translationIds must resolve
const msgIds = new Set(
  [...stateData.matchAll(/translationId: `\$\{tr\}\.([a-z0-9-]+)`/g)].map(m => m[1])
);
console.log(`[7] transitionMessages ids: ${msgIds.size}`);
for (const id of msgIds) {
  const full = `TransactionPage.ActivityFeed.cgc-ugc-approval.transition.${id}`;
  if (!tr[full]) err(`missing translation: ${full}`);
}

// --- 8. ActivityFeed state fallback messages
console.log('[8] checking ActivityFeed state messages');
for (const s of jsStates) {
  // States only reachable via transitions that are not in isRelevantPastTransition
  // are never rendered in the feed, so they need no message.
  if (['initial', 'inquiry', 'pending-payment', 'payment-expired'].includes(s)) continue;
  const id = `TransactionPage.ActivityFeed.cgc-ugc-approval.${s}`;
  if (!tr[id]) err(`missing translation: ${id}`);
}

// --- 9. CGCActionModal variants: every field needs label/placeholder (+required)
const modal = fs.readFileSync(
  path.join(root, 'src/containers/TransactionPage/CGCActionModal/CGCActionModal.js'),
  'utf8'
);
const variantBlocks = [...modal.matchAll(/^  (\w+): \{\n\s+icon:[\s\S]*?\n  \},$/gm)];
console.log(`[9] modal variants: ${variantBlocks.length}`);
for (const [block, variant] of variantBlocks) {
  for (const key of ['title', 'description', 'submit']) {
    const id = `CGCActionModal.${variant}.${key}`;
    if (!tr[id]) err(`missing translation: ${id}`);
  }
  const fields = [...block.matchAll(/\{ name: '(\w+)', type: '(\w+)', required: (true|false) \}/g)];
  if (!fields.length) err(`variant "${variant}" declares no fields`);
  for (const [, name, , req] of fields) {
    for (const suffix of ['Label', 'Placeholder']) {
      const id = `CGCActionModal.${variant}.${name}${suffix}`;
      if (!tr[id]) err(`missing translation: ${id}`);
    }
    if (req === 'true' && !tr[`CGCActionModal.${variant}.${name}Required`]) {
      err(`missing translation: CGCActionModal.${variant}.${name}Required`);
    }
  }
}
for (const id of ['CGCActionModal.close', 'CGCActionModal.submitFailed', 'CGCActionModal.tooLong']) {
  if (!tr[id]) err(`missing translation: ${id}`);
}

// --- 10. Every modal variant must be reachable from stateData, and each
//         *Transition key it needs must be supplied.
const variantNames = variantBlocks.map(m => m[1]);
const keyForVariant = {
  addShippingAddress: 'addShippingAddressTransition',
  shipping: 'shippingTransition',
  submitContent: 'contentSubmitTransition',
  requestRevision: 'revisionTransition',
};
console.log('[10] checking modal variants are wired from stateData');
for (const v of variantNames) {
  if (!stateData.includes(`openModal('${v}')`)) {
    err(`modal variant "${v}" is never opened from stateData`);
  }
  const k = keyForVariant[v];
  if (!k) {
    err(`no stateData transition key mapped for modal variant "${v}"`);
  } else if (!stateData.includes(`${k}:`)) {
    err(`stateData never sets "${k}", so the "${v}" modal cannot fire a transition`);
  }
}
// Any state that opens a modal must also set the matching transition key.
const condBlocks = [...stateData.matchAll(/\.cond\(\[([^\]]+)\], \(\) => \{([\s\S]*?)\n    \}\)/g)];
for (const [, head, body] of condBlocks) {
  for (const v of variantNames) {
    if (body.includes(`openModal('${v}')`) && !body.includes(`${keyForVariant[v]}:`)) {
      err(`state [${head.trim()}] opens the "${v}" modal but does not set ${keyForVariant[v]}`);
    }
  }
}

// --- 11. CollaborationDetailsMaybe translations
const details = fs.readFileSync(
  path.join(root, 'src/containers/TransactionPage/TransactionPanel/CollaborationDetailsMaybe.js'),
  'utf8'
);
const detailIds = new Set(
  [...details.matchAll(/['"](CollaborationDetails\.[A-Za-z0-9]+)['"]/g)].map(m => m[1])
);
console.log(`[11] CollaborationDetails ids: ${detailIds.size}`);
for (const id of detailIds) {
  if (!tr[id]) err(`missing translation: ${id}`);
}

// --- 12. InboxPage status label for every state (except 'initial', which is
//         never shown in the inbox — no transition has fired yet)
console.log('[12] checking InboxPage status label exists for every state');
for (const s of jsStates) {
  if (s === 'initial') continue;
  const id = `InboxPage.cgc-ugc-approval.${s}.status`;
  if (!tr[id]) err(`missing translation: ${id}`);
}

console.log(fail === 0 ? '\nAll consistency checks passed.' : `\n${fail} problem(s) found.`);
process.exit(fail === 0 ? 0 : 1);
