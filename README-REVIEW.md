# The CGC Network — catatan untuk review

**Untuk:** senior dev yang akan menilai kelayakan project ini sebelum ditawarkan
ke client.

**Konteks singkat:** ini base project Sharetribe (`web-template` v12.1.0) yang
di-custom jadi marketplace UGC bernama "The CGC Network" — brand menyewa
content creator yang sudah divetting untuk bikin konten, lewat alur booking →
kirim produk (kalau perlu) → submit konten → revisi (maks 2x) → approve →
pembayaran cair → review dua arah. Brand berlangganan bulanan untuk akses.

Semua requirement asli dari client ada di riwayat chat (lihat lampiran/screenshot
yang sudah dikirim terpisah). Dokumen ini fokus ke apa yang sudah dikerjakan dan
apa yang masih perlu dicek.

---

## 1. Yang sudah dikerjakan (kode)

Base-nya Sharetribe web-template — sudah dijelaskan di [README.md](README.md).
Semua kustomisasi CGC ada di 2 commit:

- `77b5583d5` — implementasi 6 fase (proses transaksi custom, StageTracker,
  CreatorCard, halaman langganan/roster, gating subscription, dll)
- `da5d0628e` — bersih-bersih terakhir (hapus workaround nama lama)

Rencana kerja lengkapnya ada di [CGC-FRONTEND-PLAN.md](CGC-FRONTEND-PLAN.md) —
dibagi 7 fase (Phase 0–6), masing-masing dengan alasan kenapa dan file mana yang
disentuh. Kalau mau cek detail keputusan desain/arsitektur, itu tempatnya, bukan
saya ulang di sini.

Ringkasan per area:

| Area | Yang berubah |
|---|---|
| **Transaction process** | Proses custom `cgc-ugc-approval` (18 state, di `ext/transaction-processes/cgc-ugc-approval/process.edn`) — booking → shipping → submit → revisi (maks 2x) → approve → payout → review. Belum di-push ke marketplace manapun (lihat §3). |
| **Design tokens** | `src/styles/marketplaceDefaults.css` — border radius, shadow ramp, type scale ditata ulang. Tidak ada hex/spacing hardcode di komponen. |
| **Transaction page** | `StageTracker` (progress bar 5 tahap), `ApprovalDecisionPanel`, `CollaborationDetailsMaybe` (deliverables + revision timeline) — baru. |
| **Creator directory** | `CreatorCard` (component baru, portfolio-first), dipakai di `SearchResultsPanel` khusus listing type `creator-profile`. |
| **Subscription** | `SubscriptionPage`, `brandSubscription.duck.js`, `server/api/subscription.js` — thin layer di atas Stripe Billing. Gate dipasang di 3 titik: posting brief, inquiry, checkout. |
| **Roster** | `RosterPage` — brand simpan creator favorit, disimpan di `privateData` profil brand (tidak butuh endpoint baru). |
| **Copy** | Semua string lewat `react-intl` → `src/translations/en.json`, tidak ada hardcode. |

**Bug arsitektural yang sempat ditemukan dan diperbaiki:** arah pengiriman
barang. Sharetribe defaultnya provider→customer (penjual kirim ke pembeli), tapi
di CGC ini terbalik — brand (pembeli) yang kirim produk ke creator (penjual).
Detail lengkap dan fix-nya ada di CGC-FRONTEND-PLAN.md §1.3 — ini yang paling
penting untuk direview karena kalau salah, alamat yang salah bisa kekirim ke
pihak yang salah.

---

## 2. Cara jalanin & ngetes lokal

```bash
yarn install
yarn run config          # generate .env dari template kalau belum ada
yarn run dev              # localhost:3000
```

Verifikasi yang wajib jalan sebelum anggap "beres" (sudah saya jalankan semua,
status pass):

```bash
yarn verify-cgc            # cross-check process.edn <-> translations <-> UI wiring
npx jest --runInBand        # 69 suite / 1070 test — pakai --runInBand, paralel suka timeout di LandingPage
yarn build-web              # production build, harus tanpa error
```

