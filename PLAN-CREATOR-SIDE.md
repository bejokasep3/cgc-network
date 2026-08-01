# Plan — Audit Brief & Perombakan Sisi Creator

Status: draft, 31 Juli 2026. Basis: 10 poin brief klien (lihat memory `project-cgc-network-brief`) diadu dengan kode yang ada di repo hari ini.

---

## 1. Audit brief → implementasi

| # | Poin brief | Brand | Creator | Catatan |
|---|---|---|---|---|
| 1 | Invite-only + CTA "Get Invitation" | ⚠️ | ⚠️ | `LandingPage.js` punya section `invite-creators`, tapi belum ada form aplikasi/waitlist yang benar-benar masuk ke mana pun. Vetting hanya mengandalkan user-approval Sharetribe (manual di Console). |
| 2 | Dua role: brand (buyer) & creator (provider) | ✅ | ✅ | Redirect per role, `DashboardTopbar` dengan `role="creator"`, `isBrandUserType`. |
| 3 | Quality over quantity | ⚠️ | ⚠️ | Belum ada sinyal kualitas yang terlihat (rating agregat, badge verified, portfolio). `IconVerified` sudah ada tapi belum jadi sistem. |
| 4 | Creator approval | ✅ (pasif) | ⚠️ | `isUserAuthorized` mengunci apply & view brief; tapi creator tidak tahu posisi antriannya, tidak ada langkah aplikasi yang dia isi. |
| 5 | Transparent partnership | ⚠️ | ⚠️ | Ada `StageTracker` di TransactionPage. Belum ada ringkasan uang/deadline yang transparan di dashboard creator. |
| 6 | Workflow dari project creation → delivery | ✅ | ⚠️ | Prosesnya utuh (`transactionProcessCGCUGC.js`), tapi pintu masuk creator ke workflow itu putus (lihat §2). |
| 7 | Brand subscribe, post project, browse creator, invite, kelola deliverable, review | ✅ | — | `SubscriptionPage`, `PostBriefPage`, `ExploreCreatorsPage`, `CreatorProfilePage` (invite form), `ManageCampaignsPage`. |
| 8 | Approval content, maks 2 revisi | ✅ | ✅ | `REQUEST_REVISION_1/2`, `RESUBMIT_CONTENT_1/2`, auto-approve 7 hari. |
| 9 | Tracking tahapan (submit/revisi/approve/complete) | ✅ | ✅ | `getStateEnteredAtMap`, `DEADLINE_RULES`, bucket di `campaignData.js` & `collaborationData.js`. |
| 10 | Status update & reminder otomatis (shipping, tracking, due date, submission, approval, payment, review dua arah) | ⚠️ | ⚠️ | State machine-nya ada semua, **notifikasi/reminder-nya belum ada** (tidak ada email/webhook/notif in-app). Tracking number juga belum ada field-nya. |

Kesimpulan singkat: **sisi brand sudah ~80% memenuhi brief; sisi creator baru ~50%** — dan yang 50% itu bukan soal halaman kurang cantik, tapi ada satu loop yang putus.

---

## 2. Diagnosis: kenapa sisi creator terasa kosong

Screenshot "Collaborations" kosong itu bukan kebetulan — **memang tidak ada jalan bagi creator untuk mengisinya sendiri.**

Alur yang jalan hari ini hanya satu arah:

```
Brand → ExploreCreatorsPage → CreatorProfilePage → invite (sendInquiry ke listing package creator)
      → TransactionPage → request-payment → checkout → collaboration hidup ✅
```

Alur "apply" dari creator putus:

```
Creator → BrowseBriefsPage → BriefDetailPage → InquiryForm (pesan bebas)
        → inquiry di listing BRIEF milik brand
        → di transaksi itu creator = customer, brand = provider (role terbalik!)
        → tidak bisa pernah jadi collaboration berbayar ❌
```

Akibatnya:
- Tab **Applications** di `MyCollaborationsPage` adalah kuburan: masuk, lalu tidak ke mana-mana.
- Kolom **"Creators to approve"** di `ManageCampaignsPage` cuma angka, baris project tidak bisa diklik, tidak ada daftar pelamar, tidak ada tombol "hire".
- Filter **"Invited"** di `BrowseBriefsPage` di-disable — padahal brand *sudah* bisa mengundang. Undangan masuk ke inbox generic dan tidak muncul di dashboard creator.
- Creator bikin listing package lewat wizard generic `EditListingPage` (`routeName: 'NewListingPage'` di `creatorSetupSteps.js`) — satu-satunya tempat di seluruh produk yang keluar dari UI purpose-built.

Jadi ya, sisi creator memang harus diubah. Prioritasnya: **sambung dulu loop-nya, baru percantik dashboard.**

---

## 3. Rencana perubahan

### Fase 1 — Sambungkan loop hiring (paling kritis)

**1.1 Aplikasi terstruktur, bukan pesan bebas**
- `src/containers/BriefDetailPage/` — ganti `InquiryForm` dengan `ApplyToBriefForm` baru: pesan + pilih package listing sendiri + quote harga + estimasi turnaround.
- Simpan di `protectedData` inquiry: `{ applicationForBriefId, applicantListingId, quotedPrice, turnaroundDays }`.
- Guard: tolak apply kalau creator belum punya published package listing → arahkan ke `CreatorOnboardingPage`.

