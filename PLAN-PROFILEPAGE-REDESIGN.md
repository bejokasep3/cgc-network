# Implementation Plan — Redesign ProfilePage (`/u/:id`) mengikuti referensi "Provider's Profile"

Target file utama:

- `src/containers/ProfilePage/ProfilePage.js` (775 baris — presentasi dirombak total)
- `src/containers/ProfilePage/ProfilePage.module.css` (473 baris — tulis ulang)
- `src/containers/ProfilePage/ProfilePage.test.js` (assertion perlu disesuaikan)
- `src/translations/en.json` (tambah/hapus key)
- Komponen baru: `src/components/IconVerified/` (+ export di `src/components/index.js`)

**Boleh dibongkar habis.** Yang TIDAK boleh disentuh: `ProfilePage.duck.js`, `mapStateToProps`/`mapDispatchToProps`, dan seluruh blok guard akses (`isNotFoundError`, `NO_ACCESS_PAGE_*`, `isPreview`, storefront redirect) di `ProfilePageComponent` baris 577–643. Itu logika access-control Sharetribe, bukan tampilan.

---

## 0. Prinsip & keputusan yang sudah diambil

Referensi gambar adalah profil provider marketplace jasa. Di CGC satu halaman `/u/:id` dipakai dua role (brand & creator) dan dua sudut pandang (diri sendiri vs orang lain). Jadi layout referensi dipakai sebagai **kerangka**, isinya role-aware.

Keputusan yang sudah dikunci (jangan ditanya ulang, kerjakan saja):

| Elemen di gambar | Keputusan |
|---|---|
| "Book Now" button | Jadi CTA kontekstual, lihat §2.4 |
| "..." overflow menu | Dibuat, isinya "Save to roster" + "Copy profile link" |
| Verified badge di avatar | Dibuat, muncul kalau `isUserAuthorized(profileUser)` |
| "Rating / Category" dua kolom | Dibuat, tiap kolom auto-hide kalau datanya kosong |
| Judul review tebal ("Good Service") | **DIHAPUS** — Sharetribe review tidak punya field title, jangan dikarang |
| "Translate from Deutsch / Show original" | **DIHAPUS** — tidak ada layanan translasi |
| Availability Calendar (sidebar biru) | Diganti isi role-aware, lihat §4 |
| Ilustrasi bintang kiri/kanan skor | Dibuat sebagai inline SVG dekoratif (`aria-hidden`), desktop-only |

---

## 1. Struktur akhir file `ProfilePage.js`

Urutan named export (semua tetap `export` karena sebagian dipakai test):

```
IconVerifiedBadge        (wrapper kecil, opsional — atau langsung pakai IconVerified)
ProfileHeaderCard        (rombak total)
ProfileActionsMenu       (BARU — "..." dropdown)
AboutSection             (BARU — ganti blok inline di MainContent)
CustomUserFields         (TETAP, hanya pindah posisi + className baru)
ProfileListingsSection   (BARU — ganti blok listings inline)
ReviewScoreBox           (rombak: tambah ilustrasi + copy "Based on N reviews")
ProfileReviewItem        (BARU — pengganti komponen global <Reviews>)
ProfileReviewList        (BARU)
ProfileReviews           (tetap ada, isinya dirombak)
ReviewsErrorMaybe        (TETAP)
CollaborationHistoryMaybe(TETAP, hanya restyle CSS)
ProfileSidebar           (rombak, lihat §4)
MainContent              (rombak jadi tipis: rakit section)
ProfilePageComponent     (guard tetap, JSX bawah dirombak)
```

**Hapus:** `RosterSaveButtonMaybe` sebagai tombol berdiri sendiri — fungsinya pindah ke `ProfileActionsMenu`. Import `SecondaryButton` ikut dihapus kalau tidak terpakai lagi.

---

## 2. Header card

### 2.1 Layout
Grid/flex dua baris di dalam satu kartu `--colorGrey50`, `border-radius: 24px`, `padding: 24px 28px`:

```
[avatar 96px]  [ nama (h2, bold, 28px)          ]        [ ...  ] [ CTA ]
               [ lokasi (grey, 15px)            ]
               [ ─ meta row: kolom Rating | kolom Category ─ ]
```

