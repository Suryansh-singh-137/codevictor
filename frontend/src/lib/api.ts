const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  created_at: string;
  updated_at: string;
};

export type ProductsResponse = {
  data: Product[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function fetchProducts(params: {
  category?: string;
  cursor?: string;
  limit?: number;
}): Promise<ProductsResponse> {
  const url = new URL("/products", API_BASE_URL);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  url.searchParams.set("limit", String(params.limit ?? 24));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }
  return res.json();
}

export async function fetchCategories(): Promise<string[]> {
  const url = new URL("/categories", API_BASE_URL);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch categories: ${res.status}`);
  }
  return res.json();
}
