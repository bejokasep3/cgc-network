# IMPLEMENTATION PLAN — The CGC Network

> **Untuk agen/dev yang mengeksekusi.** Dokumen ini menerjemahkan
> [BLUEPRINT.md](BLUEPRINT.md) menjadi tugas-tugas berurutan. Baca BLUEPRINT.md
> sampai habis sebelum menyentuh kode — di sana ada *kenapa*-nya; di sini hanya
> *apa* dan *bagaimana*.
>
> Versi 1.0 · 1 Agustus 2026 · disusun terhadap kondisi repo di commit `40c45a25d`.

---

## 0. Aturan main untuk yang mengeksekusi

### 0.1 Urutan itu mengikat

Fase dikerjakan **berurutan**. F1 dan F2 adalah fondasi — semua fase lain
berasumsi keduanya sudah jadi. Jangan meloncat ke fase yang kelihatan lebih
mudah.

Di dalam satu fase, tugas boleh dikerjakan paralel **kecuali** ada catatan
"tergantung pada".

### 0.2 Protokol per tugas

1. Baca bagian **Kontrak data** (§2) sebelum menulis kode yang menyentuh
   `publicData` / `protectedData` / `metadata`. Bentuk data di sana adalah
   satu-satunya sumber kebenaran; jangan mengarang field baru.
2. Kerjakan satu tugas sampai kriteria **Selesai bila** terpenuhi.
3. Jalankan verifikasi (§0.5).
4. Commit per tugas dengan pesan `[F<fase>.<tugas>] <ringkas>`.

### 0.3 Larangan keras

- **Jangan hardcode warna, font, atau spacing.** Pakai custom property di
  `src/styles/marketplaceDefaults.css`. Branding ditimpa Console saat runtime,
  jadi hex yang di-hardcode akan menyimpang diam-diam.
- **Jangan hardcode teks yang dilihat pengguna.** Semua lewat `react-intl` ke
  `src/translations/en.json`, urut alfabetis.
- **Jangan menyentuh `process.edn` tanpa izin eksplisit user.** Perubahan proses
  butuh push versi baru + update alias, dan itu keputusan operasional. Kalau
  sebuah tugas butuh transisi baru, hentikan dan minta konfirmasi.
- **Jangan merestrukturisasi komponen yang dipakai lintas proses.**
  `TransactionPanel`, `ListingCard`, `OrderPanel`, `InboxPage`, `ActivityFeed`
  juga melayani `default-purchase`, `default-booking`, `default-inquiry`,
  `default-negotiation`, `default-download`. Gate perilaku CGC dengan
  `processName === CGC_UGC_PROCESS_NAME`, seperti yang sudah dilakukan
  `CollaborationDetailsMaybe.js`.
- **Jangan memuat data dengan `useEffect`.** Pakai `loadData` di
  `<Page>.duck.js`, didaftarkan di `pageDataLoadingAPI.js` dan
  `routeConfiguration.js`. Ini penting untuk SSR.
- **Jangan menambah dependency baru tanpa bertanya.** Repo ini sengaja memakai
  utilitas lokal di `src/util/`.
- **Jangan pernah mempercayai harga dari klien.** Lihat §2.6 — ini invarian
  keamanan paling penting di seluruh proyek.

### 0.4 Bahasa di layar

Istilah mesin tidak boleh bocor ke UI (BLUEPRINT `D7`). Pemetaannya:

| Jangan tulis | Tulis |
|---|---|
| listing | project / creator profile |
| order, transaction | collaboration |
| inquiry | invitation / conversation |
| offer (dalam arti listing) | proposal |
| provider / customer | creator / brand |

### 0.5 Verifikasi

Setelah **setiap tugas**:

```bash
npx jest --runInBand <path/tes/terkait>
```

Setelah **setiap fase**, ketiganya harus hijau:

```bash
yarn verify-cgc && npx jest --runInBand && yarn build-web
```

`yarn verify-cgc` menjaga konsistensi `process.edn` ↔ mirror JS ↔ translations ↔
UI. Kalau menambah state/role/surface baru, **skrip ini ikut diperluas**
(`scripts/verify-cgc.js`), bukan dibiarkan tertinggal.

Suite penuh sering timeout kalau paralel — selalu `--runInBand`.

### 0.6 Yang tidak bisa diverifikasi lokal

Jujur di laporan, jangan diklaim jalan:

- Apa pun yang menyentuh listing type, listing field, atau filter pencarian
  butuh konfigurasi Console (§3.2) lebih dulu.
- Checkout butuh `REACT_APP_STRIPE_PUBLISHABLE_KEY`.
- Langganan butuh `STRIPE_SECRET_KEY` + `STRIPE_BRAND_SUBSCRIPTION_PRICE_ID`.
- Konsol operator butuh `SHARETRIBE_INTEGRATION_CLIENT_ID` / `_SECRET`.
- Alur kolaborasi penuh butuh proses ter-push ke marketplace nyata + dua akun uji.

### 0.7 Standar UI — berlaku untuk SETIAP halaman

Rencana ini mencakup frontend yang **fungsional dan layak pakai**, bukan hanya
mesinnya. Fondasi desainnya sudah ada: token di
`src/styles/marketplaceDefaults.css` sudah ditata (`--borderRadius: 8px`,
`--borderRadiusMedium: 12px`, `--borderRadiusLarge: 20px`, ramp
`--boxShadowXs/Sm/Md`) — **pakai token itu, jangan bikin nilai baru.**

Sebuah halaman **belum selesai** sampai kelima hal ini ada. Ini bagian dari
kriteria "Selesai bila" setiap tugas yang membuat halaman, meskipun tidak
diulang di tiap tugas:

1. **Keadaan memuat** — skeleton atau spinner, bukan layar kosong yang melompat.
2. **Keadaan kosong** — kalimat yang menjelaskan *kenapa* kosong dan satu ajakan
   untuk keluar dari keadaan itu. "Belum ada kolaborasi" saja tidak cukup;
   "Belum ada kolaborasi — 3 proyek cocok dengan niche kamu" mengubah halaman mati
   jadi pintu masuk.
3. **Keadaan error** — pesan yang menyebut apa yang gagal dan apa yang bisa
   dilakukan. Tanpa permintaan maaf, tanpa kode error mentah.
4. **Mobile** — mobile-first, dua breakpoint (`--viewportMedium` 768px,
   `--viewportLarge` 1024px). Baseline 6px di mobile, 8px dari medium ke atas.
5. **Fokus keyboard terlihat** pada setiap kontrol, dan elemen HTML yang semantik.

