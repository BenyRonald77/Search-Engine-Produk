"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
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

interface Suggestion {
  id: string;
  name: string;
}

function formatPrice(price: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(price)
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions));
  }, [debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (categoryId) params.set("categoryId", categoryId);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);

    fetch(`/api/search?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, categoryId, minPrice, maxPrice]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-brand-700">🔍 Search Engine Produk</span>
          <Link href="/admin/login" className="text-sm text-slate-500 hover:text-brand-600">
            Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Cari produk... (coba salah ketik, misal 'sepatuu')"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-brand-500 focus:outline-none"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    onMouseDown={() => setQuery(s.name)}
                    className="block w-full px-4 py-2 text-left hover:bg-slate-50"
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Harga min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Harga max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <p className="mt-6 text-sm text-slate-500">
          {loading ? "Mencari..." : `${total} produk ditemukan`}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-4xl">{p.imageEmoji}</div>
              <p className="mt-2 text-sm font-medium text-slate-900">{p.name}</p>
              {p.brand && <p className="text-xs text-slate-500">{p.brand}</p>}
              <p className="mt-1 text-sm font-semibold text-brand-700">{formatPrice(p.price)}</p>
              <p className="mt-1 text-xs text-slate-400">{p.categoryName}</p>
            </div>
          ))}
          {!loading && items.length === 0 && (
            <p className="col-span-full text-center text-slate-400">Tidak ada produk yang cocok.</p>
          )}
        </div>
      </main>
    </div>
  );
}
