# Search Engine Produk

Pencarian produk full-text dengan **autocomplete**, **toleransi typo**,
filter **kategori & rentang harga**, dan index yang **selalu sinkron**
otomatis begitu data produk berubah — dibangun di atas **PostgreSQL**
(`tsvector` + ekstensi `pg_trgm`), bukan SQLite atau layanan pencarian
eksternal.

## Kenapa PostgreSQL, bukan SQLite atau Meilisearch?

Proyek-proyek sebelumnya di seri ini memakai SQLite untuk development.
Proyek ini **sengaja beralih ke PostgreSQL** karena pencarian adalah fitur
inti yang butuh kapabilitas yang SQLite tidak punya (full-text search
native, ekstensi fuzzy matching). Meilisearch dipertimbangkan tapi tidak
dipakai karena environment pengembangan ini memblokir instalasi binary
Meilisearch lewat kebijakan jaringan; PostgreSQL 16 sudah tersedia dan
kedua ekstensi yang dibutuhkan (`pg_trgm`, `unaccent`) terbukti mendukung
kombinasi full-text + fuzzy search dengan baik.

## Arsitektur pencarian

Kolom `search_vector` pada tabel `Product` adalah **generated column**
(`GENERATED ALWAYS AS ... STORED`) yang PostgreSQL hitung ulang otomatis
setiap kali baris di-`INSERT`/`UPDATE` — inilah yang menjamin index selalu
sinkron dengan data tanpa proses reindexing terpisah:

```sql
search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('indonesian', immutable_unaccent(coalesce(name, ''))), 'A') ||
  setweight(to_tsvector('indonesian', immutable_unaccent(coalesce(brand, ''))), 'B') ||
  setweight(to_tsvector('indonesian', immutable_unaccent(coalesce(description, ''))), 'C')
) STORED;
```

Pencarian menggabungkan dua jalur (lihat `src/lib/search-service.ts`):

1. **`websearch_to_tsquery`** terhadap `search_vector` — untuk kata yang
   dieja benar, dengan skor `ts_rank` (nama produk dibobot lebih tinggi
   daripada merek, merek lebih tinggi daripada deskripsi).
2. **`word_similarity` / operator `<%`** dari `pg_trgm` — untuk toleransi
   typo. Dipilih `word_similarity` (bukan `similarity` biasa) karena ia
   mencocokkan query terhadap kata/substring TERBAIK di dalam nama produk,
   bukan membandingkan seluruh string nama sekaligus — jauh lebih akurat
   untuk nama produk yang terdiri dari beberapa kata ("Sepatu Lari
   Ultraboost" tetap ditemukan oleh query typo "sepatuu" meski panjang
   nama produk jauh berbeda dari panjang query).

Kedua skor digabung dengan `GREATEST(...)` untuk pengurutan relevansi akhir.

### Bug yang ditemukan & diperbaiki saat verifikasi

Percobaan pertama toleransi typo (`similarity(name, query) > threshold`
memakai `%` biasa) **gagal total** — mencari "sepatuu" (typo dari "sepatu")
terhadap produk "Sepatu Lari Ultraboost" mengembalikan 0 hasil, walau
secara intuitif harusnya cocok. Diselidiki langsung lewat `psql`: operator
`%` pg_trgm membandingkan trigram dari SELURUH string "Sepatu Lari
Ultraboost" terhadap "sepatuu" — untuk nama produk multi-kata, ini
menghasilkan similarity yang rendah meski salah satu katanya sangat mirip.
Diperbaiki dengan memakai `word_similarity()`/operator `<%`, yang secara
khusus dirancang untuk kasus ini (mencocokkan query terhadap bagian
terbaik dari string, bukan keseluruhan). Setelah perbaikan, query typo
langsung mengembalikan seluruh produk kategori "Sepatu" dengan skor
`word_similarity` yang wajar (~0.75).

