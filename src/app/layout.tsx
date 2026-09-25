import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Search Engine Produk",
  description: "Pencarian produk full-text dengan autocomplete, toleransi typo, dan filter kategori/harga.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
