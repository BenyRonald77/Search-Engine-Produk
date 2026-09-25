-- Setup full-text search + typo tolerance untuk tabel "Product".
-- Dijalankan setelah `prisma db push` (yang membuat tabel dasarnya).
-- Idempotent - aman dijalankan berulang kali.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() bawaan PostgreSQL ditandai STABLE, bukan IMMUTABLE, sehingga
-- tidak bisa dipakai langsung di generated column. Dibungkus fungsi sendiri
-- yang ditandai IMMUTABLE (aman karena hasil unaccent deterministik untuk
-- konfigurasi 'unaccent' yang tetap).
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS $$
  SELECT unaccent('unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- Kolom generated: dihitung ulang otomatis oleh PostgreSQL setiap kali
-- baris di-INSERT/UPDATE - inilah yang menjamin index selalu sinkron
-- dengan data tanpa proses reindexing terpisah di level aplikasi.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('indonesian', immutable_unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('indonesian', immutable_unaccent(coalesce(brand, ''))), 'B') ||
    setweight(to_tsvector('indonesian', immutable_unaccent(coalesce(description, ''))), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS product_search_vector_idx ON "Product" USING GIN (search_vector);

-- Index trigram untuk toleransi typo & autocomplete prefix pada nama produk.
CREATE INDEX IF NOT EXISTS product_name_trgm_idx ON "Product" USING GIN (name gin_trgm_ops);