Untuk halaman yang **mengoperasikan** sesuatu (ruang kerja, perbandingan pelamar,
konsol operator), tambahkan dua lagi:

6. **Status terbaca sekilas** — bentuk, bukan cuma angka: pil status, penanda
   "butuh tindakan", strip tenggat. Yang mendesak harus terlihat sebelum dibaca.
7. **Hanya aksi yang sah yang dirender.** Tombol yang akan ditolak state machine
   tidak boleh muncul. Kalau sebuah aksi hilang karena aturan (mis. jatah revisi
   habis), UI **menjelaskan kenapa** — tidak menghilang diam-diam.

---

## 1. Perubahan arsitektur: dari apa ke apa

### 1.1 Sekarang (salah menurut brief)

Creator memajang paket berharga tetap → brand checkout langsung di paket itu.
Proyek brand hanya listing gratis yang memancing pesan bebas
(`ProjectDetailPage.js:97` memanggil `sendInquiry(listing, message)`).
Harga kolaborasi = harga paket. Tidak ada lamaran terstruktur, tidak ada
penawaran harga, tidak ada deliverable sebagai objek.

### 1.2 Target (BLUEPRINT `D1` `D2`)

Brand menulis **proyek berikut harganya** → creator **melamar** dengan harga itu
atau **mengajukan harga lain** → brand menerima (boleh membalas sekali) →
brand membayar di listing creator dengan harga yang disepakati.

### 1.3 Kendala Sharetribe yang membentuk desainnya

**Transaksi hanya bisa dimulai oleh customer, dan provider selalu pemilik
listing.** Dua konsekuensi yang tidak bisa dihindari:

1. Creator **tidak bisa** memulai transaksi di listing-nya sendiri. Jadi lamaran
   creator harus menjadi transaksi di **listing proyek milik brand**, dengan
   creator sebagai customer dan brand sebagai provider. Peran memang terbalik di
   sini — dan itu **tidak masalah**, karena transaksi ini tidak pernah membawa
   uang. Ia hanya catatan lamaran.
2. Uang harus mengalir ke creator, jadi kolaborasi berbayar harus menjadi
   transaksi **terpisah** di listing creator, dimulai oleh brand.

Maka ada **dua transaksi per kolaborasi**:

| | Transaksi lamaran | Transaksi kolaborasi |
|---|---|---|
| Listing | `project` (milik brand) | `creator-profile` (milik creator) |
| Proses | **`cgc-application`** (baru) | `cgc-ugc-approval` (sudah ada) |
| Customer | creator | brand |
| Provider | brand | creator |
| Uang | tidak ada | escrow → payout |
| Dimulai oleh | creator (melamar) | brand (menerima lamaran lalu bayar) |

Penghubungnya: transaksi kolaborasi menyimpan `applicationId` dan `projectId` di
`protectedData`; transaksi lamaran menyimpan `collaborationId` setelah diterima.

### 1.4 Undangan

Undangan brand → creator adalah **transaksi `cgc-ugc-approval` di state
`inquiry`** pada listing creator (brand = customer, peran sudah benar), membawa
`projectId`. Fungsinya: percakapan + kehadiran di inbox + notifikasi. Creator
yang diundang tetap melamar lewat `cgc-application` (formulir lamaran ter-prefill
dari undangan). Saat brand menerima, checkout dilakukan di transaksi undangan itu
juga lewat `request-payment-after-inquiry` — jadi utas percakapannya berlanjut
menjadi kolaborasi.

### 1.5 Kabar baik

`cgc-ugc-approval` **tidak perlu diubah sama sekali** untuk mekanisme harga:
`transition/request-payment` dan `transition/request-payment-after-inquiry`
sudah `privileged? true`, dan itu cukup untuk menetapkan harga dari server.
Satu-satunya pekerjaan proses adalah membuat `cgc-application` yang baru.

---

## 2. Kontrak data

**Ini sumber kebenaran tunggal.** Semua tugas mengacu ke sini. Jangan menambah
field di luar daftar ini tanpa memperbarui bagian ini lebih dulu.

### 2.1 Listing `project` (milik brand)

```js
// listing.attributes.price  -> harga yang ditawarkan brand (Money)
// listing.attributes.publicData:
{
  listingType: 'project',
  transactionProcessAlias: 'cgc-application/release-1',
  unitType: 'inquiry',

  priceNegotiable: true,          // boolean — false = harga terkunci
  contentNiche: ['beauty'],       // multi-enum
  platforms: ['tiktok'],          // multi-enum
  usageRights: 'paid-ads-6m',     // enum
  contentDueDate: '2026-09-15',   // ISO date (string)
  requiresProduct: true,          // boolean
  deliverables: [                 // lihat 2.4
    { id: 'd1', type: 'video', spec: '30 detik vertikal', platform: 'tiktok', quantity: 2 }
  ],
  projectStatus: 'open',          // 'draft' | 'open' | 'matched' | 'closed'
}
```

### 2.2 Listing `creator-profile` (milik creator)

```js
// listing.attributes.price -> TARIF INDIKATIF saja. Tidak pernah dipakai
// sebagai harga transaksi. Lihat 2.6.
// listing.attributes.publicData:
{
  listingType: 'creator-profile',
  transactionProcessAlias: 'cgc-ugc-approval/release-1',
  unitType: 'item',

  contentNiche: ['beauty', 'fashion'],
  platforms: ['tiktok', 'ig-reels'],
  turnaroundDays: 7,
  usageRights: 'paid-ads-6m',     // hak pakai maksimum yang bersedia diberikan
  acceptsProductShipping: true,   // creator bersedia menerima kiriman produk
}
```

> Catatan: `requiresProduct` **pindah** dari listing creator ke listing proyek —
> yang menentukan butuh produk atau tidak adalah kampanyenya, bukan creator-nya.
> Di sisi creator yang tersisa hanya kesediaan menerima kiriman.

### 2.3 Transaksi lamaran (`cgc-application`) — `protectedData`

```js
{
  projectId: '<uuid listing proyek>',
  creatorListingId: '<uuid listing creator-profile>',   // wajib: tujuan checkout nanti
  invitationTxId: '<uuid>' | null,                      // kalau datang dari undangan

  readyByDate: '2026-09-10',
  applicantNote: '…',
  offerNotes: [                        // ALASAN saja, tanpa angka. `by` pakai
                                        // peran Sharetribe asli — lihat 2.3b
    { by: 'customer', note: 'butuh 2 hari syuting tambahan' },  // customer = creator di proses ini
    { by: 'provider',   note: 'ini batas kami' }                // provider = brand di proses ini
  ],
  collaborationTxId: '<uuid>' | null,  // diisi setelah brand membayar
}
```

