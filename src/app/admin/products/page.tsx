"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  price: string;
  imageEmoji: string;
  categoryId: string;
  category: Category;
}

const emptyForm = { name: "", brand: "", description: "", price: "", categoryId: "", imageEmoji: "📦" };

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    const response = await fetch("/api/admin/products");
    if (response.ok) {
      const data = await response.json();
      setProducts(data.products);
    }
  }

  useEffect(() => {
    loadProducts();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories));
  }, []);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      brand: p.brand ?? "",
      description: p.description ?? "",
      price: p.price,
      categoryId: p.categoryId,
      imageEmoji: p.imageEmoji,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, price: Number(form.price) };
      const response = await fetch(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Gagal menyimpan produk");
        return;
      }
      cancelEdit();
      loadProducts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    loadProducts();
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Edit Produk" : "Tambah Produk"}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Perubahan di sini langsung tercermin di hasil pencarian (index tsvector generated column, tidak perlu reindex manual).
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nama Produk</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Merek</label>
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Kategori</label>
            <select
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Pilih kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Harga (Rp)</label>
            <input
              type="number"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Emoji</label>
            <input
              value={form.imageEmoji}
              onChange={(e) => setForm({ ...form, imageEmoji: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Deskripsi</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Produk"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Produk ({products.length})</h2>
        <div className="mt-4 flex flex-col gap-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{p.imageEmoji}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {p.category.name} · Rp {Number(p.price).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <button onClick={() => startEdit(p)} className="font-medium text-brand-600 hover:underline">
                  Edit
                </button>
                <button onClick={() => handleDelete(p.id)} className="font-medium text-red-600 hover:underline">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
