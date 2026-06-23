import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing");
}

const sql = neon(databaseUrl);

const TOTAL_PRODUCTS = 200_000;
const BATCH_SIZE = 1000;

const CATEGORIES = [
  "Electronics",
  "Books",
  "Clothing",
  "Home & Kitchen",
  "Sports",
  "Toys",
  "Beauty",
  "Groceries",
  "Automotive",
  "Furniture",
];

const ADJECTIVES = [
  "Premium",
  "Compact",
  "Wireless",
  "Eco",
  "Pro",
  "Classic",
  "Smart",
  "Portable",
];
const NOUNS = [
  "Speaker",
  "Chair",
  "Bottle",
  "Jacket",
  "Lamp",
  "Backpack",
  "Mixer",
  "Notebook",
  "Headphones",
  "Charger",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomProductName(): string {
  return `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`;
}

function randomPrice(): string {
  return (Math.random() * 4990 + 9.99).toFixed(2);
}

function randomPastDate(): Date {
  const now = Date.now();
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  const past = now - Math.floor(Math.random() * twoYearsMs);
  return new Date(past);
}

async function seed() {
  console.log(
    `Seeding ${TOTAL_PRODUCTS} products in batches of ${BATCH_SIZE}...`,
  );
  const start = Date.now();

  for (let inserted = 0; inserted < TOTAL_PRODUCTS; inserted += BATCH_SIZE) {
    const valuePlaceholders: string[] = [];
    const params: (string | Date)[] = [];
    let paramIndex = 1;

    for (let i = 0; i < BATCH_SIZE; i++) {
      const createdAt = randomPastDate();
      const updatedAt =
        Math.random() < 0.2
          ? new Date(
              createdAt.getTime() +
                Math.floor(Math.random() * (Date.now() - createdAt.getTime())),
            )
          : createdAt;

      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`,
      );
      params.push(
        randomProductName(),
        randomFrom(CATEGORIES),
        randomPrice(),
        createdAt,
        updatedAt,
      );
      paramIndex += 5;
    }

    const query = `
      INSERT INTO products (name, category, price, created_at, updated_at)
      VALUES ${valuePlaceholders.join(", ")}
    `;

    await sql.query(query, params);
    console.log(`Inserted ${inserted + BATCH_SIZE} / ${TOTAL_PRODUCTS}`);
  }

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done. Seeded ${TOTAL_PRODUCTS} products in ${seconds}s`);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