**Angka harga TIDAK disimpan di `protectedData`.** Alasannya di §2.3b.

### 2.3b Transaksi lamaran — `metadata` (ditulis server)

```js
{
  listedPriceInSubunits: 40000,
  currency: 'USD',
  offers: [                            // append-only, satu entri per transisi penawaran
    { by: 'customer', amountInSubunits: 55000, transition: 'transition/apply',         at: '2026-08-02T10:00:00Z' },
    { by: 'provider',  amountInSubunits: 47500, transition: 'transition/brand-counter', at: '2026-08-03T09:00:00Z' }
  ],
}
```

`by` memakai peran Sharetribe asli (`customer`/`provider`), bukan label produk
(`creator`/`brand`) — sengaja disamakan dengan field `by` di
`tx.attributes.transitions` bawaan Sharetribe dan pola yang sudah dipakai
`server/api-util/negotiation.js`, supaya validasi bisa mencocokkan langsung
tanpa lapisan terjemahan. Ingat di proses ini **customer = creator, provider =
brand** (BLUEPRINT §1.3) — kebalikan dari `cgc-ugc-approval`.

**Kenapa di `metadata`, bukan `protectedData`:** `protectedData` bisa ditulis
oleh **kedua** peserta transaksi lewat transisi mereka masing-masing, dan
`update-protected-data` menimpa key yang dikirim. Artinya creator bisa mengubah
angka penawaran brand menjadi berapa pun saat ia menekan "terima balasan".
Memeriksa jumlah entri terhadap array `transitions` tidak menolong — yang
dipalsukan adalah *nilainya*, bukan jumlahnya.

`metadata` hanya bisa ditulis dari sisi server (Integration API / operator), jadi
angka di sana tidak bisa disentuh klien.

**Cara menulisnya** (urutan preferensi):

1. **Utama — Integration SDK sesudah transisi.** Endpoint lamaran di server kita
   menjalankan transisi atas nama user, lalu segera memanggil
   `integrationSdk.transactions.updateMetadata({ id, metadata })` untuk menambah
   entri `offers`. Tidak butuh aksi khusus di `process.edn`, jadi tidak ada
   ketidakpastian format.
2. **Alternatif — `:action/update-metadata` pada transisi privileged.** Template
   ini sudah memakai pola tersebut untuk `default-negotiation`
   (`server/api/transition-privileged.js:173` mengirim `metadata` di params).
   Kalau `flex-cli process push` menerima aksi itu di `cgc-application`, pakai
   cara ini karena lebih atomik (satu panggilan, tidak ada jendela di mana
   transisi sudah terjadi tapi metadata belum tertulis).

Coba (2) saat push F1.1 — validatornya `flex-cli` sendiri, jadi murah dicek.
Kalau ditolak, pakai (1) dan **tulis metadata sebelum mengembalikan respons ke
klien**, supaya UI tidak pernah melihat lamaran tanpa angka.

Aturan `offers`:

- Panjang maksimal **2** (BLUEPRINT `D2`): satu dari creator, satu balasan brand.
- Kalau creator melamar dengan harga apa adanya, `offers` berisi satu entri
  dengan `amountInSubunits === listedPriceInSubunits`.
- **Harga yang disepakati** = `offers.at(-1).amountInSubunits`.
  Fungsi tunggal: `getAgreedPriceInSubunits(metadata)` di
  `src/util/application.js` dan salinan CommonJS-nya di
  `server/api-util/application.js` — dua-duanya wajib diuji dengan kasus yang sama.

### 2.4 Deliverable

Dipakai di listing proyek (permintaan) dan di transaksi kolaborasi (pengerjaan).

```js
{
  id: 'd1',                    // stabil, dibuat saat proyek dibuat
  type: 'video' | 'photo' | 'carousel' | 'ugc-review',
  spec: '30 detik vertikal',
  platform: 'tiktok',
  quantity: 2,

  // hanya di transaksi kolaborasi:
  status: 'pending' | 'submitted' | 'revision' | 'approved',
  versions: [
    {
      v: 1,
      links: ['https://…'],          // tautan = wujud utama pengiriman aset
      attachmentIds: ['<uuid>'],     // lampiran pesan Sharetribe, untuk berkas kecil
      note: '…',
      at: '2026-09-01T…',
    }
  ]
}
```

**Keputusan penyimpanan aset (v1):** aset dikirim sebagai **tautan** (Drive,
Dropbox, Frame.io) sebagai wujud resmi, ditambah **lampiran pesan bawaan
Sharetribe** untuk berkas kecil (foto, PDF, thumbnail). Sharetribe memang punya
lampiran pesan — komponennya sudah ada di repo
(`src/containers/TransactionPage/FileAttachments/`, dan `SendMessageForm`
punya `showAttachFiles`) — tapi itu dirancang untuk berkas kecil, bukan video
mentah. **Verifikasi batas ukurannya di dokumentasi Sharetribe sebelum
menjanjikan apa pun ke pengguna.**

Konsekuensi yang harus ditangani, bukan diabaikan: tautan bisa mati. Karena itu
setiap versi wajib menyimpan metadata yang bertahan meski tautannya hilang
(nama berkas, durasi, platform), dan catatan lisensi (F6.1) merekam metadata
tersebut — bukan cuma URL-nya. Unggahan langsung ke penyimpanan sendiri adalah
pekerjaan Lapis 3, dan butuh persetujuan user karena menambah dependency
dan biaya.

`links` adalah input yang **tidak dipercaya**. Selalu lewat `isSafeUrl` sebelum
dirender; jangan pernah di-embed dalam iframe.

### 2.5 Transaksi kolaborasi (`cgc-ugc-approval`) — `protectedData`

```js
{
  projectId: '<uuid>',
  applicationId: '<uuid>',
  agreedPriceInSubunits: 47500,     // salinan untuk tampilan; BUKAN sumber kebenaran harga
  invitationStatus: 'sent' | 'seen' | 'accepted' | 'declined' | 'expired',  // fase undangan

  creatorShippingAddress: { name, line1, line2, city, postalCode, country, phone },
  shipping: { carrier: 'JNE', trackingNumber: '…', shippedAt: '…', receivedAt: '…' },

  deliverables: [ /* 2.4 */ ],
  revisionNotes: [ { round: 1, note: '…', at: '…' } ],

  contentDueDate: '2026-09-15',     // dari proyek — dipakai penjadwal pengingat
  reviewDueDate: '2026-09-22',
}
```