**1.2 Brand bisa melihat & menerima pelamar**
- Baru: `src/containers/ManageCampaignsPage/BriefApplicantsPage` (route `/campaigns/:id/applicants`), atau panel expand di `ProjectRow`.
- Daftar pelamar: avatar, rating, package, quote, pesan; tombol **Hire** dan **Decline**.
- **Hire** = brand memulai transaksi CGC UGC di listing package si creator (`sendInquiry` + `protectedData.inviteBriefId`, persis seperti `CreatorProfilePage.handleInviteSubmit`) lalu redirect ke checkout. Inquiry aplikasi yang lama ditandai `applicationStatus: 'accepted'` (atau `'declined'`) lewat transisi/`protectedData`.
- Ini menutup lubang di §2 tanpa menyentuh transaction process — role tetap benar (brand = customer).

**1.3 Undangan terlihat oleh creator**
- Tab **Invitations** di `MyCollaborationsPage` (atau aktifkan filter "Invited" di `BrowseBriefsPage`): inquiry CGC UGC di mana creator = provider dan state masih `inquiry`.
- Aksi: Accept (kirim pesan konfirmasi + tandai siap dibayar) / Decline.
- Status aplikasi di tab Applications: `Pending / Accepted / Declined`, bukan status transisi mentah.

### Fase 2 — Dashboard creator yang layak

**2.1 `MyCollaborationsPage` jadi home yang informatif**
- Empty state hari ini (screenshot) harus jadi CTA: "Belum ada kolaborasi → 3 brief cocok dengan niche-mu" + rekomendasi brief inline.
- Kartu ringkasan: tambah **Pending payout** dan **Rating rata-rata** di samping Active/Action needed/Total earned.
- Baris kolaborasi: tampilkan aksi berikutnya secara eksplisit ("Submit content", "Kirim revisi ke-1") — bukan cuma status.

**2.2 Halaman Earnings**
- Route `/earnings`: riwayat payout per kolaborasi, status Stripe, saldo pending vs released, link ke `StripePayoutPage`.
- Semua datanya sudah ada di `payoutTotal` + `stripeConnectAccount`; ini murni surface baru.

**2.3 Profil publik creator (self-view)**
- Creator tidak bisa melihat profilnya seperti yang dilihat brand. Tambah link "Preview my profile" → `CreatorProfilePage` mode read-only untuk pemilik listing.

### Fase 3 — Onboarding & kualitas

**3.1 Ganti wizard generic dengan `CreatorPackageForm`**
- `creatorSetupSteps.js` step `package`: `routeName: 'NewListingPage'` → halaman purpose-built (`/creator-onboarding/package`), sejajar dengan `PostBriefForm.js` di sisi brand: niche, platform, deliverable count, usage rights, turnaround, harga, `requiresProduct`.

**3.2 Portfolio**
- Field `portfolioLinks` / upload sample di package listing, tampil di `CreatorProfilePage`. Ini yang menjawab "quality over quantity" (brief #3) secara konkret.

**3.3 Status approval yang transparan**
- Step `approval` di onboarding sekarang pasif. Tambah state eksplisit: "Aplikasi diterima → sedang direview → disetujui", plus form aplikasi invite-only di landing (brief #1) yang menulis ke `privateData` user atau endpoint di `server/api/`.

### Fase 4 — Notifikasi & reminder (brief #10, dua sisi)

- Field tracking: `protectedData.trackingNumber` + `carrier` pada transisi `MARK_SHIPPED`, tampil di `StageTracker` dan tab Shipments.
- Email/notifikasi untuk: shipping confirmed, product delivered, due-date H-3, content submitted, revision requested, approved & paid, review reminder.
- Implementasi: template notifikasi di transaction process (Console) untuk yang berbasis transisi + endpoint di `server/` untuk reminder berbasis waktu. Ini pekerjaan Console, bukan hanya frontend — perlu dijadwalkan terpisah.

---

## 4. Urutan eksekusi yang disarankan

1. **Fase 1 penuh** — tanpa ini produk tidak bisa didemokan end-to-end dari sisi creator.
2. **Fase 3.1** (form package) — memblokir creator baru untuk sampai ke titik bisa di-hire.
3. **Fase 2.1 + 2.2** — bikin dashboard creator terasa hidup.
4. **Fase 4** — perlu akses Console + kerja backend, paralelkan.
5. **Fase 3.2/3.3 + 2.3** — polish kualitas & trust.

## 5. Yang belum diputuskan

- Apakah "Decline" aplikasi perlu transisi khusus di process, atau cukup flag di `protectedData`? (Flag lebih murah, tapi tidak muncul di activity feed.)
- Apakah harga kolaborasi mengikuti harga package creator, atau quote per-aplikasi bisa override? Kalau override, checkout harus pakai privileged transition dengan line item kustom di `server/api/transaction-line-items.js`.
- Invite-only: apakah pendaftar publik boleh signup lalu menunggu approval (pola sekarang), atau benar-benar hanya bisa lewat undangan (butuh sistem kode undangan)?