- Mobile (`< --viewportMedium`): avatar + nama satu baris, meta row jadi kolom, tombol full-width di bawah.
- Avatar: `AvatarLarge` yang sudah ada, `disableProfileLink`, dibungkus `<div className={css.avatarWrapper}>` supaya badge bisa `position: absolute; right: 0; bottom: 0`.

### 2.2 Verified badge
Buat `src/components/IconVerified/IconVerified.js` + `.module.css` (ikuti pola `IconCheckmark`): lingkaran biru `var(--marketplaceColor)` dengan centang putih, `width/height` dari prop className. Export di `src/components/index.js` (baris ~20, jaga urutan alfabet: setelah `IconSuccess`).

Render badge hanya jika `isUserAuthorized(profileUser)` — `profileUser.attributes.state === 'active'`. Beri `title`/`aria-label` dari key `ProfilePage.verifiedBadgeLabel`.

### 2.3 Baris lokasi & kolom meta
Sumber data (semua opsional, hide kalau `null`):

- **Lokasi** → `publicData.location` (string bebas). Field ini **belum ada** di config user. Jangan bikin config baru — cukup baca `publicData.location ?? publicData.city ?? null`. Kalau kosong, baris tidak dirender.
- **Kolom "Rating"** → rata-rata review yang relevan (lihat §2.5) dirender sebagai: `<ReviewRating>` + teks `4.8` + link `<a href="#profile-reviews">` berisi `ProfilePage.reviewCount`. Section reviews di §5 harus punya `id="profile-reviews"`. Kalau `count === 0`, kolom tetap dirender dengan teks `ProfilePage.noRatingYet` (tanpa link).
- **Kolom "Category"** → role-aware:
  - creator (`userTypeRoles.provider`): ambil dari creator-profile listing-nya. `listings.find(l => l.attributes.publicData.listingType === 'creator-profile')` → `getCreatorFieldLabels(publicData, config.listing.listingFields)` dari `src/util/creatorFields.js` → gabung `nicheLabels` (maks 2, sisanya `+N`).
  - brand: `publicData.industry ?? null`. Kalau null, kolom di-hide dan cuma kolom Rating yang tampil.
  - Ikon kecil di kiri label (seperti gambar): pakai `IconLocation` untuk lokasi; untuk category cukup teks tanpa ikon (tidak ada ikon kategori generic di repo — jangan bikin baru untuk ini).

Label kolom (`Rating`, `Category`) pakai style uppercase kecil grey — key baru `ProfilePage.metaRatingLabel`, `ProfilePage.metaCategoryLabel`.

### 2.4 CTA utama (posisi "Book Now")
Tentukan dengan variabel `headerCta`, urutan prioritas:

1. `isCurrentUser && mounted` → `<NamedLink name="ProfileSettingsPage">` teks `ProfilePage.editProfileLinkDesktop` ("Edit profile"). **Wajib tetap di belakang `mounted`** — ini sudah begitu di kode lama supaya SSR dan hydration render sama; jangan dihilangkan.
2. `viewerIsBrand && isCreatorProfileUser && !isCurrentUser` dan creator-profile listing ketemu → `<NamedLink name="CreatorProfilePage" params={{ id: creatorProfileListing.id.uuid }}>` teks key baru `ProfilePage.collabCta` = `"Collab"`. Ini menyambung ke halaman invite yang sudah ada.
3. selain itu → tidak render CTA (jangan bikin tombol dummy).

Styling: pill `border-radius: 999px`, `background: var(--marketplaceColor)`, teks putih, `padding: 12px 28px`, hover `--marketplaceColorDark`. Reuse `.ctaButton` untuk semua varian.

### 2.5 Rating mana yang dipakai di header
Pertahankan logika lama: `userTypeRoles.provider ? reviewsOfProvider : reviewsOfCustomer` (`averageOf`). Jangan gabungkan dua tipe review jadi satu angka.

---

## 3. Kolom utama (main column)

Urutan section, semua dibungkus `<section className={css.section}>` dengan heading `h2` konsisten (`.sectionHeading`, 22px semibold):

1. **About** — heading dari key baru role-aware: `ProfilePage.aboutTitleBrand` (`"About brand"`) / `ProfilePage.aboutTitleCreator` (`"About provider"`). Isi = `bio` yang sudah lewat `richText(...)`.
   - Perubahan perilaku: kalau `bio` kosong, section **tetap dirender** dengan placeholder `ProfilePage.aboutEmpty` (grey italic) — bukan disembunyikan seperti sekarang. Referensi selalu menampilkan blok ini.