### 2.6 Invarian keamanan harga — WAJIB

> Harga transaksi **tidak boleh** berasal dari input klien dan **tidak boleh**
> berasal dari harga listing creator.

Alurnya:

1. Brand menekan checkout, klien mengirim `orderData.applicationId` saja —
   **bukan angka harga**.
2. Server (`server/api/transition-privileged.js` dan
   `initiate-privileged.js`) mengambil transaksi lamaran itu lewat Integration
   SDK (`server/api-util/integrationSdk.js`, sudah ada).
3. Server memvalidasi:
   - transaksi lamaran berstate `accepted`;
   - `creatorListingId` di lamaran **sama dengan** listing yang sedang di-checkout;
   - `projectId` di lamaran mengarah ke proyek milik brand yang sedang login;
   - `metadata.offers` valid: panjang ≤ 2, urutan aktor benar, dan cocok dengan
     urutan transisi di transaksi lamaran (pola yang sama dengan
     `server/api-util/negotiation.js:126` — tiru fungsinya, jangan pakai
     langsung karena nama transisinya berbeda).
4. Server menghitung `agreedPriceInSubunits` dari **`metadata`** (§2.3b),
   membentuk `Money`, dan meneruskannya ke `transactionLineItems`.
   Jangan pernah membacanya dari `protectedData` — di sana angkanya memang
   sengaja tidak ada.
5. Kalau salah satu validasi gagal → HTTP 400, transaksi tidak dibuat.

Di `server/api-util/lineItems.js`, tambahkan cabang: kalau
`orderData.agreedPrice instanceof Money` dan `publicData.listingType ===
'creator-profile'`, pakai itu sebagai `unitPrice` (jangan ubah cabang unit type
lain — `lineItems.test.js` menjaga perilaku proses lain).

### 2.7 User

```js
// user.attributes.profile.publicData
{ userType: 'brand' | 'creator' | 'operator' }

// user.attributes.profile.privateData  (creator)
{
  application: {
    handles: [{ platform: 'tiktok', url: '…', followers: 120000 }],
    sampleWorks: ['https://…', 'https://…', 'https://…'],
    niches: ['beauty'],
    typicalTurnaroundDays: 7,
    indicativeRateInSubunits: 40000,
    submittedAt: '…',
  },
  shippingAddress: { /* dipakai untuk auto-fill saat kolaborasi butuh produk */ },
  inviteCode: 'CGC-XXXX' | null,
}

// user.attributes.profile.privateData  (brand)
{
  accessRequest: { company, website, category, monthlyVolume, budgetRange, source, submittedAt },
  savedCreators: ['<userId>'],   // roster — sudah dipakai brandRoster.duck.js
}
```

Operator ditandai `userType: 'operator'` **dan** dicek ulang di server terhadap
daftar id di env `CGC_OPERATOR_USER_IDS` (koma). Jangan pernah mengandalkan
`userType` dari klien saja untuk membuka rute `/admin/*`.

---

## 3. Fase 0 — Persiapan

### F0.1 — Env & dependency

**File:** `.env` (lokal, jangan di-commit), `README` env checklist.

Pastikan ada:

```
REACT_APP_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_BRAND_SUBSCRIPTION_PRICE_ID=
SHARETRIBE_INTEGRATION_CLIENT_ID=
SHARETRIBE_INTEGRATION_CLIENT_SECRET=
CGC_OPERATOR_USER_IDS=
CGC_CRON_SECRET=
```

`sharetribe-flex-integration-sdk` sudah terpasang (`package.json:58`). Tidak ada
dependency baru yang perlu ditambah untuk seluruh rencana ini.

**Selesai bila:** `yarn dev` jalan, dan `server/api-util/integrationSdk.js`
tidak melempar saat dipanggil.

### F0.2 — Konfigurasi Console (dikerjakan manusia, bukan agen)

Lihat BLUEPRINT Lampiran A2 dan A3. Ringkasnya:

- Buat listing type `project` (proses `cgc-application/release-1`, unit
  `inquiry`, harga **aktif**, payout tidak) dan `creator-profile` (proses
  `cgc-ugc-approval/release-1`, unit `item`, payout wajib, **pickup/shipping
  dimatikan**).
- Buat listing field sesuai §2.1 dan §2.2, semua scope `public`.
- Search index untuk `contentNiche`, `platforms`, `usageRights`.
- Access control: nyalakan approval user, set **call to action → Internal link
  `/apply`**, biarkan tiga "Restrict … rights" OFF.

**Selesai bila:** listing type muncul di `/api/assets` dan bisa dibaca aplikasi.

### F0.3 — Rename `project-brief` → `project`

**Tujuan:** menyamakan nama tipe listing dengan kosakata blueprint.

**File:** 20 file, temukan dengan

```bash
grep -rln "project-brief" src server scripts
```

**Langkah:** ganti string `'project-brief'` → `'project'`. Periksa juga
`PROJECT_BRIEF`-style konstanta dan nama key translations
(`*.projectBrief*` boleh dibiarkan kalau tidak dilihat pengguna).

**Selesai bila:** `grep -r "project-brief" src server` kosong, `yarn build-web`
hijau.

**Jangan:** melakukan rename ini setelah ada listing nyata di Console —
`publicData.listingType` pada listing lama tidak ikut berubah.

### F0.4 — Perluas `scripts/verify-cgc.js`

**File:** `scripts/verify-cgc.js`

Tambahkan pemeriksaan:

1. Proses `cgc-application`: setiap transisi di `process.edn`-nya ada di mirror
   JS-nya, dan sebaliknya (tiru blok baris 24–50 yang sudah ada untuk
   `cgc-ugc-approval`).
2. Setiap state `cgc-application` punya label inbox untuk **dua** peran di
   `en.json`.
3. Tidak ada state non-terminal yang tidak punya jalan keluar.

**Selesai bila:** `yarn verify-cgc` gagal kalau sengaja dihapus satu transisi
dari salah satu mirror JS.

---

## 4. Fase 1 — Fondasi proses & backend

> Tergantung: F0. **Tidak ada UI di fase ini.**

### F1.1 — Proses `cgc-application`

**⚠️ Butuh persetujuan user sebelum push (aturan §0.3).**

**File baru:** `ext/transaction-processes/cgc-application/process.edn` +
`templates/`.

Graf yang harus dibuat:

