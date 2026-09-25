# PRD — Search Engine Produk

## 1. Latar Belakang

Katalog produk e-commerce butuh pencarian yang cepat dan "memaafkan"
kesalahan ketik pengguna: pencarian teks lengkap (bukan sekadar `LIKE
%kata%`), autocomplete saat mengetik, toleransi typo (misal "sepatuu" tetap
menemukan "sepatu"), dan filter kategori/rentang harga — dengan index yang
selalu sinkron begitu data produk berubah.

## 2. Tujuan

1. **Full-text search** relevan berdasarkan bobot kata (nama produk > merek
   > deskripsi), bukan hanya pencocokan substring.
2. **Autocomplete** — saran pencarian muncul saat pengguna mengetik,
   berbasis prefix match yang cepat.
3. **Toleransi typo** — kesalahan ketik ringan (1-2 karakter) tetap
   menemukan produk yang relevan.
4. **Filter kategori & rentang harga** yang bisa dikombinasikan dengan kata
   kunci pencarian, bukan fitur terpisah.
5. **Index sinkron otomatis** — begitu produk dibuat/diubah/dihapus, hasil
   pencarian langsung mencerminkan perubahan tersebut tanpa proses manual.

## 3. Keputusan Teknis: PostgreSQL (tsvector + pg_trgm), bukan SQLite/Meilisearch

Proyek ini **memakai PostgreSQL sebagai database utama** (bukan pola
SQLite-dev seperti proyek-proyek sebelumnya), karena fitur pencarian adalah
inti dari aplikasi ini dan butuh kapabilitas yang SQLite tidak punya:

- **`tsvector` + `tsquery`** — full-text search native PostgreSQL, dengan
  pembobotan per kolom (`setweight`) sehingga kecocokan di nama produk
  dinilai lebih relevan daripada di deskripsi, dan `ts_rank` untuk mengurutkan
  hasil berdasarkan relevansi.
- **Ekstensi `pg_trgm`** (trigram similarity) — menyediakan toleransi typo
  lewat operator `%` dan fungsi `similarity()`, dibandingkan dengan indeks
  GIN trigram (`gin_trgm_ops`) agar tetap cepat walau dataset besar.
- Alternatif **Meilisearch** dipertimbangkan tapi tidak dipakai karena
  environment pengembangan ini tidak bisa memasang binary Meilisearch
  (diblokir kebijakan jaringan sandbox), sementara PostgreSQL 16 dengan
  kedua ekstensi di atas sudah tersedia dan terbukti mendukung kombinasi
  full-text + fuzzy search dengan baik untuk skala aplikasi ini.

### Strategi pencarian gabungan

```sql
-- Kolom generated tsvector, gabungan bobot: nama (A), merek (B), deskripsi (C)
search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('indonesian', unaccent(name)), 'A') ||
  setweight(to_tsvector('indonesian', unaccent(coalesce(brand, ''))), 'B') ||
  setweight(to_tsvector('indonesian', unaccent(coalesce(description, ''))), 'C')
) STORED;
```

Query pencarian mengombinasikan dua jalur secara paralel lalu digabung:
1. **tsquery match** (`search_vector @@ websearch_to_tsquery(...)`) untuk
   kata yang dieja benar — hasil diberi skor `ts_rank`.
2. **Trigram similarity fallback** (`name % :query` via `pg_trgm`) untuk
   menangkap kasus typo yang tidak match di jalur pertama — hasil diberi
   skor `similarity(name, :query)`.

Kedua jalur di-`UNION` dan diurutkan berdasarkan skor gabungan, sehingga
pengguna tetap mendapat hasil relevan baik saat mengetik dengan benar
maupun saat typo.

### Index sinkron otomatis

`search_vector` adalah **generated column** (`GENERATED ALWAYS AS ... STORED`)
— PostgreSQL sendiri yang menghitung ulang secara otomatis dan atomik
setiap kali baris `INSERT`/`UPDATE`, di level database, bukan lewat kode
aplikasi yang bisa lupa dipanggil atau race condition dengan penulisan data.
Ini menjamin index full-text **selalu sinkron** dengan data produk tanpa
proses reindexing terpisah.

### Autocomplete

Endpoint terpisah `/api/search/suggestions?q=...` memakai prefix match pada
kolom `name` (index GIN trigram yang sama) dibatasi 8 hasil, dioptimalkan
untuk latensi rendah saat mengetik (dipanggil per keystroke dengan
debounce di frontend).

## 4. Model Data (ringkas)

- `Category` — `id`, `name`, `slug`.
- `Product` — `id`, `name`, `brand`, `description`, `price`, `categoryId`,
  `search_vector` (generated column), `createdAt`, `updatedAt`.

## 5. Verifikasi yang direncanakan

- `verify-fulltext-search.ts` — memasukkan produk dengan variasi nama/merek/
  deskripsi, memverifikasi pencarian kata kunci mengembalikan hasil yang
  relevan dan terurut sesuai bobot (nama > merek > deskripsi).
- `verify-typo-tolerance.ts` — mencari dengan kata yang sengaja salah eja,
  memverifikasi produk yang benar tetap ditemukan lewat jalur trigram.
- `verify-autocomplete.ts` — mengetik prefix parsial, memverifikasi saran
  yang relevan & cepat dikembalikan.
- `verify-filters.ts` — kombinasi kata kunci + filter kategori + rentang
  harga, memverifikasi hasil sesuai irisan semua kriteria.
- `verify-index-sync.ts` — mengubah nama produk lalu langsung mencarinya
  dengan kata kunci baru, memverifikasi hasil pencarian langsung
  mencerminkan perubahan tanpa proses reindex manual.

## 6. Di luar cakupan (v1)

- Personalisasi hasil pencarian, riwayat pencarian pengguna.
- Pencarian gambar/visual, sinonim kustom lintas bahasa.
- Sharding/scaling index untuk dataset sangat besar (jutaan produk).