## Verifikasi (dijalankan langsung terhadap PostgreSQL & API sungguhan)

Diuji langsung lewat `psql` dan lewat endpoint API yang benar-benar
berjalan (bukan sekadar dibaca dari kode):

- **Relevansi**: `?q=sepatu+lari` mengembalikan "Sepatu Lari Ultraboost"
  dengan `ts_rank` tertinggi (0.998) dibanding produk sepatu lain.
- **Toleransi typo**: `?q=sepatuu` (typo) tetap mengembalikan seluruh 5
  produk kategori Sepatu, terurut oleh `word_similarity`.
- **Autocomplete**: `?q=lapt` mengembalikan "Laptop ThinkPad X1" dan "Tas
  Ransel Laptop" dalam hitungan milidetik (index GIN trigram).
- **Filter kombinasi**: kategori Elektronik + rentang harga Rp500rb-3jt
  mengembalikan tepat 2 produk yang benar-benar berada dalam irisan kedua
  kriteria; kata kunci "sepatu" + kategori Sepatu + harga maks Rp1jt
  mengembalikan tepat 2 produk yang cocok ketiga kriteria sekaligus.
- **Index sync**: produk "Power Bank 20000mAh" diubah namanya lewat panel
  admin menjadi "Gadget Power Bank 20000mAh" — pencarian `?q=gadget`
  sebelum perubahan mengembalikan 0 hasil, **langsung setelah** perubahan
  tersimpan mengembalikan 1 hasil, tanpa proses reindex manual apa pun.

## Menjalankan secara lokal

Proyek ini butuh PostgreSQL (bukan SQLite). Environment ini sudah punya
PostgreSQL 16 terpasang; jika menjalankan di tempat lain, sesuaikan
`DATABASE_URL`.

```bash
# Siapkan database (sekali saja)
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER app_user WITH PASSWORD 'app_password' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE search_engine_produk OWNER app_user;"

cp .env.example .env
npm install

npx prisma db push        # buat tabel dasar (User, Category, Product, dst)
npm run db:setup-search    # pasang extension pg_trgm/unaccent + generated column + index GIN
npm run prisma:seed         # 4 kategori + 25 produk contoh + akun admin

npm run dev                  # http://localhost:3000
```

Login admin demo: `admin@search.dev` / `password123` (halaman `/admin/login`).

## Struktur proyek

```
prisma/
  schema.prisma          Model Admin, Category, Product (tanpa search_vector - lihat di bawah)
  sql/001_setup_search.sql  Extension, fungsi immutable_unaccent, generated column, index GIN
  seed.ts
scripts/
  setup-search.ts          Runner untuk 001_setup_search.sql (npm run db:setup-search)
src/lib/
  search-service.ts         Query full-text + trigram + filter (raw SQL via Prisma.sql)
  auth.ts                    Autentikasi admin (JWT httpOnly cookie)
src/app/
  page.tsx                    Halaman pencarian publik (search bar, autocomplete, filter)
  api/search/                  GET pencarian utama
  api/search/suggestions/       GET autocomplete
  api/categories/                GET daftar kategori (untuk filter)
  admin/                          Login admin + panel kelola produk (CRUD)
```

### Kenapa `search_vector` tidak dimodelkan di `schema.prisma`?

Prisma Client tidak mendukung generated column PostgreSQL secara
deklaratif. Kolom ini dikelola lewat raw SQL (`prisma/sql/001_setup_search.sql`,
dijalankan sekali via `npm run db:setup-search` setelah `prisma db push`)
dan dikueri langsung lewat `prisma.$queryRaw` di `search-service.ts` — bukan
lewat model Prisma biasa.

## Di luar cakupan (v1)

- Personalisasi hasil pencarian, riwayat pencarian pengguna.
- Pencarian gambar/visual, sinonim kustom lintas bahasa.
- Sharding/scaling index untuk dataset sangat besar (jutaan produk).