| Transisi | Aktor | Dari | Ke |
|---|---|---|---|
| `transition/apply` | customer (creator) | — | `applied` |
| `transition/brand-counter` | provider (brand) | `applied` | `countered` |
| `transition/brand-accept` | provider | `applied` | `accepted` |
| `transition/brand-decline` | provider | `applied` | `declined` |
| `transition/creator-accept-counter` | customer | `countered` | `accepted` |
| `transition/creator-decline-counter` | customer | `countered` | `declined` |
| `transition/creator-withdraw` | customer | `applied` | `withdrawn` |
| `transition/expire-application` | waktu, 7 hari dari `applied` | `applied` | `expired` |
| `transition/expire-counter` | waktu, 3 hari dari `countered` | `countered` | `expired` |
| `transition/mark-collaborating` | provider | `accepted` | `accepted` (self) |

Semua transisi memakai `:action/update-protected-data`. Tidak ada aksi Stripe,
tidak ada stok, tidak ada payout.

Hanya **dua** transisi yang benar-benar menulis angka baru dan karena itu perlu
`:privileged? true` + `:action/update-metadata`: `apply` (mencatat harga
lamaran) dan `brand-counter` (mencatat harga balasan). `creator-accept-counter`
**sengaja dibiarkan transisi biasa** — ia tidak menambah entri `offers` sama
sekali, karena harga yang disepakati sudah ada di entri terakhir yang ditulis
`brand-counter`; menjadikannya privileged hanya menambah kerumitan tanpa guna.
`mark-collaborating` tetap privileged, tapi alasannya beda: bukan karena
menulis angka, melainkan supaya `collaborationTxId` hanya bisa ditulis server
kita sendiri setelah memverifikasi transaksi kolaborasi itu benar ada — bukan
oleh klien dengan id sembarangan.

Coba `:action/update-metadata` saat `flex-cli process push`. Kalau diterima,
angka penawaran ditulis dalam transisi yang sama (§2.3b cara 2). Kalau ditolak,
hapus aksi itu, biarkan transisinya biasa, dan tulis metadata lewat Integration
SDK tepat setelah transisi (§2.3b cara 1). **Catat hasil percobaan ini di
BLUEPRINT.md Lampiran A1** supaya tidak perlu dicoba dua kali.

`mark-collaborating` adalah self-transition untuk menuliskan `collaborationTxId`
setelah brand membayar. Self-transition sudah terbukti diterima format v3
(BLUEPRINT Lampiran A1).

Notifikasi: lamaran baru → brand; balasan harga → creator; diterima → creator;
ditolak → creator; kedaluwarsa → keduanya.

**Selesai bila:** `flex-cli process push --process cgc-application …` diterima,
alias `release-1` dibuat, `flex-cli process list` menunjukkannya.

### F1.2 — Mirror JS untuk `cgc-application`

**File baru:** `src/transactions/transactionProcessCGCApplication.js`
**File diubah:** `src/transactions/transaction.js` (daftarkan proses + alias)

Tiru struktur `transactionProcessCGCUGC.js`: `transitions`, `states`, `graph`,
`isRelevantPastTransition`, `statesNeedingCustomerAttention` /
`…ProviderAttention`. Tidak perlu `DEADLINE_RULES` selain kedua timer di atas.

**Selesai bila:** `yarn verify-cgc` (hasil F0.4) hijau.

### F1.3 — Helper harga bersama

**File baru:** `src/util/application.js`, `server/api-util/application.js`,
plus `.test.js` untuk keduanya.

Isi (identik di dua sisi, satu ESM satu CommonJS):

```js
getAgreedPriceInSubunits(metadata)        // §2.3b — dari metadata, bukan protectedData
isValidOfferHistory(offers, transitions)  // panjang ≤2, aktor & urutan cocok
canCounter(offers)                        // true hanya kalau offers.length === 1 && by === 'creator'
```

**Selesai bila:** tes menutup: lamaran harga apa adanya, penawaran creator,
penawaran + balasan brand, tiga penawaran (harus invalid), aktor tertukar
(invalid), `offers` kosong (invalid — minimal selalu ada satu entri).

### F1.4 — Validasi harga di endpoint privileged

**File diubah:** `server/api/initiate-privileged.js`,
`server/api/transition-privileged.js`, `server/api-util/lineItems.js`

Implementasikan §2.6 persis. Titik penting:

- Ambil transaksi lamaran dengan Integration SDK, **bukan** dengan SDK user —
  brand bukan peserta di transaksi lamaran orang lain.
- Tolak dengan 400 + pesan yang bisa dibaca kalau validasi gagal; jangan diam-diam
  jatuh ke harga listing.
- Cabang baru di `lineItems.js` hanya aktif untuk `listingType === 'creator-profile'`.

**Selesai bila:** ada tes di `server/api-util/lineItems.test.js` yang membuktikan
(a) harga dari lamaran dipakai, (b) harga listing diabaikan, (c) `orderData`
yang membawa angka harga langsung tidak berpengaruh apa pun.

**Jangan:** mengubah perilaku unit type lain — tes lama harus tetap hijau.

---

## 5. Fase 2 — Proyek, lamaran, penawaran, checkout

> Tergantung: F1. Ini fase terbesar dan paling bernilai.

### F2.1 — Formulir buat proyek

**File diubah:** `src/containers/PostProjectPage/` (`PostProjectForm.js`,
`PostProjectPage.duck.js`, `PostProjectPage.js`)
**Rute:** ganti `/campaigns/new` → `/projects/new` di
`src/routing/routeConfiguration.js`

Field sesuai §2.1, dengan urutan di layar: judul → brief → deliverable
(repeater, bisa tambah/hapus baris) → hak pakai → tenggat konten → harga +
checkbox "terima penawaran harga" → perlu kirim produk → niche → platform.

Deliverable repeater menghasilkan array §2.4 dengan `id` yang di-generate
(`d1`, `d2`, …) dan stabil setelah dibuat.

**Selesai bila:** proyek tersimpan sebagai listing `project` dengan `price`
terisi dan seluruh `publicData` sesuai §2.1; muncul di papan proyek.

### F2.2 — Papan proyek (sisi creator)

**File diubah:** `src/containers/BrowseProjectsPage/`

Kartu proyek menampilkan: judul, brand, **harga**, tenggat, jumlah deliverable,
niche, platform, badge "butuh kirim produk", dan badge **"Kamu diundang"**
kalau ada transaksi undangan untuk creator ini di proyek tersebut.

Filter: niche, platform, rentang harga, butuh produk atau tidak.

