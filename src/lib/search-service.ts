import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface SearchParams {
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: string;
  imageEmoji: string;
  categoryId: string;
  categoryName: string;
  score: number;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
}

function buildFilterConditions(params: SearchParams): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (params.categoryId) {
    conditions.push(Prisma.sql`p."categoryId" = ${params.categoryId}`);
  }
  if (params.minPrice !== undefined) {
    conditions.push(Prisma.sql`p.price >= ${params.minPrice}`);
  }
  if (params.maxPrice !== undefined) {
    conditions.push(Prisma.sql`p.price <= ${params.maxPrice}`);
  }
  return conditions;
}

export async function searchProducts(params: SearchParams): Promise<SearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 12));
  const offset = (page - 1) * pageSize;
  const query = params.q?.trim() ?? "";

  const filterConditions = buildFilterConditions(params);

  if (!query) {
    // Tanpa kata kunci: telusuri produk terbaru sesuai filter saja.
    const whereClause =
      filterConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(filterConditions, " AND ")}`
        : Prisma.empty;

    const [items, totalRows] = await Promise.all([
      prisma.$queryRaw<SearchResultItem[]>(Prisma.sql`
        SELECT p.id, p.name, p.brand, p.description, p.price::text AS price,
               p."imageEmoji" AS "imageEmoji", p."categoryId" AS "categoryId",
               c.name AS "categoryName", 0::float AS score
        FROM "Product" p
        JOIN "Category" c ON c.id = p."categoryId"
        ${whereClause}
        ORDER BY p."createdAt" DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `),
      prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM "Product" p ${whereClause}
      `),
    ]);

    return { items, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
  }

  // Dengan kata kunci: gabungan full-text search (tsvector/tsquery, dengan
  // bobot per kolom) DAN trigram similarity (toleransi typo) - skor
  // tertinggi dari keduanya dipakai untuk pengurutan relevansi.
  // word_similarity (bukan similarity biasa) dipakai untuk toleransi typo
  // karena ia mencocokkan query terhadap SUBSTRING/kata terbaik di dalam
  // nama produk, bukan membandingkan seluruh string nama sekaligus - lebih
  // akurat untuk nama produk yang terdiri dari beberapa kata.
  const matchCondition = Prisma.sql`(
    p.search_vector @@ websearch_to_tsquery('indonesian', immutable_unaccent(${query}))
    OR ${query} <% p.name
  )`;

  const allConditions = [matchCondition, ...filterConditions];
  const whereClause = Prisma.sql`WHERE ${Prisma.join(allConditions, " AND ")}`;

  const scoreExpr = Prisma.sql`
    GREATEST(
      ts_rank(p.search_vector, websearch_to_tsquery('indonesian', immutable_unaccent(${query}))),
      word_similarity(${query}, p.name)
    )
  `;

  const [items, totalRows] = await Promise.all([
    prisma.$queryRaw<SearchResultItem[]>(Prisma.sql`
      SELECT p.id, p.name, p.brand, p.description, p.price::text AS price,
             p."imageEmoji" AS "imageEmoji", p."categoryId" AS "categoryId",
             c.name AS "categoryName", ${scoreExpr}::float AS score
      FROM "Product" p
      JOIN "Category" c ON c.id = p."categoryId"
      ${whereClause}
      ORDER BY score DESC, p."createdAt" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "Product" p ${whereClause}
    `),
  ]);

  return { items, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}

export interface Suggestion {
  id: string;
  name: string;
}

export async function suggestProducts(query: string, limit = 8): Promise<Suggestion[]> {
  const q = query.trim();
  if (!q) return [];

  return prisma.$queryRaw<Suggestion[]>(Prisma.sql`
    SELECT id, name
    FROM "Product"
    WHERE name ILIKE ${q + "%"} OR ${q} <% name
    ORDER BY
      (name ILIKE ${q + "%"}) DESC,
      word_similarity(${q}, name) DESC
    LIMIT ${limit}
  `);
}
