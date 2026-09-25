import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/search-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const page = searchParams.get("page") ? Number(searchParams.get("page")) : undefined;

  const result = await searchProducts({ q, categoryId, minPrice, maxPrice, page });
  return NextResponse.json(result);
}