Undangan diurutkan paling atas — selalu.

**Selesai bila:** creator melihat proyek terbuka, badge undangan muncul benar,
filter berfungsi (butuh search index dari F0.2).

### F2.3 — Halaman detail proyek + formulir lamaran

**File diubah:** `src/containers/ProjectDetailPage/`

Ganti `sendInquiry` (baris 97) dengan alur baru:

- Tombol utama besar: **"Lamar dengan harga ini — $X"**.
- Di bawahnya, tautan kecil: "Ajukan harga lain". Membuka field harga + alasan.
  Tautan ini **tidak dirender** kalau `priceNegotiable === false`.
- Field lain: tanggal siap kirim (default = tenggat proyek), catatan singkat.
- Guard: creator harus punya listing `creator-profile` yang sudah published.
  Kalau belum → arahkan ke `/creator-package` dengan pesan jelas.

Submit memanggil `transition/apply` pada listing proyek, dengan `protectedData`
sesuai §2.3.

**Selesai bila:** lamaran muncul di sisi brand; melamar dua kali ke proyek yang
sama ditolak dengan pesan yang bisa dibaca.

**Jangan:** menaruh dua tombol berukuran sama. Menawar harus terasa lebih berat
daripada menerima (BLUEPRINT `D2`).

### F2.4 — Halaman proyek sisi brand: bandingkan pelamar

**Koreksi rute (ditemukan saat F2.1):** `/projects` dan `/projects/:id`
**sudah dipakai** — `BrowseProjectsPage` (papan proyek sisi creator, semua
proyek terbuka lintas brand) dan `ProjectDetailPage` (detail + form lamaran).
Memindahkan `ManageCampaignsPage` ke path yang sama akan bentrok.

Solusinya: **`ProjectDetailPage` dibuat role-aware**, mengikuti pola yang
sudah ada di `ListingPage`/`CreatorProfilePage` (pemilik lihat kontrol
kelola, orang lain lihat panel aksi publik) — bukan halaman terpisah:

| Yang login | Yang dilihat di `/projects/:id` |
|---|---|
| Creator (bukan pemilik) | Form lamaran (F2.3) |
| Brand pemilik proyek | Daftar pelamar + aksi terima/tawar/tolak (F2.4, di bawah) |

`ManageCampaignsPage` **tetap di `/campaigns`** — perannya beda: daftar
proyek milik brand itu sendiri (dashboard ringkas), bukan papan proyek
lintas-brand. Tiap barisnya tetap menaut ke `/projects/:id`, yang otomatis
menampilkan tampilan pemilik karena role-aware.

**File diubah:** `src/containers/ProjectDetailPage/` (tambah cabang
pemilik), `src/containers/ManageCampaignsPage/` (tetap sebagai daftar
ringkas di `/campaigns`, tidak pindah rute).

Tiap pelamar sebagai kartu setara: avatar, nama, rating, 3 karya portofolio,
**harga** (dengan penanda "sesuai harga" atau "+$75 dari harga kamu"), tanggal
siap, catatan. Aksi: **Terima**, **Ajukan harga balasan** (hanya sekali, pakai
`canCounter()` dari F1.3), **Tolak**.

**Selesai bila:** tombol balasan hilang setelah dipakai sekali, dan UI
menjelaskan kenapa — bukan menghilang diam-diam.

### F2.5 — Undangan

**File baru:** `src/containers/ProjectInvitePage/` (rute `/projects/:id/invite`)
**File diubah:** `src/containers/ExploreCreatorsPage/`, `CreatorProfilePage.js`

Brand memilih creator (dari direktori atau dari saran: creator yang niche dan
platform-nya cocok dengan proyek), lalu mengirim undangan =
`transition/inquire` di listing creator dengan `projectId` +
`invitationStatus: 'sent'` di `protectedData`.

Status undangan diperbarui: `seen` saat creator membuka, `accepted` saat creator
melamar ke proyek itu, `declined` lewat tombol, `expired` setelah 7 hari
(dihitung di UI dari `createdAt`, tidak perlu transisi baru).

**Selesai bila:** brand melihat status tiap undangan; creator melihat undangan di
papan proyek dan di inbox.

### F2.6 — Checkout dengan harga yang disepakati

**File diubah:** `src/containers/CheckoutPage/*`

- Halaman konfirmasi kesepakatan sebelum bayar: deliverable, tenggat, hak pakai,
  jatah revisi (2), harga + rincian. Ini implementasi `R6`.
- `orderData` yang dikirim ke server hanya `{ applicationId }` — **tidak ada
  angka harga** (§2.6).
- Kalau ada transaksi undangan → `request-payment-after-inquiry` pada transaksi
  itu; kalau tidak → `request-payment` baru.
- Setelah pembayaran berhasil: tulis `collaborationTxId` ke transaksi lamaran
  lewat `transition/mark-collaborating`, dan set `projectStatus: 'matched'` pada
  listing proyek.

**Selesai bila:** transaksi kolaborasi lahir dengan `payinTotal` = harga
disepakati, dan `protectedData` sesuai §2.5.

### F2.7 — Bersihkan jalur lama

**Hapus/alihkan:** `MakeOfferPage`, `RequestQuotePage`, dan rute
`/l/:slug/:id/make-offer`, `/l/:slug/:id/request-quote` **kalau** tidak dipakai
proses lain di aplikasi ini. Periksa dulu dengan grep; kalau
`default-negotiation` masih terdaftar di `src/transactions/transaction.js` dan
dipakai, biarkan dan cukup putuskan tautannya dari alur CGC.

**Selesai bila:** tidak ada dua jalur menuju checkout yang bisa membingungkan.

---

## 6. Fase 3 — Deliverable & ruang kerja

> Tergantung: F2.

### F3.1 — Deliverable sebagai objek

**File diubah:** `src/containers/TransactionPage/TransactionPanel/CollaborationDetailsMaybe.js`
**File baru:** `src/containers/TransactionPage/DeliverableList/`

Salin `deliverables` dari listing proyek ke `protectedData` kolaborasi saat
checkout (F2.6), lalu render sebagai daftar: tiap baris punya status sendiri,
riwayat versi yang bisa dibuka, dan (sisi creator) tombol unggah per item.

Tombol "kirim untuk ditinjau" hanya aktif kalau **semua** deliverable punya
minimal satu versi.

**Selesai bila:** revisi bisa ditunjuk ke deliverable tertentu; riwayat v1/v2/v3
terlihat berdampingan.

**Jangan:** merender URL creator tanpa `isSafeUrl`, dan jangan meng-embed-nya.

