# BLUEPRINT — The CGC Network

> **Dokumen inti proyek ini.** Diturunkan dari brief klien, bukan dari kode yang
> sudah ada. Kalau ada dokumen lain, komentar di kode, atau implementasi yang
> bertentangan dengan file ini, **file ini yang menang** — yang lain yang harus
> menyesuaikan.
>
> Versi 1.1 · 1 Agustus 2026 · sumber: percakapan klien (Cailyn Medley)
> + jawaban klarifikasi dari pemilik proyek.
>
> Perubahan v1.1: `D2` diperbaiki — harga dipasang brand di proyek, creator
> mengajukan penawaran (bukan creator yang menetapkan harga dari nol). `D6` dan
> Lampiran A3 diperbaiki agar sesuai cara kerja access control Sharetribe yang
> sebenarnya.
>
> Versi web dengan diagram (isi sama):
> <https://claude.ai/code/artifact/6272a705-60ac-4993-b729-00cfd4b5c120>

---

## 0. Cara memakai dokumen ini

- **Bagian 1** adalah kebutuhan mentah dari klien, diberi kode `R1`–`R19`. Setiap
  keputusan dan setiap halaman di dokumen ini menunjuk balik ke kode itu. Kalau
  sebuah fitur tidak bisa ditelusuri ke salah satu `R`, fitur itu tidak masuk v1.
- **Bagian 2** adalah keputusan yang sudah dikunci (`D1`–`D8`). Jangan dibuka
  ulang tanpa alasan baru. Kalau dibuka ulang, catat alasannya di sini.
- **Bagian 13** adalah jarak antara blueprint ini dengan kode yang sekarang ada
  di repo. Rencana kerjanya yang terperinci ada di
  [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) — dokumen itu yang dipakai
  saat mengeksekusi; blueprint ini yang dipakai saat memutuskan.
- **Lampiran B** adalah yang masih menunggu jawaban klien. Jangan ditebak
  diam-diam — kalau harus jalan duluan, tulis asumsinya di situ.

Konvensi bahasa: dokumen berbahasa Indonesia, tapi nama entitas, field, state,
dan rute tetap bahasa Inggris supaya cocok dengan kode.

---

## 1. Kebutuhan dari brief

| # | Kata klien | Artinya secara sistem |
|---|---|---|
| R1 | premium, **invite-only** | Ada gerbang masuk. Dua jalur: lamaran terbuka yang diseleksi, dan kode undangan untuk creator yang direkrut langsung. |
| R2 | menghubungkan **vetted** creator dengan brand | Creator dinilai sebelum tampil. Butuh bahan penilaian, bukan sekadar tombol setujui. |
| R3 | brand **me-lisensi** UGC berkualitas | Yang dijual adalah hak pakai konten. Setiap kolaborasi menghasilkan catatan lisensi. |
| R4 | kualitas di atas kuantitas | Katalog dijaga kecil. Rasio brand : creator dipantau. |
| R5 | **carefully approving** creators | Antrean peninjauan manual + alat kerja operator. |
| R6 | **transparent** partnerships | Harga, jumlah aset, tenggat, hak pakai, jatah revisi terkunci di muka dan terlihat dua pihak. |
| R7 | alur mulus **dari pembuatan proyek** sampai pengiriman konten | Proyek adalah titik awal alur. Ini kalimat penentu arsitektur. |
| R8 | brand **berlangganan** | Pendapatan berulang, terpisah dari transaksi. |
| R9 | **post projects** | Brand menulis brief kampanye lengkap, berikut harga yang ditawarkan. |
| R10 | **browse creator profiles** | Direktori dengan filter yang sedimensi dengan brief. |
| R11 | **invite creators** to collaborate | Undangan ke orang tertentu untuk proyek tertentu, punya status sendiri. |
| R12 | **manage deliverables** | Aset dikelola satu per satu sebagai objek, bukan tumpukan tautan. |
| R13 | **review submitted content** | Ruang tinjau tempat aset benar-benar bisa dilihat. |
| R14 | hubungan jangka panjang lewat **trusted review system** | Reputasi terakumulasi + roster + pesan ulang. |
| R15 | setujui atau minta revisi, **maksimal dua kali** | Penghitung revisi ditegakkan sistem, dan ada jalan keluar setelah jatah habis. |
| R16 | alur **jelas melacak setiap tahap** | Pelacak tahap yang dibaca manusia, terlihat dua pihak. |
| R17 | shipping confirmation · tracking · delivery confirmation | Alur produk fisik, arahnya **brand → creator**. Sebagian proyek tidak butuh ini. |
| R18 | **due date reminders** | Pengingat dihitung dari tanggal yang disepakati, bukan dari lama sebuah status berjalan. |
| R19 | **final payment** · **two-way public reviews** | Pembayaran dilepas di akhir; dua ulasan publik terbit bersamaan. |

