import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Sepatu", slug: "sepatu" },
  { name: "Elektronik", slug: "elektronik" },
  { name: "Pakaian", slug: "pakaian" },
  { name: "Aksesoris", slug: "aksesoris" },
];

const PRODUCTS = [
  { name: "Sepatu Lari Ultraboost", brand: "Adidas", description: "Sepatu lari ringan dengan bantalan responsif untuk lari jarak jauh", price: 2199000, category: "sepatu", emoji: "👟" },
  { name: "Sepatu Basket Air Jordan", brand: "Nike", description: "Sepatu basket ikonik dengan grip kuat di lapangan indoor maupun outdoor", price: 2599000, category: "sepatu", emoji: "👟" },
  { name: "Sepatu Sneakers Casual", brand: "Converse", description: "Sepatu kasual sehari-hari yang cocok dipadukan dengan celana jeans", price: 899000, category: "sepatu", emoji: "👟" },
  { name: "Sandal Gunung Outdoor", brand: "Eiger", description: "Sandal untuk mendaki dengan sol anti selip", price: 349000, category: "sepatu", emoji: "🥾" },
  { name: "Sepatu Formal Kulit Pria", brand: "Bata", description: "Sepatu pantofel kulit asli untuk acara formal dan kantor", price: 749000, category: "sepatu", emoji: "👞" },
  { name: "Smartphone Galaxy S24", brand: "Samsung", description: "Ponsel pintar layar AMOLED dengan kamera 200MP", price: 12999000, category: "elektronik", emoji: "📱" },
  { name: "Laptop ThinkPad X1", brand: "Lenovo", description: "Laptop bisnis ringan dengan baterai tahan lama seharian", price: 18500000, category: "elektronik", emoji: "💻" },
  { name: "Headphone Nirkabel WH-1000", brand: "Sony", description: "Headphone dengan peredam bising aktif kualitas studio", price: 4599000, category: "elektronik", emoji: "🎧" },
  { name: "Smartwatch Fitness Tracker", brand: "Xiaomi", description: "Jam tangan pintar pelacak detak jantung dan tidur", price: 599000, category: "elektronik", emoji: "⌚" },
  { name: "Kamera Mirrorless Alpha", brand: "Sony", description: "Kamera untuk fotografi profesional dengan sensor full frame", price: 24999000, category: "elektronik", emoji: "📷" },
  { name: "Power Bank 20000mAh", brand: "Anker", description: "Baterai portabel kapasitas besar untuk pengisian cepat", price: 349000, category: "elektronik", emoji: "🔋" },
  { name: "Kaos Polos Cotton Combed", brand: "Uniqlo", description: "Kaos katun lembut untuk pemakaian sehari-hari", price: 149000, category: "pakaian", emoji: "👕" },
  { name: "Jaket Hoodie Oversize", brand: "H&M", description: "Jaket hangat dengan tudung untuk gaya kasual musim dingin", price: 399000, category: "pakaian", emoji: "🧥" },
  { name: "Celana Jeans Slim Fit", brand: "Levi's", description: "Celana denim potongan ramping bahan berkualitas tinggi", price: 599000, category: "pakaian", emoji: "👖" },
  { name: "Kemeja Flanel Kotak-kotak", brand: "Zara", description: "Kemeja lengan panjang motif kotak untuk tampilan kasual", price: 349000, category: "pakaian", emoji: "👔" },
  { name: "Dress Casual Wanita", brand: "Mango", description: "Gaun santai untuk acara sehari-hari maupun jalan-jalan", price: 449000, category: "pakaian", emoji: "👗" },
  { name: "Tas Ransel Laptop", brand: "Eiger", description: "Tas punggung dengan kompartemen laptop 15 inci tahan air", price: 449000, category: "aksesoris", emoji: "🎒" },
  { name: "Jam Tangan Analog Klasik", brand: "Casio", description: "Jam tangan bergaya vintage dengan tali kulit", price: 799000, category: "aksesoris", emoji: "⌚" },
  { name: "Kacamata Hitam Polarized", brand: "Rayban", description: "Kacamata pelindung sinar UV dengan lensa anti silau", price: 1299000, category: "aksesoris", emoji: "🕶️" },
  { name: "Topi Baseball Cap", brand: "New Era", description: "Topi santai dengan logo bordir depan", price: 199000, category: "aksesoris", emoji: "🧢" },
  { name: "Dompet Kulit Pria", brand: "Fossil", description: "Dompet kulit asli dengan banyak slot kartu", price: 549000, category: "aksesoris", emoji: "👛" },
  { name: "Sepatu Sepak Bola Mercurial", brand: "Nike", description: "Sepatu untuk lapangan rumput dengan traksi maksimal", price: 1799000, category: "sepatu", emoji: "⚽" },
  { name: "Tablet Galaxy Tab", brand: "Samsung", description: "Tablet untuk produktivitas dan hiburan layar besar", price: 5999000, category: "elektronik", emoji: "📱" },
  { name: "Speaker Bluetooth Portable", brand: "JBL", description: "Speaker tahan air dengan suara bass yang kuat", price: 799000, category: "elektronik", emoji: "🔊" },
  { name: "Rok Midi Wanita", brand: "Mango", description: "Rok sepanjang lutut bahan flowy nyaman dipakai", price: 299000, category: "pakaian", emoji: "👗" },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.admin.upsert({
    where: { email: "admin@search.dev" },
    update: {},
    create: { name: "Admin Toko", email: "admin@search.dev", passwordHash },
  });

  const categoryMap = new Map<string, string>();
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
    categoryMap.set(c.slug, category.id);
  }

  const existingCount = await prisma.product.count();
  if (existingCount === 0) {
    for (const p of PRODUCTS) {
      await prisma.product.create({
        data: {
          name: p.name,
          brand: p.brand,
          description: p.description,
          price: p.price,
          imageEmoji: p.emoji,
          categoryId: categoryMap.get(p.category)!,
        },
      });
    }
  }

  console.log(`Seed selesai. ${CATEGORIES.length} kategori, ${PRODUCTS.length} produk.`);
  console.log("Login admin: admin@search.dev / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