### F3.2 — Panel keputusan brand

**File diubah:** `TransactionPage.stateDataCGCUGC.js`, `ApprovalDecisionPanel`

Di state `content-submitted*`: satu area keputusan dengan **Setujui** (butuh
konfirmasi, teks jelas bahwa uang cair dan tidak bisa dibatalkan) dan **Minta
revisi** (catatan wajib). Di `content-submitted-revised-2`: tombol revisi diganti
penjelasan + tombol **Eskalasi ke tim CGC** (BLUEPRINT `D4`).

**Selesai bila:** sisa jatah revisi selalu terlihat ("Revisi 1 dari 2").

### F3.3 — Alamat & pengiriman

**File diubah:** `TransactionPanel`, `CGCActionModal`

Tahap pengiriman hanya muncul kalau `requiresProduct` pada **proyek** (bukan
listing creator) bernilai true. Alamat creator di-prefill dari
`privateData.shippingAddress` (F4.2) dan bisa disunting sebelum dikirim.

**Selesai bila:** proyek tanpa produk sama sekali tidak menampilkan tahap
pengiriman — di pelacak tahap maupun di kotak aksi.

### F3.4 — Pelacak tahap & inbox

**File diubah:** `StageTracker`, `InboxPage.stateDataCGCUGC.js`

Pelacak: 5 tahap (BLUEPRINT §5), tanggal tiap tahap dari array `transitions`,
tenggat berikutnya, sisa revisi. Inbox: kelompokkan per tahap, dahulukan yang
butuh tindakan, tampilkan tenggat per baris.

Tambahkan juga baris inbox untuk transaksi `cgc-application` (label per state,
dua peran) — kalau tidak, lamaran tidak terlihat di mana pun.

**Selesai bila:** `yarn verify-cgc` mengonfirmasi semua state punya label untuk
dua peran, di dua proses.

---

## 7. Fase 4 — Lamaran, vetting, onboarding

> Tergantung: F0. Bisa paralel dengan F2/F3.

### F4.1 — Formulir lamaran creator & permintaan akses brand

**File baru:** `src/containers/ApplyPage/` (`/apply`),
`src/containers/RequestAccessPage/` (`/request-access`),
`src/containers/PendingPage/` (`/pending`)
**Server baru:** `server/api/applications.js` (menulis ke `privateData` user
lewat Integration SDK; user sendiri tidak boleh menulis field yang dinilai)

Field sesuai §2.7. Formulir lamaran creator wajib meminta **tiga contoh karya**.
Dukung `?code=` untuk kode undangan (F5.3).

**Selesai bila:** setelah submit, user berstatus `pending-approval` melihat
`/pending` dengan penjelasan dan perkiraan waktu.

### F4.2 — Onboarding creator

**File diubah:** `src/containers/CreatorOnboardingPage/creatorSetupSteps.js`

Tambah langkah **alamat pengiriman** (disimpan ke `privateData.shippingAddress`)
di antara profil dan payout. Alasannya ada di BLUEPRINT §7 C2.

**Selesai bila:** checklist punya 5 langkah dan status tiap langkah dihitung dari
data nyata, bukan flag.

### F4.3 — Gerbang langganan

**File diubah:** `src/util/subscription.js` dan tiga titik panggilnya

Sesuaikan dengan BLUEPRINT `D5`: kunci **buat proyek**, **undang creator**,
**terima lamaran/checkout**. Jangan kunci menjelajah, jangan kunci kolaborasi
yang sedang berjalan.

**Selesai bila:** brand tanpa langganan bisa menjelajah dan menyelesaikan
kolaborasi lama, tapi tidak bisa memulai yang baru. Tidak ada paywall yang
berkedip di depan brand yang sudah membayar.

---

## 8. Fase 5 — Konsol operator

> Tergantung: F4.1.

### F5.1 — Gerbang rute operator

**File baru:** `src/util/operator.js`, `server/api/admin/index.js`
**File diubah:** `routeConfiguration.js`

Rute `/admin/*` hanya untuk `userType === 'operator'` **dan** id ada di
`CGC_OPERATOR_USER_IDS` (dicek di server, §2.7). Semua data admin lewat endpoint
server; SDK Integration tidak pernah dipanggil dari klien.

### F5.2 — Antrean lamaran

**File baru:** `src/containers/AdminApplicationsPage/` (`/admin/applications`)

Daftar user `pending-approval` beserta isi `privateData.application` /
`accessRequest`: contoh karya bisa dibuka, handle sosial bisa diklik. Aksi:
setujui, tolak dengan alasan, minta info tambahan.

**Verifikasi dulu** endpoint persetujuan user di referensi Integration API
sebelum menulis kodenya. Kalau tidak tersedia: tetap bangun antrean + tampilan
penilaiannya, dan tombol persetujuannya menautkan ke Console
(BLUEPRINT `D6`).

### F5.3 — Kode undangan, mediasi, kesehatan jaringan

**File baru:** `AdminInvitesPage`, `AdminDisputesPage`, `AdminHealthPage`

- Kode undangan: buat/cabut, disimpan di listing/asset atau `privateData` user
  yang dibuat operator — **tanyakan user** kalau butuh penyimpanan baru.
- Mediasi: daftar transaksi di state `disputed`, riwayat lengkap, dua tombol
  (bayar ke creator = `mark-received-from-disputed`, refund =
  `cancel-from-disputed`). Keduanya transisi operator → lewat Integration API.
- Kesehatan: rasio brand:creator, proyek tanpa pelamar, creator tanpa proyek,
  kolaborasi mendekati batas waktu.

**Selesai bila:** operator bisa menyelesaikan satu sengketa uji tanpa membuka
Console.

---

## 9. Fase 6 — Lisensi & pustaka konten

> Tergantung: F3.

### F6.1 — Catatan lisensi

**File baru:** `src/containers/LicensePage/` (`/collaborations/:id/license`)

Saat transaksi masuk state `received`, bekukan snapshot: aset apa saja, creator
siapa, hak pakai apa, durasi, wilayah, tanggal. Render sebagai halaman yang bisa
dilihat dua pihak dan bisa dicetak/diunduh.

Tidak perlu entitas baru — semuanya diturunkan dari `protectedData` (§2.5) +
listing proyek.

### F6.2 — Pustaka konten brand

**File baru:** `src/containers/LibraryPage/` (`/library`)

Semua aset final dari kolaborasi yang selesai, dengan catatan hak pakainya, bisa
disaring per proyek/creator/platform. Tetap bisa diakses meski langganan berhenti
(BLUEPRINT `D5`).