`scripts/verify-cgc.js` dan `scripts/verify-cgc-subscription.js` itu custom
script yang saya/AI buat khusus project ini — mengecek konsistensi antara
`process.edn`, state data, translation keys, dan komponen UI, supaya kalau ada
state baru tapi lupa nambahin label/copy, ketahuan otomatis. Kalau nambah fitur
baru yang punya state/role sendiri, script ini juga harus di-extend (dijelaskan
di plan §Non-negotiable ground rules poin 7).

---

## 3. Yang BELUM bisa dites — jangan dianggap gagal kalau belum jalan

Ini bagian paling penting buat direview: banyak hal di Sharetribe **cuma bisa
diatur di Console** (dashboard hosted Sharetribe), bukan di kode, dan sengaja
tidak bisa di-otomasi (dikonfirmasi tidak ada API/CLI untuk branding, Pages,
listing types, search config).

Semua langkah manual itu didokumentasikan di dua file:

- [CGC-SETUP.md](CGC-SETUP.md) — push transaction process (`flex-cli`), bikin
  listing types (`creator-profile`, `project-brief`), listing fields, access
  control (invite-only), env var Stripe.
- [CGC-CONSOLE-LANDING.md](CGC-CONSOLE-LANDING.md) — konten landing page,
  branding (logo, warna), search config. Sudah termasuk copy siap-pakai per
  section, tinggal paste ke Console.

Status saat ini: nama marketplace sudah diganti ke "The CGC Network" di
Console, tapi listing types, transaction process push, dan sebagian besar
konten landing page **masih belum dikerjakan client-side saya** (saya = junior
dev yang minta review ini). Jadi kalau buka demo sekarang dan:

- Landing page masih generic / warna default → belum branding di Console
- Search creator kosong → listing type & listing belum dibuat
- Checkout/subscribe error → `STRIPE_SECRET_KEY`,
  `STRIPE_BRAND_SUBSCRIPTION_PRICE_ID`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`
  belum diisi
- Transaksi error saat dibuka → proses `cgc-ugc-approval` belum di-push /
  alias `release-1` belum dibuat

...itu semua expected, bukan bug kode. Checklist "what cannot be verified
locally" lengkapnya ada di ujung CGC-FRONTEND-PLAN.md.

**Yang justru perlu direview seriusnya:** apakah pendekatan teknisnya (custom
transaction process, cara gating subscription, cara nyimpen roster di
`privateData`, fix arah shipping) itu solid secara arsitektur — bukan cuma
"apakah tombolnya sudah muncul", karena banyak bagian belum bisa diklik sampai
Console-nya diisi.

---

## 4. Hal spesifik yang saya minta tolong dicek

1. **Self-transition di process.edn** (`provider-add-shipping-address`) — lokal
   `flex-cli process --path ...` (tanpa login) menerima syntax ini, tapi belum
   pernah dicoba `flex-cli process push` ke marketplace beneran. Kalau ditolak,
   ada fallback yang sudah didokumentasikan di plan §1.3.
2. Apakah pola gating subscription (`src/util/subscription.js`, redirect ke
   `/subscription`, dispatch `fetchBrandSubscription()` saat app load) sudah
   sesuai standar yang biasa dipakai — saya belum pernah bikin flow subscription
   di atas Sharetribe sebelumnya.
3. Apakah pemisahan dua listing type (`creator-profile` dibuat creator supaya
   uang mengalir ke creator, `project-brief` gratis dibuat brand lewat
   `default-inquiry`) itu pendekatan yang wajar, atau ada cara Sharetribe yang
   lebih baku untuk kasus "uang harus ke pihak B padahal yang posting pihak A".

---

## 5. Kalau mau lihat demo hidup

Belum ada deploy publik — masih localhost, karena Console config di §3 belum
lengkap. Rencana: begitu listing type + branding + Stripe test key beres,
deploy ke Heroku/host lain (sudah didukung template aslinya, lihat
[README.md](README.md) bagian Deploying) supaya ada link demo sebelum
ditawarkan ke client.