2. **Details** — `<CustomUserFields>` apa adanya. Cuma ganti `rootClassName` supaya spacing seragam.
3. **Listings** — lihat §3.1.
4. **Reviews & ratings** — lihat §5.

### 3.1 Section listings
Sekarang label hardcoded `"My listings ({count})"` padahal juga tampil saat melihat profil orang lain (bug kecil yang ikut diperbaiki). Ganti jadi:

- Filter dulu: `const visibleListings = listings.filter(l => !l.attributes.deleted && l.attributes.state === 'published')`.
- Heading role-aware + POV-aware, 4 key baru:
  - creator + diri sendiri → `ProfilePage.listingsTitleOwnCreator` = `"My packages ({count})"`
  - creator + orang lain → `ProfilePage.listingsTitleCreator` = `"Packages ({count})"`
  - brand + diri sendiri → `ProfilePage.listingsTitleOwnBrand` = `"My briefs ({count})"`
  - brand + orang lain → `ProfilePage.listingsTitleBrand` = `"Open briefs ({count})"`
- Hapus key lama `ProfilePage.listingsTitle`.
- Kalau `visibleListings.length === 0` → section tidak dirender (sama seperti sekarang).
- Tetap pakai `<ListingCard listing={l} showAuthorInfo={false} />`, tapi grid CSS diganti dari margin-hack `nth-of-type` ke `display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px` (1 kolom di mobile). Hapus semua aturan `.listing:nth-of-type(...)` lama.

---

## 4. Sidebar

Slot sidebar di gambar diisi kartu berwarna. Isi kartu ditentukan begini (pertama yang cocok menang):

1. **Brand melihat profil creator** (`showCollaborationHistory`, kondisi lama tetap) → `CollaborationHistoryMaybe` seperti sekarang, tapi restyle jadi kartu gradient (§4.1).
2. **Selain itu** → sidebar tidak dirender, dan `.main` mengambil lebar penuh (`.layout` sudah flex, `.main` `flex: 1 1 auto` — cukup pastikan tidak ada `width` mati di `.main`).

Artinya untuk kasus di screenshot user (brand melihat profil sendiri) halaman jadi satu kolom penuh — itu disengaja, jangan diisi kartu placeholder.

### 4.1 Styling kartu sidebar
Mengikuti nuansa gambar tanpa mengarang fitur:
```css
.sidebarCard {
  border-radius: 24px;
  padding: 24px;
  background: linear-gradient(160deg, hsl(226 100% 94%) 0%, hsl(210 100% 97%) 100%);
}
```
Judul putih-gelap `--colorGrey900`, item list di dalam kartu putih `border-radius: 16px`. Sticky `top: 24px` di desktop (sudah ada).

---

## 5. Section "Reviews & ratings"

`id="profile-reviews"` di elemen `<section>` (target anchor dari header).

### 5.1 Tab tipe review
Pertahankan logika `availableTypes` yang ada (tab hanya muncul kalau user punya dua role). Restyle pill-nya saja.

### 5.2 Score box (`ReviewScoreBox`)
Rombak jadi seperti gambar:
```
[ ✦ svg ]     4.8
              ★★★★★              [ ✦ svg ]
        (Based on 120 reviews)
```
- Kontainer: `background: var(--colorGrey50)`, `border-radius: 20px`, `padding: 32px`, konten center.
- Angka: 40px bold.
- Copy count pakai key yang sudah ada `ProfilePage.reviewScoreCount` (`"Based on # reviews"`) — sudah cocok, jangan diubah.
- Dua SVG starburst dekoratif (stroke `--colorGrey900`, `fill: none`, ~72px), `aria-hidden="true"`, `display: none` di mobile.
- Kalau tidak ada review: render `.reviewScoreEmpty` (`ProfilePage.noRatingYet`) saja, tanpa ilustrasi.

### 5.3 Daftar review — jangan pakai `<Reviews>` global
Komponen `src/components/Reviews/Reviews.js` juga dipakai `CreatorProfilePage.js:274` dan `ListingPage/SectionReviews.js:20`. Mengubahnya akan merembet. **Buat `ProfileReviewItem` + `ProfileReviewList` lokal di ProfilePage.js**, hapus import `Reviews` dari `../../components`.