---

## 10. Fase 7 — Pengingat berbasis tenggat

> Tergantung: F2.6 (tanggal kesepakatan sudah tersimpan).

### F7.1 — Penjadwal

**File baru:** `server/api/cron/reminders.js`

Endpoint `POST /api/cron/reminders` dilindungi header rahasia
(`CGC_CRON_SECRET`). Dipanggil penjadwal eksternal (Heroku Scheduler / cron-job)
sekali per jam. **Jangan menambah dependency cron** — endpoint + pemicu luar
lebih aman untuk hosting multi-instance.

Logika: query transaksi `cgc-ugc-approval` yang aktif lewat Integration SDK,
baca `contentDueDate` dari `protectedData`, kirim email pada H-3, H-1, dan hari
lewat tenggat. Simpan penanda terkirim di `protectedData.remindersSent` supaya
tidak dobel.

**Selesai bila:** memanggil endpoint dua kali berturut-turut hanya mengirim satu
email.

### F7.2 — Rapikan pengingat lama

**⚠️ Butuh persetujuan user — ini perubahan `process.edn`.**

Setelah F7.1 jalan, hapus notifikasi `content-due-reminder-*` dari
`cgc-ugc-approval` (berbasis lama-status, kini tergantikan), push sebagai versi
baru, arahkan alias. Sisanya biarkan sebagai jaring pengaman.

---

## 11. Fase 8 — Hubungan jangka panjang

> Tergantung: F3.

- **F8.1 Roster** — `RosterPage` sudah ada (`brandRoster.duck.js`). Tambah
  riwayat kolaborasi per creator dan tombol **pesan lagi** yang membuat proyek
  baru ter-prefill dari proyek sebelumnya lalu langsung mengundang creator itu.
- **F8.2 Penghasilan creator** — halaman `/earnings`: cair, ditahan, menunggu
  tinjauan. Data dari `payoutTotal` transaksi + `stripeConnectAccount`.
- **F8.3 Ulasan** — pastikan ulasan dua arah terbit bersamaan dan tampil di
  profil. Proses sudah mendukung; ini pekerjaan UI.

---

## 12. Fase 9 — Landing & langganan

> Tergantung: F4.

- **F9.1** Landing: dua pintu masuk terpisah ("Request access" / "Apply as
  creator"), showcase karya kurasi (karena direktori ada di balik login —
  BLUEPRINT A3). Konten dari CMS; yang dikerjakan di kode adalah styling section
  di `src/containers/PageBuilder/SectionBuilder/`.
- **F9.2** `SubscriptionPage`: halaman yang menjual, bukan sekadar berfungsi.
  **Harga jangan di-hardcode** — ambil dari Stripe atau dari konten Console.

---

## 13. Pembersihan

Setelah F2 dan F3 selesai, hapus atau alihkan yang sudah tidak punya tempat:

| Item | Tindakan |
|---|---|
| `CreatorPackagePage` sebagai "paket berharga tetap" | Ubah framing jadi **kartu tarif indikatif**; harga di sini tidak pernah menjadi harga transaksi |
| `MakeOfferPage`, `RequestQuotePage` | Hapus dari alur CGC (lihat F2.7) |
| `budgetRange` di mana pun | Hapus — diganti `price` pada listing proyek |
| `requiresProduct` pada `creator-profile` | Pindah ke listing proyek; sisakan `acceptsProductShipping` |
| Rute `/campaigns*` | Alihkan ke `/projects*` |

---

## 14. Definition of done per fase

| Fase | Dianggap selesai bila |
|---|---|
| F0 | Console terkonfigurasi, `yarn verify-cgc` hijau dengan pemeriksaan baru |
| F1 | Harga dari lamaran terbukti dipakai dan harga dari klien terbukti diabaikan, lewat tes |
| F2 | Satu proyek bisa dibuat → dilamar → ditawar → diterima → dibayar, end to end di marketplace uji |
| F3 | Kolaborasi bisa berjalan sampai disetujui dengan deliverable per item dan pelacak tahap yang benar |
| F4 | Creator baru bisa melamar dan menunggu, brand baru bisa minta akses dan berlangganan |
| F5 | Operator bisa menyetujui satu creator dan menyelesaikan satu sengketa dari dalam platform |
| F6 | Kolaborasi yang selesai menerbitkan catatan lisensi yang bisa dibuka dua pihak |
| F7 | Pengingat tenggat terkirim tepat H-3/H-1, tidak dobel |
| F8 | Brand bisa memesan ulang creator dari roster dalam ≤ 3 klik |
| F9 | Landing dan paywall siap ditunjukkan ke klien |

---

## 15. Angka sementara (simulasi) — boleh dipakai, jangan di-hardcode

Klien belum menetapkan angka-angka berikut. Nilai di bawah adalah **simulasi
sesuai kelaziman pasar** supaya pekerjaan tidak berhenti. Semuanya harus
diletakkan di tempat yang bisa diubah **tanpa menyentuh kode**.

| Hal | Nilai simulasi | Di mana disimpan | Kenapa segitu |
|---|---|---|---|
| Komisi platform | **15% dari creator**, 0% dari brand | Aset komisi di Console (`fetchCommission` di `server/api-util/sdk.js` sudah membacanya) | Kisaran lazim marketplace UGC 10–20%. Membebankan ke creator (bukan brand) menjaga harga yang dilihat brand sama dengan yang disepakati |
| Langganan brand | **satu paket, $149/bulan** | Produk & harga di Stripe; UI mengambil dari Stripe | Satu tingkat dulu. Tingkatan ganda menambah percabangan di seluruh gerbang akses tanpa data yang membuktikan perlunya |
| Masa berlaku undangan | 7 hari | Konstanta di `src/util/invitation.js` | Cukup untuk creator yang tidak membuka platform tiap hari |
| Batas waktu penawaran | lamaran 7 hari, balasan 3 hari | `process.edn` `cgc-application` | Balasan lebih pendek karena kedua pihak sudah terlibat |

**Konsekuensi penting:** karena komisi dibaca dari aset Console dan harga
langganan dari Stripe, **tidak ada satu pun tugas yang benar-benar terblokir**
oleh dua angka pertama. F1.4 dan F9.2 bisa dikerjakan penuh sekarang; yang
dilakukan klien nanti hanya mengganti nilai di Console/Stripe.

Kalau menemukan diri sedang menulis angka-angka ini di dalam file `.js`,
berhenti — itu tandanya salah tempat.
