import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  brand: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().min(1).optional(),
  imageEmoji: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