Markup per item (sesuai gambar, minus title & translate):
```
[avatar 40px] Sarah M.                    ★ 5.0   1 year ago
              Anna was professional and very thorough...
```
- Nama: `<UserDisplayName user={review.author} intl={intl} />` (import dari `../../components`).
- Rating: satu bintang `IconReviewStar` (atau `ReviewRating` dengan 1 bintang penuh) + angka `review.attributes.rating.toFixed(1)`.
- Waktu relatif: buat helper lokal di ProfilePage.js
  ```js
  // Jarak "1 year ago" seperti di referensi. Intl.RelativeTimeFormat lewat
  // intl.formatRelativeTime; pilih unit terbesar yang nilainya >= 1.
  const relativeTime = (date, intl) => { ... }  // detik→menit→jam→hari→bulan→tahun
  ```
  Jangan tambah dependency baru (`moment` sudah dibuang di commit `4ee87642b`). `intl.formatRelativeTime` tersedia dari react-intl yang dipakai repo.
- Pemisah antar item: `border-bottom: 1px solid var(--colorGrey100)`, item terakhir tanpa border.
- Empty state: kalau list tipe aktif kosong → `<p className={css.noReviews}>` dengan key `ProfilePage.noRatingYet` (sudah ada).

---

## 6. Translations (`src/translations/en.json`)

File tersortir alfabetis — sisipkan pada posisi yang benar di blok `ProfilePage.*` (baris ~1166–1193).

**Tambah:**
```
"ProfilePage.aboutEmpty": "No description yet.",
"ProfilePage.aboutTitleBrand": "About brand",
"ProfilePage.aboutTitleCreator": "About provider",
"ProfilePage.collabCta": "Collab",
"ProfilePage.copyProfileLink": "Copy profile link",
"ProfilePage.listingsTitleBrand": "Open briefs ({count})",
"ProfilePage.listingsTitleCreator": "Packages ({count})",
"ProfilePage.listingsTitleOwnBrand": "My briefs ({count})",
"ProfilePage.listingsTitleOwnCreator": "My packages ({count})",
"ProfilePage.metaCategoryLabel": "Category",
"ProfilePage.metaLocationLabel": "Location",
"ProfilePage.metaRatingLabel": "Rating",
"ProfilePage.moreActions": "More actions",
"ProfilePage.verifiedBadgeLabel": "Verified member",
```

**Hapus:** `ProfilePage.aboutTitle`, `ProfilePage.listingsTitle`.

**Cek dulu sebelum hapus:** `ProfilePage.desktopHeading`, `ProfilePage.mobileHeading`, `ProfilePage.editProfileLinkMobile` sudah tidak dipakai di kode manapun (`grep -rn "ProfilePage.desktopHeading" src/`). Kalau memang yatim, hapus sekalian.

`ProfilePage.saveToRoster` / `ProfilePage.removeFromRoster` **tetap dipakai** (pindah ke dalam menu "...").

---

## 7. `ProfileActionsMenu` ("..." button)

Pakai komponen yang sudah ada: `Menu`, `MenuLabel`, `MenuContent`, `MenuItem` dari `../../components` (lihat pola pemakaian di `TopbarDesktop` untuk contoh props).

Isi menu (render item hanya kalau relevan; kalau tidak ada satu pun item → menu tidak dirender sama sekali):
- `showRosterButton` → item toggle roster, teks `ProfilePage.saveToRoster` / `ProfilePage.removeFromRoster`, `onClick={handleToggleSavedCreator}`, disabled saat `toggleInProgress` (tampilkan `IconSpinner` inline).
- Selalu (kalau menu dirender) → "Copy profile link": `navigator.clipboard.writeText(window.location.href)`, dibungkus `typeof window !== 'undefined'` guard karena halaman ini SSR.

MenuLabel isinya tiga titik (`⋯` sebagai teks atau SVG 3 dot inline), styling: lingkaran/pill putih `border: 1px solid var(--colorGrey100)`, 44px, di samping kiri CTA.

---

## 8. CSS — tulis ulang `ProfilePage.module.css`

**Pertahankan apa adanya** blok `/* Custom field component classes */` (baris 315–400: `.text`, `.ingress`, `.sectionMultiEnum`, `.sectionDetails`, `.sectionEmbeddedYoutubeVideo`, `.details`, `.detailsRow`, `.detailLabel`, `.video`, `.iframe`, `.userFieldSection`). Class-class itu dikonsumsi `CustomExtendedDataSection` lewat `css.*`; menghapusnya merusak render custom field.

