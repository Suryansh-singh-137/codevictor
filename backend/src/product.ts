import { sql } from "./db.js";

type CursorPayload = { createdAt: string; id: number };

function encodeCursor(row: { created_at: string; id: number }): string {
  const payload: CursorPayload = { createdAt: row.created_at, id: row.id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed.createdAt || !parsed.id) return null;
    return { createdAt: parsed.createdAt, id: Number(parsed.id) };
  } catch {
    return null;
  }
}

export type ProductRow = {
  id: number;
  name: string;
  category: string;
  price: string;
  created_at: string;
  updated_at: string;
};

export type ListProductsParams = {
  limit: number;
  category?: string | undefined;
  cursor?: string | undefined;
};

export type ListProductsResult = {
  data: ProductRow[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function listProducts(
  params: ListProductsParams,
): Promise<ListProductsResult> {
  const { limit, category, cursor } = params;

  let cursorCreatedAt: string | null = null;
  let cursorId: number | null = null;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) {
      throw new Error("INVALID_CURSOR");
    }
    cursorCreatedAt = decoded.createdAt;
    cursorId = decoded.id;
  }

  let queryText: string;
  let values: (string | number)[];

  if (category && cursor) {
    queryText = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      WHERE category = $1
        AND (created_at, id) < ($2, $3)
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;
    values = [category, cursorCreatedAt as string, cursorId as number];
  } else if (category && !cursor) {
    queryText = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      WHERE category = $1
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;
    values = [category];
  } else if (!category && cursor) {
    queryText = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      WHERE (created_at, id) < ($1, $2)
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;
    values = [cursorCreatedAt as string, cursorId as number];
  } else {
    queryText = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;
    values = [];
  }

  const rows = (await sql.query(queryText, values)) as unknown as ProductRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]!) : null;

  return { data: page, nextCursor, hasMore };
}

export async function listCategories(): Promise<string[]> {
  const rows =
    (await sql`SELECT DISTINCT category FROM products ORDER BY category`) as {
      category: string;
    }[];
  return rows.map((r) => r.category);
}