Bagian brief yang sempat terpotong di tangkapan layar (*"What We Need Built — we're
looking for a developer who can build a reliable…"*) sudah dikonfirmasi pemilik
proyek: lanjutannya adalah **content approval workflow**, yaitu `R15`/`R16` yang
sudah tercatat di atas. **Tidak ada kebutuhan tersembunyi.**

---

## 2. Keputusan yang sudah dikunci

### D1 — Proyek adalah tulang punggung, penawaran adalah objek yang dibayar
`R7 R9 R11`

Brand menulis **proyek**. Creator melamar atau diundang, lalu mengirim
**penawaran** untuk proyek itu. Penawaran yang diterima brand itulah yang dibayar.

Ditolak: model katalog (creator memajang paket berharga tetap, brand langsung
checkout). Model itu membalik urutan brief dan membuat "post project → invite →
manage deliverables" tidak punya rumah.

Ditolak juga: keluar dari Sharetribe. Mesin escrow, payout, sengketa, dan
kepatuhan yang sudah matang tidak sepadan untuk dibangun ulang.

### D2 — Brand memasang harga di proyek; creator boleh mengajukan penawaran
`R6 R9`

**Brand memasang satu angka harga** saat menulis proyek — bukan rentang. Itu yang
tampil di papan proyek dan itu yang jadi titik awal.

Creator punya dua cara melamar:

1. **Terima harga yang dipasang.** Satu klik, tanpa tawar-menawar. Ini jalur
   normal dan harus jadi tombol yang paling menonjol.
2. **Ajukan harga lain.** Satu angka berbeda plus alasan singkat ("lingkupnya
   butuh 2 hari syuting tambahan"). Muncul sebagai tautan kecil di bawah tombol
   utama, bukan sebagai pilihan setara.

Brand boleh menerima, menolak, atau **mengajukan harga balasan satu kali**.
Creator menerima atau menolak. Negosiasi berhenti di situ — **maksimal dua
putaran**, dan setiap putaran punya batas waktu (usul: 3 hari, lalu lamaran
kedaluwarsa).

Brand boleh mengunci harga saat membuat proyek: *"harga tetap, tidak menerima
penawaran"*. Kalau dikunci, tautan ajukan harga tidak muncul sama sekali.

**Kenapa dibatasi dua putaran:** tawar-menawar terbuka mengubah marketplace jadi
ruang negosiasi, dan itu bertabrakan langsung dengan `R6` (transparan) — brand
tidak akan pernah tahu harga sebenarnya sebelum mengobrol panjang. Dua putaran
cukup untuk menyesuaikan lingkup, tanpa membuat harga jadi kabur.

**Tarif indikatif di profil creator** tetap ada ("mulai dari …"), tapi fungsinya
hanya sinyal buat brand saat memilih siapa yang diundang — bukan harga yang
mengikat.

Implikasi teknis (tidak berubah, dan tetap yang paling penting): harga transaksi
**tidak boleh** diambil dari harga listing creator. Harga yang disepakati —
entah harga asli proyek atau hasil penawaran — dihitung di server lewat
*privileged transition* + line item kustom (`server/api/transaction-line-items.js`).
Ini jalur resmi Sharetribe untuk harga yang berbeda dari harga listing.

Catatan implementasi: template ini sudah punya komponen `MakeOfferPage`,
`MakeCounterOfferModal`, dan `Offer` (bawaan proses `default-negotiation`).
Polanya bisa dipinjam untuk UI penawaran ini tanpa memakai prosesnya.

### D3 — Dana ditahan penuh di muka, dilepas saat konten disetujui
`R19`

"Final payment" berarti pelepasan dana di akhir, bukan pelunasan setelah uang
muka. Tidak ada pembayaran bertahap di v1.

Di layar creator harus tertulis eksplisit bahwa **pembayaran sudah diamankan**
sejak kolaborasi dimulai — itu yang membuat creator berani mulai bekerja.

### D4 — Setelah dua revisi habis, tim CGC yang memutuskan
`R15`

Di tahap `content-submitted-revised-2`, brand hanya punya dua tombol:
**Setujui** atau **Eskalasi ke tim CGC**. Operator memutuskan salah satu dari
dua: konten diterima dan creator dibayar, atau dana dikembalikan penuh ke brand.

Tidak ada revisi ketiga. Tidak ada revisi berbayar di v1. UI wajib menjelaskan
kenapa tombol revisi hilang — bukan menghilangkannya diam-diam.

### D5 — Yang dikunci langganan, dan yang tetap terbuka
`R8`

| Aksi | Butuh langganan aktif? |
|---|---|
| Menjelajah direktori & melihat portofolio | Tidak |
| Memposting proyek | Ya |
| Mengundang creator | Ya |
| Membuka kontak / memulai percakapan | Ya |
| Menerima penawaran & membayar | Ya |
| **Melanjutkan kolaborasi yang sedang berjalan** | **Tidak** |
| Mengakses pustaka konten & catatan lisensi lama | Tidak, selamanya |

Alasan dua baris terakhir: dananya sudah ditahan dan creator sudah bekerja —
menghentikan kolaborasi di tengah karena langganan lewat tanggal adalah cara
tercepat kehilangan kepercayaan kedua pihak sekaligus. Yang hilang saat langganan
berhenti hanyalah kemampuan **memulai** yang baru.

Harga dan jumlah tingkatan paket: menunggu klien (Lampiran B).

### D6 — Konsol operator dibangun di dalam platform; Console tetap dipakai untuk konfigurasi
`R2 R5 R15`

Pembagiannya:

| Pekerjaan | Di mana |
|---|---|
| Meninjau lamaran creator (lihat portofolio, handle sosial, lalu setujui/tolak) | **Konsol operator di platform** |
| Meninjau permintaan akses brand | **Konsol operator di platform** |
| Meja mediasi sengketa | **Konsol operator di platform** |
| Membuat kode undangan | **Konsol operator di platform** |
| Papan kesehatan jaringan | **Konsol operator di platform** |
| Konfigurasi listing type, field, search index | Sharetribe Console |
| Konten CMS landing page & teks email | Sharetribe Console |
| Branding (logo, warna) | Sharetribe Console |
| Transaction process (push versi & alias) | Sharetribe CLI |
| Tagihan & pengaturan marketplace | Sharetribe Console |

Alasannya: Sharetribe Console memang bagus untuk konfigurasi, dan itu wajar jadi
alasan klien memilih Sharetribe. Tapi untuk **kerja harian** — melihat tiga
contoh karya lalu memutuskan terima/tolak — Console terlalu umum: ia menampilkan
entitas mentah, bukan lamaran. Operator harian tidak seharusnya membaca
`publicData` untuk menilai seorang creator.

**Yang penting dipahami sebelum membangunnya:** konsol operator kita **tidak
membuat sistem akses sendiri**. Gerbang aksesnya tetap milik Sharetribe, dan
hanya ada dua:

| Mekanisme | Nilai | Efeknya |
|---|---|---|
| `user.attributes.state` | `pending-approval` · `active` · `banned` | Gerbang utama. `isUserAuthorized()` di `src/util/userHelpers.js` memakai ini untuk mengunci hampir semua surface |
| `effectivePermissionSet` | `read`, `postListings`, `initiateTransactions` — masing-masing allow/deny | Izin lebih halus per user; nilai awalnya diatur tiga checkbox "Restrict … rights" di Console |

Artinya benar bahwa persetujuan Sharetribe **tidak menahan orang di luar
platform**: akun tetap dibuat, tetap bisa login, tetap bisa melihat-lihat — yang
dikunci adalah memposting listing dan memulai transaksi. Itu justru cocok dengan
blueprint ini: pelamar boleh menjelajah sambil menunggu (`D5` memang membuat
menjelajah gratis), dan yang dikunci adalah hal-hal yang memang butuh vetting.

Jadi konsol operator kita adalah **kokpit yang lebih baik di atas saklar yang
sama**: halaman `/admin/*` dibatasi role operator, memanggil server sendiri, yang
memanggil **Integration API** untuk mengubah `state` dan `effectivePermissionSet`
(Integration API adalah API server-to-server berhak penuh — kunci rahasianya
tidak boleh menyentuh frontend). Yang kita tambahkan adalah **konteks
penilaiannya** — portofolio, handle sosial, jawaban formulir — yang memang tidak
ada di Console karena kita sendiri yang mengumpulkannya.

Sebelum membangun, verifikasi endpoint persetujuan user dan listing di referensi
Integration API. Kalau ternyata tidak tersedia, jatuhkan **hanya tombol
persetujuannya** ke Console; antrean dan tampilan penilaian tetap dibangun di
platform, karena di situlah nilai tambahnya.

Konfigurasi Console yang menyertainya ada di Lampiran A3 — termasuk satu setelan
yang sekarang belum dipakai dan justru menjadi kaitnya: **call to action** pada
halaman persetujuan.

### D7 — Bahasa produk bukan bahasa mesin
`R6`

Di layar tidak boleh muncul kata **listing**, **order**, **transaction**,
**inquiry**, atau nama state mentah. Yang dipakai: **project**, **invitation**,
**offer**, **collaboration**, **deliverable**, **license**.

Ini bukan kosmetik. Marketplace yang membocorkan istilah mesinnya langsung
terbaca murah, dan yang klien beli adalah kata "premium".

### D8 — Setiap tahap wajib punya pintu keluar otomatis
`R16`

Tidak boleh ada keadaan di mana dana tertahan tanpa batas waktu. Yang paling
penting: **brand yang mendiamkan konten → otomatis disetujui dan creator
dibayar**. Tanpa aturan ini, mendiamkan menjadi cara gratis untuk tidak
membayar. Semua batas waktu harus tertulis di layar, bukan kejutan.

---

## 3. Model domain

```
BRAND ──< PROJECT ──< INVITATION >── CREATOR
             │   └──< APPLICATION >──┘
             │
             └──> OFFER (dari creator, untuk proyek ini)
                     │ diterima brand + dibayar
                     ▼
                 COLLABORATION ──< DELIVERABLE ──< SUBMISSION ──< REVISION_REQUEST
                     ├── SHIPMENT (opsional)
                     ├── ESCROW
                     ├── REVIEW × 2
                     └── LICENSE (terbit saat selesai)
```

Objek dan field intinya:

| Objek | Field penting | Tinggal di mana |
|---|---|---|
| `PROJECT` | judul, brief, **price**, priceNegotiable, niche, platforms, contentDueDate, requiresProduct, usageRights, deliverables, status | Listing tipe `project` milik brand — `price` di atribut harga listing, sisanya `publicData` |
| `INVITATION` | projectId, creatorId, status (sent/seen/accepted/declined/expired), expiresAt | Transaksi *inquiry* + `protectedData` |
| `APPLICATION` / `OFFER` | projectId, listedPrice, proposedPrice, counterPrice, agreedPrice, negotiationRound, readyByDate, scope, note | Transaksi *inquiry* + `protectedData` |
| `COLLABORATION` | agreedPrice, deliverables[], shipping{}, revisionCount, tanggal-tanggal | Transaksi `cgc-ugc-approval` + `protectedData` |
| `DELIVERABLE` | id, type, platform, spec, status, versions[] | Array di `protectedData` transaksi |
| `LICENSE` | snapshot kesepakatan saat disetujui | Diturunkan dari `protectedData`, dirender sebagai halaman + unduhan |
| `REVIEW` | rating, isi, arah | Entitas review Sharetribe |

Aturan keras: entitas inti (user, listing, transaksi, review, payout) **wajib**
lewat Marketplace API dan mesin transisinya. Data khusus CGC menumpang sebagai
extended data di entitas itu — bukan tabel sendiri, kecuali memang tidak bisa
dipetakan sama sekali.

---

## 4. Arsitektur di atas Sharetribe

Kendala keras: uang selalu mengalir dari pembeli ke **pemilik listing**. Karena
creator yang dibayar, objek yang dibeli harus milik creator. Sementara proyek
milik brand. Pemetaannya:

| Konsep produk | Wujud di Sharetribe |
|---|---|
| Proyek | Listing tipe `project`, milik brand, **berharga tapi tidak bisa dibeli** (proses inquiry). Harganya adalah angka yang ditawarkan brand, bukan sesuatu yang di-checkout |
| Profil creator | Listing tipe `creator-profile`, milik creator — **kartu tarif indikatif, bukan produk berharga tetap** |
| Undangan / lamaran / penawaran harga | Transaksi tahap *inquiry* di listing creator, membawa `projectId` + riwayat penawaran di `protectedData` |
| Menerima lamaran + membayar | `transition/request-payment-after-inquiry` dengan **line item dihitung server** dari `agreedPrice` |
| Kolaborasi | Transaksi `cgc-ugc-approval` yang sama, setelah pembayaran |
| Lisensi | Turunan dari `protectedData` transaksi saat masuk state `received` |

**Kenapa creator tidak perlu membuat listing baru per proyek:** cukup satu
listing profil sebagai kartu tarif. Harga sebenarnya datang dari penawaran dan
diterapkan di server saat checkout. Ini menghindari banjir listing dan antrean
persetujuan yang tidak ada gunanya.

**Kabar baiknya soal mesin transaksi:** proses `cgc-ugc-approval` yang sudah ada
di `ext/transaction-processes/` **tidak perlu ditulis ulang**. Escrow, alur
pengiriman, dua revisi, persetujuan otomatis, mediasi, pembatalan bertingkat, dan
ulasan dua arah semuanya sudah sesuai blueprint ini. Yang berubah ada di lapisan
atasnya: apa yang dibeli, bagaimana harga terbentuk, dan bagaimana deliverable
dikelola.

---

## 5. Siklus hidup proyek

```
Draf ─> Terbuka ─> Pencocokan ─┬─> [bayar] ─> Disepakati ─┬─> (butuh produk) Alamat ─> Dikirim ─> Diterima ─┐
                               │                          │                                                 ├─> Produksi
                               └─> Ditutup tanpa hasil     └─> (tanpa produk) ──────────────────────────────┘
                                                                                                             │
   Konten dikirim <──────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ├─ brand minta revisi (jatah 1) ─> Revisi 1 ─> Konten dikirim ulang
        ├─ brand minta revisi (jatah 2) ─> Revisi 2 ─> Konten dikirim ulang   [terakhir]
        ├─ brand diam sampai batas ──────────────────> Disetujui otomatis
        ├─ jatah habis & tidak cocok ────> Mediasi CGC ─> menang creator: dibayar
        │                                              └─> menang brand: refund penuh
        └─ brand setujui ───────────────────────────> Disetujui: dana dilepas
                                                              │
                                                    Lisensi terbit + aset diarsipkan
                                                              │
                                                    Ulasan dua arah ─> Selesai
```

Setiap tahap punya **tepat satu** pemilik — siapa yang sedang ditunggu. Itulah
yang membuat alur terasa "clearly tracked" (`R16`).

Batas waktu yang berlaku (semua wajib tertulis di layar):

| Situasi | Batas | Akibat |
|---|---|---|
| Checkout menggantung | 15 menit | Batal, dana kembali |
| Barang dikirim, creator diam | 7 hari | Dianggap diterima, proyek lanjut |
| Sudah dibayar, tidak ada gerakan | 14 hari | Batal, refund penuh |
| Barang diterima, konten tak datang | 21 hari | Batal, refund penuh |
| **Konten dikirim, brand tidak merespons** | **7 hari** | **Otomatis disetujui, creator dibayar** |
| Revisi diminta, creator diam | 14 hari | Batal, refund penuh |
| Sengketa tanpa keputusan operator | 60 hari | Refund penuh |
| Masa ulasan | 7 hari | Ulasan terbit / masa habis |

Arah pengiriman: **brand (pembeli) → creator (penjual)**, kebalikan dari
marketplace biasa. Fitur pickup/shipping bawaan Sharetribe **harus tetap
dimatikan** pada listing creator; kalau dinyalakan, ongkos kirim akan ditagihkan
ke brand lalu dibayarkan ke creator, dan alamat yang tampil justru alamat brand
sendiri. Alamat creator dikumpulkan lewat langkah tersendiri.

---

## 6. Alur Brand

| # | Halaman | Rute | Yang diisi / dilakukan | Kenapa |
|---|---|---|---|---|
| B1 | Landing | `/` | Melihat proposisi, contoh karya nyata, dua pintu masuk terpisah | Peran menentukan seluruh sisa pengalaman; menanyakannya di klik pertama jauh lebih murah daripada menebak |
| B2 | Permintaan akses | `/request-access` | Nama perusahaan, situs, email kerja, kategori produk, volume konten per bulan, rentang budget, dari mana tahu CGC | Bahan penilaian operator sekaligus data prospek. Brand volume nol tidak akan memperpanjang langganan |
| B3 | Menunggu | `/pending` | — | Sebut angka ("biasanya 2 hari kerja"). Menunggu tanpa batas terasa seperti ditolak |
| B4 | Langganan | `/subscription` | Pilih paket, bayar lewat Stripe | Gerbang dipasang saat brand sudah menginginkan sesuatu, bukan di pintu masuk |
| B5 | Direktori creator | `/creators`, `/creators/:id` | Menjelajah, memfilter, melihat portofolio | Portofolio dulu, identitas kedua, harga terakhir — urutan visual adalah argumen posisi pasar |
| B6 | Buat proyek | `/projects/new` | Judul, brief, **daftar deliverable yang diminta**, hak pakai, tenggat konten, **harga yang ditawarkan** + apakah menerima penawaran, perlu kirim produk?, niche, platform | Semua yang bisa jadi sengketa di belakang, tanyakan di sini. Form ini menggantikan sepuluh pesan bolak-balik. Harga satu angka (bukan rentang) supaya creator bisa memutuskan sekali lihat |
| B7 | Undang creator | `/projects/:id/invite` | Pilih creator (dari direktori atau saran otomatis), kirim undangan berisi konteks proyek | Undangan berstatus: terkirim → dilihat → diterima/ditolak → kedaluwarsa. Tanpa status, brand tidak tahu harus menunggu atau mencari orang lain |
| B8 | Bandingkan pelamar | `/projects/:id` | Melihat semua lamaran & undangan sebagai kartu setara: portofolio, harga, tanggal siap, rating, catatan. Pelamar yang menerima harga apa adanya ditandai jelas; yang mengajukan harga lain menampilkan selisihnya + alasan, dengan tombol **terima** atau **ajukan harga balasan** (sekali) | Keputusannya adalah memilih di antara beberapa orang. Menyajikannya sebagai daftar percakapan memaksa buka-tutup tab. Selisih harga harus terbaca sekali lihat, bukan dihitung sendiri |
| B9 | Konfirmasi kesepakatan | `/projects/:id/accept` | Melihat seluruh kesepakatan dalam satu layar, lalu membayar | Wujud nyata "transparent partnership" (`R6`). Setelah tombol ditekan, isinya terkunci dan jadi rujukan bila ada sengketa |
| B10 | Ruang kerja | `/collaborations/:id` | Melacak tahap, mengisi kurir + resi, berkirim pesan | Satu halaman, empat wilayah tetap: pelacak tahap, daftar deliverable, kotak aksi, percakapan |
| B11 | Tinjau konten | `/collaborations/:id/review` | Menonton/melihat aset, lalu **Setujui** atau **Minta revisi** + catatan wajib | "Kurang bagus" menghasilkan revisi kedua yang juga gagal lalu sengketa. Catatan wajib adalah cara termurah menekan mediasi |
| B12 | Pustaka konten | `/library` | Aset final + catatan hak pakai per aset | Enam bulan lagi brand akan bertanya "boleh dipakai iklan sampai kapan?". Kalau jawabannya harus dicari di email, janji transparansi berhenti tepat saat paling dibutuhkan |
| B13 | Roster | `/roster` | Menyimpan creator, memesan ulang | Pemesanan berulang adalah satu-satunya alasan brand membayar bulan kedua |

Aturan di B10/B11: **kotak aksi hanya menampilkan aksi yang sah saat ini.**
Tombol setujui butuh konfirmasi — ia memindahkan uang dan tidak bisa dibatalkan.

---

## 7. Alur Creator

| # | Halaman | Rute | Yang diisi / dilakukan | Kenapa |
|---|---|---|---|---|
| C1 | Lamaran | `/apply` | Nama, email, handle tiap platform + jumlah pengikut, niche, **tiga contoh karya terbaik**, jenis konten, waktu pengerjaan, tarif indikatif | Ini bukan form pendaftaran. Tanpa contoh karya, "carefully approving" hanya menyetujui alamat email |
| C1b | Kode undangan | `/apply?code=…` | Masuk lewat jalur cepat | Tim CGC pasti ingin merekrut langsung creator incaran; orang itu tidak seharusnya mengantre di form umum (`R1`) |
| C2 | Onboarding | `/onboarding` | Foto, bio, portofolio, niche, platform, waktu pengerjaan, hak pakai yang bersedia diberikan, tarif indikatif, **alamat pengiriman**, rekening Stripe | Alamat dikumpulkan sekarang supaya brand bisa kirim produk di hari yang sama saat sepakat. Rekening wajib sebelum bisa dipesan, kalau tidak brand gagal di tengah checkout |
| C3 | Papan proyek | `/projects` | Menjelajah proyek terbuka, filter niche/platform/budget/produk | Undangan untuk dia tampil paling atas dan ditandai jelas — peluang berhasilnya jauh lebih besar daripada lamaran |
| C4 | Melamar proyek | `/projects/:id/apply` | Tombol utama: **lamar dengan harga yang dipasang**. Tautan kecil di bawahnya: ajukan harga lain + alasan. Ditambah tanggal siap kirim dan catatan singkat | Jalur normal harus satu klik — kalau menawar terasa sama mudahnya dengan menerima, semua orang akan menawar. Tanggal siap kirim di sini yang nanti menggerakkan pengingat tenggat (`R18`) |
| C5 | Ruang kerja | `/collaborations/:id` | Konfirmasi barang diterima, unggah, kirim, revisi | Wajib selalu terlihat: **pembayaran sudah diamankan**, tenggat berikutnya, sisa jatah revisi |
| C6 | Unggah deliverable | `/collaborations/:id/submit` | Unggah **per deliverable** sesuai daftar brand, boleh dicicil | Brand meminta empat aset spesifik. Satu tautan Drive membuat "manage deliverables" mustahil dan revisi tidak bisa ditunjuk ke aset yang mana |
| C7 | Penghasilan | `/earnings` | Melihat yang cair, yang ditahan, yang menunggu tinjauan | Creator perlu melihat uang yang sudah aman miliknya meski belum cair — itu yang membuat mereka menerima proyek berikutnya |

---

## 8. Operator CGC

Aktor ketiga dengan pekerjaan harian, bukan admin sampingan. Lihat `D6` untuk
pembagian antara konsol di platform dan Sharetribe Console.

| Halaman | Isi |
|---|---|
| `/admin/applications` | Antrean lamaran creator & permintaan akses brand, lengkap dengan contoh karya dan tautan sosial. Aksi: setujui, tolak dengan alasan, minta info tambahan |
| `/admin/profiles` | Profil yang menunggu tayang. Orangnya lolos ≠ profilnya layak tayang |
| `/admin/disputes` | Meja mediasi: riwayat lengkap, aset, catatan revisi, dua tombol keputusan (bayarkan ke creator / kembalikan ke brand) |
| `/admin/invites` | Membuat dan mencabut kode undangan |
| `/admin/health` | Rasio brand : creator, proyek tanpa pelamar, creator tanpa proyek, waktu tinjau rata-rata brand, kolaborasi yang mendekati batas waktu |
| `/admin/reviews` | Menurunkan ulasan yang melanggar. Jarang dipakai, wajib ada |

Semua rute `/admin/*` dibatasi role operator dan memanggil server sendiri;
kunci Integration API tidak pernah menyentuh frontend.

---

## 9. Deliverable dan lisensi

### Deliverable sebagai objek `R12`

| Atribut | Contoh | Gunanya |
|---|---|---|
| Jenis & spesifikasi | Video 30 detik, vertikal | Menghindari perdebatan "ini bukan yang saya minta" |
| Platform tujuan | TikTok | Rasio dan gaya berbeda tiap platform |
| Status | Menunggu · Dikirim · Revisi · Disetujui | Sumber pelacak tahap |
| Versi | v1, v2, v3 | Riwayat revisi yang bisa dibandingkan |
| Berkas final | File resolusi penuh | Masuk pustaka konten brand |

Daftar deliverable **dibuat brand saat menulis proyek** (B6), boleh disesuaikan
creator saat menawar (C4), dan **terkunci saat penawaran diterima** (B9).

### Lisensi sebagai catatan yang diterbitkan `R3`

Saat kolaborasi disetujui, sistem menerbitkan satu catatan tetap: aset apa saja,
dari creator siapa, hak pakai apa, berapa lama, wilayah mana, tanggal berapa.
Bisa dilihat kedua pihak dan bisa diunduh.

Ini bukan fitur tambahan — ini bukti bahwa transaksi memang terjadi. Tanpanya,
satu-satunya jejak hak pakai ada di deskripsi proyek yang bisa berubah dan di
ingatan dua orang.

---

## 10. Uang

| Hal | Aturan |
|---|---|
| Sumber pendapatan | Langganan bulanan brand + komisi per kolaborasi |
| Persentase komisi | **Menunggu klien** (lazimnya 10–20% di pasar ini) |
| Penarikan | Penuh saat penawaran diterima, lalu ditahan |
| Pelepasan | Hanya lewat tiga jalan: brand menyetujui, batas 7 hari terlewat, atau mediasi memenangkan creator |
| Refund | Penuh pada setiap pembatalan sebelum persetujuan. Sebagian hanya lewat keputusan mediasi. Tidak pernah otomatis setelah konten disetujui |
| Harga transaksi | Dari penawaran yang diterima, dihitung server lewat privileged transition — **bukan** harga listing |
| Yang tidak pernah disimpan platform | Nomor kartu, rekening bank, dokumen identitas. Semuanya milik Stripe |

---

## 11. Notifikasi dan pengingat

`R18` menuntut pengingat yang dihitung dari **tanggal yang disepakati di
penawaran**, bukan dari lama sebuah status berjalan. Bedanya terasa langsung:
"tenggat kamu 2 hari lagi" versus "sudah 7 hari sejak proyek dimulai".

| Momen | Untuk | Waktu |
|---|---|---|
| Kesepakatan & struk | Brand | Segera (struk boleh ditunda 15 menit untuk akun baru) |
| Kolaborasi baru | Creator | Segera |
| Alamat creator masuk | Brand | Segera |
| Pengingat kirim produk | Brand | H+1, lalu H+3 bila belum |
| Konfirmasi kirim + resi | Creator & Brand | Saat ditandai |
| Konfirmasi barang diterima | Brand | Saat dikonfirmasi / otomatis hari ke-7 |
| **Tenggat konten H-3 dan H-1** | Creator | **Dihitung dari tanggal penawaran** |
| Lewat tenggat | Creator & Brand | Pada hari lewat |
| Konten dikirim / dikirim ulang | Brand | Segera |
| Pengingat meninjau | Brand | H-2 sebelum persetujuan otomatis |
| Permintaan revisi (+ penanda revisi terakhir) | Creator | Segera |
| Disetujui & pembayaran dilepas | Keduanya | Segera |
| Lisensi terbit | Brand | Saat disetujui |
| Sengketa dibuka / diputuskan | Keduanya | Saat terjadi |
| Pembatalan & refund | Keduanya | Saat terjadi |
| Ajakan & kabar ulasan | Keduanya | Setelah selesai |

**Konsekuensi teknis:** notifikasi berbasis transisi ditangani mesin notifikasi
Sharetribe (sudah ada di `process.edn`). Pengingat yang terikat tanggal janji
**butuh penjadwal sendiri di server** yang membaca tanggal kesepakatan dan
mengirim email pada waktunya. Pekerjaan kecil, tapi harus direncanakan sejak
awal — bukan ditambal belakangan.

Semua teks email tetap bisa diedit klien dari Console.

---

## 12. Peta halaman

| Halaman | Untuk | Kebutuhan |
|---|---|---|
| Landing `/` | Publik | R1 R4 |
| Lamaran creator `/apply` | Publik | R1 R2 |
| Permintaan akses brand `/request-access` | Publik | R1 R8 |
| Status menunggu `/pending` | Pelamar | R5 |
| Langganan `/subscription` | Brand | R8 |
| Onboarding creator `/onboarding` | Creator | R2 R6 |
| Direktori `/creators` | Brand | R10 |
| Profil creator `/creators/:id` | Semua | R10 R14 |
| Buat proyek `/projects/new` | Brand | R7 R9 R12 |
| Papan proyek `/projects` | Creator | R9 |
| Detail proyek + penawaran `/projects/:id` | Keduanya | R11 |
| Undang creator `/projects/:id/invite` | Brand | R11 |
| Konfirmasi kesepakatan `/projects/:id/accept` | Brand | R6 R19 |
| Ruang kerja `/collaborations/:id` | Keduanya | R12 R16 R17 |
| Tinjau konten `/collaborations/:id/review` | Brand | R13 R15 |
| Unggah deliverable `/collaborations/:id/submit` | Creator | R12 |
| Pustaka konten & lisensi `/library` | Brand | R3 |
| Roster `/roster` | Brand | R14 |
| Penghasilan `/earnings` | Creator | R19 |
| Konsol operator `/admin/*` | Operator | R2 R5 R15 |

---

## 13. Jarak dari kode yang ada sekarang

Kode di repo dibangun dengan model katalog (paket creator sebagai objek beli,
brief sebagai listing gratis untuk memancing lamaran). Tabel ini adalah daftar
kerja migrasinya.

| Yang blueprint minta | Yang ada sekarang | Tindakan |
|---|---|---|
| Proyek jadi tulang punggung (`D1`) | Paket creator jadi pusat; brief hanya papan iklan | **Fondasi.** Putuskan dan kerjakan lebih dulu; semua halaman lain mengikuti |
| Harga dipasang brand + penawaran maks 2 putaran (`D2`) | Harga tetap per paket creator | Pindahkan harga ke listing proyek; bangun alur lamar/ajukan/balas; ubah checkout ke privileged transition dengan line item dari `agreedPrice` |
| Form lamaran dengan contoh karya (`R2`) | Pendaftaran biasa lalu disetujui manual, tanpa bahan penilaian | Bangun `/apply` + `/request-access` + antrean operator |
| Deliverable sebagai objek (`R12`) | Tautan & catatan disimpan sebagai teks | Ubah jadi array objek di `protectedData` + UI per item |
| Pengingat terikat tanggal janji (`R18`) | Pengingat dihitung dari lama status berjalan | Tambah penjadwal di server, simpan tanggal janji saat kesepakatan |
| Catatan lisensi (`R3`) | Hak pakai hanya pilihan di paket | Terbitkan snapshot saat disetujui + halaman lisensi |
| Undangan berstatus (`R11`) | Undangan berupa pesan biasa | Tambah status di `protectedData` + tampilkan di kedua sisi |
| Konsol operator (`D6`) | Bergantung penuh pada Console | Bangun `/admin/*` bertahap, mulai dari antrean lamaran |
| Pustaka konten (`R3` `R14`) | Tidak ada | Bangun setelah kolaborasi pertama berjalan |
| Escrow, 2 revisi, ulasan dua arah, alur pengiriman, pintu keluar otomatis | **Sudah benar di `process.edn`** | **Pertahankan.** Ini bagian tersulit dan sudah selesai |

Yang sudah dibangun bukan kesia-siaan: mesin transaksinya adalah bagian paling
sulit dan sudah sesuai. Yang perlu dipikir ulang ada di lapisan di atasnya —
*apa* yang dibeli dan *bagaimana* kesepakatan terbentuk.

---

## 14. Urutan kerja

**Lapis 1 — tidak bisa diubah nanti.** Model proyek & penawaran; harga dari
server; alur uang; batas dua revisi; peran dan gerbang akses. Salah di sini
berarti membangun ulang.

**Lapis 2 — inti janji ke klien.** Form lamaran & antrean vetting; ruang kerja
dengan pelacak tahap; deliverable sebagai objek; alur pengiriman produk; ulasan
dua arah.

**Lapis 3 — yang membuat langganan bertahan.** Roster & pesan ulang; pustaka
konten & lisensi; pengingat berbasis tenggat; saran creator per proyek.

**Lapis 4 — nanti.** Konsol operator lengkap (mulai dari antrean lamaran saja di
Lapis 2); analitik performa konten; paket langganan bertingkat; revisi berbayar;
aplikasi seluler.

Catatan lingkup: cakupan penuh blueprint ini jauh di atas angka $700 yang
disebut di percakapan awal. Kalau anggaran itu masih berlaku, yang realistis
adalah menyepakati **Lapis 1 + 2** sebagai peluncuran pertama, dan menuliskan
Lapis 3 dan 4 sebagai tahap berikutnya — dengan lebih dulu memastikan Lapis 1
dirancang benar, karena itulah satu-satunya bagian yang mahal diperbaiki
belakangan.

---

## Lampiran A — Operasional Sharetribe

Hal-hal yang tidak bisa hidup di kode karena konfigurasi hosted selalu menimpa
file lokal di `src/config/`.

### A1. Transaction process

> **Proses yang sama sekali baru pada sebuah marketplace butuh `process
> create`, bukan `process push`.** Ditemukan 2026-08-02 saat mendorong ke
> `warungurang-dev`: `process push` hanya menambah **versi baru ke proses
> yang sudah terdaftar** — untuk nama proses yang belum pernah ada sama
> sekali di marketplace itu, ia gagal dengan `"Transaction process not
> found"`, sekalipun `process.edn`-nya sendiri valid. `process create`
> mendaftarkan nama prosesnya sekaligus mendorong versi 1 dalam satu
> langkah. Setelah proses ada (di marketplace itu), barulah versi
> berikutnya pakai `process push`.
>
> **Per environment, bukan per akun.** `warungurang-test` dan
> `warungurang-dev` adalah marketplace terpisah — proses yang sudah ada di
> satu environment (mis. `cgc-ugc-approval` yang sebelumnya divalidasi di
> `warungurang-test`, lihat catatan di bawah) **tidak otomatis ada** di
> environment lain. Jalankan `process create` per environment yang dituju.

```bash
flex-cli login

# Proses baru pertama kali di environment ini:
flex-cli process create --process cgc-ugc-approval --path ext/transaction-processes/cgc-ugc-approval --marketplace YOUR_MARKETPLACE_ID
# Versi berikutnya setelah proses ada (jangan pakai create lagi):
# flex-cli process push --process cgc-ugc-approval --path ext/transaction-processes/cgc-ugc-approval --marketplace YOUR_MARKETPLACE_ID

flex-cli process create-alias --process cgc-ugc-approval --version 1 --alias release-1 --marketplace YOUR_MARKETPLACE_ID
flex-cli process list --marketplace YOUR_MARKETPLACE_ID
```

> **Metadata pada transisi privileged — sudah dikonfirmasi (2026-08-02).**
> Nama aksinya **`:action/privileged-update-metadata`**, bukan
> `:action/update-metadata` seperti tebakan awal — terungkap dari pesan error
> `flex-cli process push` sendiri, yang mencantumkan daftar lengkap aksi yang
> valid. Dipakai persis seperti `:action/update-protected-data` tapi untuk
> scope `metadata`, dan hanya boleh dipasang pada transisi yang juga
> `:privileged? true` (konsisten dengan `:action/privileged-set-line-items`
> yang sudah dipakai `cgc-ugc-approval`). Ini dipakai di proses
> `cgc-application` — lihat A1b.
>
> **Peringatan operasional:** saat percobaan push pertama gagal validasi
> (nama aksi salah), langkah `create-alias` yang dijalankan setelahnya di
> terminal yang sama tetap tercatat sukses tapi menunjuk ke **versi kosong**
> (`"Alias successfully created to point to version ."`). Sebelum
> mengandalkan alias apa pun, selalu jalankan `flex-cli process list
> --marketplace YOUR_MARKETPLACE_ID` untuk memastikan alias menunjuk ke
> nomor versi yang benar-benar ada — jangan asumsikan dari pesan sukses saja.

- Aplikasi terikat ke alias `cgc-ugc-approval/release-1` (`src/transactions/transaction.js`). Alias lain akan membuat halaman transaksi error.
- `process push` (ke proses yang **sudah ada**) selalu membuat versi baru, tidak menimpa. Selalu cek alias menunjuk ke versi yang benar dengan `process list`.
- Jangan pernah mengedit versi yang sudah punya transaksi hidup — push versi baru lalu `update-alias`.
- Self-transition (`:from` dan `:to` sama) sudah terbukti diterima format v3 di push nyata.

**Status per 2026-08-02:** `cgc-ugc-approval/release-1` dan
`cgc-application/release-1` sudah live di **`warungurang-dev`** (versi 1
keduanya), dibuat lewat `process create` setelah `process push` gagal
duluan dengan "process not found" karena prosesnya memang belum pernah
didaftarkan di environment ini. Verifikasi via `flex-cli process list
--marketplace warungurang-dev` menunjukkan keduanya terdaftar bersama lima
proses bawaan.

### A1b. Proses `cgc-application`

Sama seperti A1, tapi untuk proses lamaran/tawar-menawar (BLUEPRINT §5, jarak §13):

```bash
# Proses baru pertama kali di environment ini:
flex-cli process create --process cgc-application --path ext/transaction-processes/cgc-application --marketplace YOUR_MARKETPLACE_ID
flex-cli process create-alias --process cgc-application --version 1 --alias release-1 --marketplace YOUR_MARKETPLACE_ID
flex-cli process list --marketplace YOUR_MARKETPLACE_ID
```

Aplikasi terikat ke alias `cgc-application/release-1` (sama pola dengan A1).
Riwayat percobaan (2026-08-02): percobaan pertama gagal karena nama aksi
salah tebak (`:action/update-metadata` → diperbaiki jadi
`:action/privileged-update-metadata`, lihat catatan di A1 di atas);
percobaan kedua (setelah nama aksi benar) masih gagal dengan "Transaction
process not found" karena memakai `process push` untuk proses yang belum
pernah dibuat — diperbaiki dengan `process create` (lihat catatan di A1),
dan berhasil. **Jalankan `flex-cli process list` setiap kali** untuk
memastikan alias `release-1` benar-benar menunjuk ke versi yang valid,
karena upaya `create-alias` yang menyusul push/create yang gagal pernah
tercatat "sukses" padahal
menunjuk ke versi kosong.

### A2. Listing types (Console → Build → Listings)

> **Koreksi (2026-08-03): ini TIDAK bisa dikerjakan lewat Console sama
> sekali, meski judul section ini bilang begitu.** Ditemukan saat mengecek
> Console `warungurang-dev`: form "Add a new listing type" hanya menawarkan
> **5 proses transaksi bawaan** (Calendar booking, Purchase, Free messaging,
> Price negotiation, Digital download) di daftar "Transaction process" —
> `cgc-ugc-approval`/`cgc-application` tidak pernah muncul di sana walau
> `flex-cli process list --process cgc-application` sudah membuktikan alias
> `release-1` keduanya valid dan menunjuk ke versi 1. Console memang tidak
> bisa mengaitkan listing type ke proses transaksi kustom lewat builder-nya —
> ini keterbatasan Console, bukan alias yang rusak.
>
> Solusi resminya (dikonfirmasi lewat dokumentasi developer Sharetribe):
> definisikan listing type kustom **di kode**, bukan Console — persis pola
> yang sudah disediakan template ini di `src/config/configListing.js`
> (`listingTypes`/`listingFields`, keduanya sudah diisi untuk `creator-profile`
> dan `project`). Karena `mergeListingConfig` (di `configHelpers.js`) secara
> default mengabaikan `defaultConfigs.listing.listingTypes/listingFields`
> kecuali flag debug `mergeDefaultTypesAndFieldsForDebugging` dinyalakan —
> dan flag itu juga dipakai fixture test yang tidak berkaitan, jadi tidak
> aman dinyalakan begitu saja secara global (sempat dicoba, merusak beberapa
> test lain karena fixture lokal test lain jadi ikut ter-merge) — dibuatkan
> fungsi terpisah `withCustomListingConfig` (`configHelpers.js`), dipanggil
> eksplisit hanya dari `src/app.js` (`buildAppConfig`), yang menempelkan
> `creator-profile`/`project` beserta field publiknya ke config final di
> setiap environment, tanpa mengubah perilaku merge bersama yang dipakai
> bagian lain aplikasi/test.
>
> **Konsekuensi:** field `contentNiche`/`platforms`/`usageRights`/
> `requiresProduct` yang tadinya diasumsikan perlu dibuat manual di Console
> **juga** sudah didefinisikan di `configListing.js` — jangan buat field
> dengan key yang sama lagi di Console, nanti dua sumber (Console + kode)
> bertabrakan atau membingungkan. Yang **masih** perlu dikerjakan manusia di
> Console: indeks pencarian (`flex-cli search set`, tetap lewat CLI bukan
> Console UI) dan access control (Lampiran A3) — dua itu tidak terkait
> mekanisme listing type/field sama sekali.

Sesuai `D1`:

- **`creator-profile`** — milik creator, proses `cgc-ugc-approval/release-1`, unit `item`, payout wajib, **pickup/shipping dimatikan** (lihat bagian 5), lampiran berkas di pesan diaktifkan. Harganya bersifat indikatif; harga sebenarnya datang dari penawaran.
- **`project`** — milik brand, proses **`cgc-application/release-1`** (bukan `default-inquiry` — itu proses lamaran & tawar-menawar harga dari F1, lihat A1b), **harga diaktifkan** (angka yang ditawarkan brand — listing ini tidak pernah di-checkout, jadi harga di sini murni informasi), tanpa payout, foto tidak wajib.

Field publik untuk `creator-profile`: `contentNiche` (multi-enum), `platforms`
(multi-enum), `turnaroundDays` (long), `usageRights` (enum), `requiresProduct`
(boolean), `indicativeRate`.
Field publik untuk `project`: `contentNiche`, `platforms`, `priceNegotiable`
(boolean), `contentDueDate`, `requiresProduct`, `usageRights`, `deliverables`.
Harga proyek memakai atribut harga listing, bukan custom field.

Indeks pencarian untuk `contentNiche`, `platforms`, `usageRights`:

```bash
flex-cli search set --key contentNiche --type multi-enum --scope public --marketplace YOUR_MARKETPLACE_ID
```

### A3. Access control (Console → Build → General → Access control)

Setelan yang benar untuk CGC, beserta alasannya. Kolom terakhir menandai apa yang
sudah sesuai per 1 Agustus 2026.

| Setelan | Nilai | Alasan | Status |
|---|---|---|---|
| Make marketplace private | **ON** | Portofolio creator tidak boleh terekspos ke publik dan mesin pencari. Konsekuensinya: direktori hanya bisa dilihat setelah login, jadi landing page harus punya **showcase kurasi** lewat CMS sebagai gantinya | sudah ON |
| Approve users who want to join | **ON** | Gerbang vetting `R1 R2` | sudah ON |
| Call to action | **Internal link → `/apply`** | **Belum dipakai, dan ini kaitnya.** Setelah daftar, user berstatus `pending-approval` melihat tombol ini dan diarahkan mengisi formulir lamaran kita. Dengan begitu form lamaran menempel pada alur persetujuan bawaan Sharetribe, bukan melawannya | masih "No call to action" |
| Restrict rights to view listings | **OFF** | Dua sistem gerbang yang tumpang tindih hanya melahirkan bug. Cukup andalkan `state`. Lagipula `D5` memang membuat menjelajah gratis — itu alat jualan, bukan kebocoran | sudah OFF |
| Restrict posting rights | **OFF** | Sudah dijaga status `pending-approval` + `isUserAuthorized()` | sudah OFF |
| Restrict transaction rights | **OFF** | Idem | sudah OFF |
| Approve listings before publishing | **ON**, dengan catatan di bawah | Perlu untuk meninjau profil creator sebelum tayang (`R2 R5`) — orangnya lolos tidak berarti profilnya layak tayang | masih OFF |

**Catatan penting soal baris terakhir.** Persetujuan listing berlaku ke **semua**
listing, termasuk `project` milik brand. Kalau dinyalakan begitu saja, setiap
proyek yang diposting brand harus menunggu operator sebelum bisa dilihat creator
— itu menambah kerja harian operator dan memperlambat brand yang sudah membayar
langganan.

Solusinya: nyalakan persetujuan listing, lalu **auto-approve listing bertipe
`project`** dari brand berlangganan aktif, lewat Event system + Integration API di
server sendiri. Yang tersisa untuk ditinjau manusia hanya `creator-profile` —
persis yang memang ingin ditinjau. Kalau auto-approve belum sempat dibangun,
sementara biarkan setelan ini OFF dan tahan profil creator dengan cara lain
(mis. baru dipublikasikan operator dari `/admin/profiles`), jangan menyalakannya
tanpa auto-approve.

### A4. Environment variables

```
STRIPE_SECRET_KEY=sk_...
STRIPE_BRAND_SUBSCRIPTION_PRICE_ID=price_...
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_...
SHARETRIBE_INTEGRATION_CLIENT_ID=...      # untuk konsol operator (D6)
SHARETRIBE_INTEGRATION_CLIENT_SECRET=...  # server saja, jangan pernah ke frontend
```

Tanpa dua yang pertama, endpoint langganan mati (mengembalikan 501) tapi aplikasi
tetap jalan.

### A5. Yang hanya bisa dikerjakan manual di Console

Branding (logo, warna), konten Pages/CMS, listing types, listing fields, dan
search config **tidak punya API/CLI**. Kerjakan di environment **Test**, lalu
pakai tombol "Copy changes to…" untuk mendorong ke Live sekali jalan. Per
section CMS, Console hanya mengekspos empat field tampilan (`backgroundColor`,
`backgroundImage` min. 1600×1200, `backgroundImageOverlay` none/dark/darker,
`textColor` black/white); selebihnya adalah kode.

### A6. Verifikasi sebelum dianggap beres

```bash
yarn verify-cgc && npx jest --runInBand && yarn build-web
```

Uji alur penuh butuh proses yang sudah di-push ke marketplace nyata plus dua akun
uji: sepakat → kirim produk → konfirmasi → kirim konten → minta revisi → kirim
ulang → setujui → payout → ulasan dua arah. Lalu uji jalur gagalnya: pembatalan
operator di tiap tahap, dan memastikan transaksi yang didiamkan tetap sampai ke
tahap akhir sendiri.

---

## Lampiran B — Masih menunggu klien

Empat hal sudah diberi **nilai simulasi** supaya pekerjaan tidak berhenti — lihat
IMPLEMENTATION-PLAN.md §15. Semuanya disimpan di Console/Stripe, jadi klien bisa
mengubahnya tanpa menyentuh kode: komisi **15% dari creator**, langganan
**satu paket $149/bulan**, masa undangan **7 hari**, batas penawaran
**7 hari / balasan 3 hari**. Yang di bawah ini tetap perlu dikonfirmasi klien.

| # | Pertanyaan | Kenapa penting |
|---|---|---|
| B1 | **Konfirmasi harga langganan brand dan jumlah tingkatannya** | Simulasi memakai satu paket $149/bulan. `D5` sudah mengunci *apa* yang dikunci langganan |
| B2 | **Konfirmasi persentase komisi platform** | Simulasi memakai 15% dibebankan ke creator |
| B3 | **Siapa yang meninjau lamaran setiap hari, dan berapa lama janji waktunya?** | Yang dimaksud "lamaran": lamaran creator baru (`/apply`) dan permintaan akses brand (`/request-access`). Keduanya butuh manusia yang memutuskan setiap hari. Kalau tidak ada yang memegang, invite-only akan macet di hari pertama dan pelamar hilang. Janji waktunya juga harus ditulis di halaman `/pending` |
| B4 | **Berapa lama undangan berlaku sebelum kedaluwarsa?** | Menentukan kapan brand boleh mencari creator lain. Usulan: 7 hari |
| B5 | **Apakah aset final perlu diunggah ke platform?** | **Diputuskan untuk v1: tidak.** Aset dikirim sebagai tautan (Drive/Dropbox/Frame.io) plus lampiran pesan bawaan Sharetribe untuk berkas kecil. Video mentah terlalu besar untuk lampiran pesan, dan penyimpanan sendiri menambah dependency + biaya. Konsekuensinya ditangani: setiap versi menyimpan metadata yang bertahan meski tautannya mati, dan catatan lisensi merekam metadata itu. Unggahan langsung menjadi pekerjaan Lapis 3 kalau klien memintanya |
| B6 | **Wilayah dan durasi standar hak pakai** | Isi catatan lisensi. Usulan: pakai pilihan yang sudah ada (organik saja / iklan 6 bulan / iklan 12 bulan / buyout penuh) dengan wilayah global sebagai bawaan |

Kalau salah satu harus jalan sebelum dijawab, tulis asumsinya di sini beserta
tanggalnya, jangan diputuskan diam-diam di dalam kode.
