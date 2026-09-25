import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const productSchema = z.object({
  name: z.string().min(2),
  brand: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.string().min(1),
  imageEmoji: z.string().optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name: parsed.data.name,
      brand: parsed.data.brand,
      description: parsed.data.description,
      price: parsed.data.price,
      categoryId: parsed.data.categoryId,
      imageEmoji: parsed.data.imageEmoji ?? "📦",
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