**Hapus:** `.editButton` (diganti `.ctaButton`), `.rosterButton`, `.rosterButtonSpinner`, `.listing` beserta aturan `nth-of-type`, `.roleLabel` (role sekarang ditampilkan di kolom Category, bukan label terpisah).

**Tambah/rombak:** `.pageHeading` (48px bold seperti gambar, sudah `composes: h1`), `.headerCard`, `.avatarWrapper`, `.verifiedBadge`, `.headerMain`, `.name`, `.locationRow`, `.metaRow`, `.metaColumn`, `.metaLabel`, `.metaValue`, `.headerActions`, `.moreButton`, `.ctaButton`, `.section`, `.sectionHeading`, `.bio`, `.bioEmpty`, `.listingsGrid`, `.reviewScoreBox` + `.reviewScoreDecoration`, `.reviewItem`, `.reviewHeaderRow`, `.reviewAuthor`, `.reviewMeta`, `.reviewBody`, `.sidebarCard`.

Token yang dipakai (jangan hardcode hex baru selain gradient sidebar): `--colorGrey50/100/500/600/700/900`, `--marketplaceColor`, `--marketplaceColorDark`, `--fontWeightSemiBold/Bold`, `--borderRadiusMedium`, `--transitionStyleButton`. Breakpoint lewat `@media (--viewportMedium)` (`@import '../../styles/customMediaQueries.css'` sudah ada di baris 1 — pertahankan).

---

## 9. Test — `ProfilePage.test.js`

Jalankan `yarn test src/containers/ProfilePage` setelah perubahan. Yang pasti pecah dan harus diupdate:

1. `'Check that listing information is shown correctly'` → `screen.getByText('ProfilePage.listingsTitle')` ganti ke key baru. Fixture test memakai `userType: 'a'` (= Seller/provider) dan bukan current user? Cek `isCurrentUser`: `currentUser` dan `user` sama-sama id `'userId'` → **ini kasus "own profile"**, jadi key yang benar `ProfilePage.listingsTitleOwnCreator`.
2. `'Check that review information is shown correctly'` → `expect(screen.getAllByTitle('3/5')).toHaveLength(4)` akan berubah. Setelah rombak: header card 1× + score box 1× + item review (sekarang cuma satu rating, bukan mobile+desktop) 1× = **3**. Verifikasi angka aslinya dari hasil run, jangan asal tulis.
3. Assertion `screen.getByText('reviewerA display name')` dan `'March 2024'` → nama tetap lolos; **`'March 2024'` akan gagal** karena format berubah jadi relative time. Ganti assertion tanggal jadi mengecek elemen relative time, atau hapus assertion tanggal itu dan tambahkan assertion pada konten review.
4. Blok `describe('Duck')` **tidak boleh berubah** — kalau ada yang merah di situ berarti ada duck yang tidak sengaja tersentuh.

Tambahan test yang layak ditulis (opsional tapi disarankan): render dengan `userType` brand + `currentUser` berbeda id, pastikan CTA "Edit profile" tidak muncul dan heading `ProfilePage.pageHeadingBrand` muncul.

---

## 10. Urutan pengerjaan yang disarankan

1. `IconVerified` + export di `components/index.js`.
2. Tambah/hapus key di `en.json`.
3. Tulis ulang `ProfilePage.module.css` (sisakan blok custom-field).
4. Rombak `ProfilePage.js` bagian per bagian: header card → about/details → listings → reviews → sidebar → rakit di `ProfilePageComponent`.
5. `yarn test src/containers/ProfilePage`, perbaiki assertion.
6. Cek manual: profil brand sendiri, profil creator dilihat brand (CTA Collab + menu roster + sidebar history), profil dilihat tanpa login/private-marketplace guard.

## 11. Yang sengaja TIDAK dikerjakan

- Kalender availability & time slot (tidak ada model data availability untuk brand/creator di CGC).
- Judul review dan fitur translate review.
- Field `location`/`industry` baru di Sharetribe Console — halaman hanya membaca kalau kebetulan ada di `publicData`. Kalau nanti mau ditampilkan pasti, field-nya harus ditambah dulu di hosted user fields + `ProfileSettingsForm`; itu pekerjaan terpisah.
