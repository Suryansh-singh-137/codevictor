"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchProducts, fetchCategories, type Product } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { Loader2 } from "lucide-react";

const ALL_CATEGORIES = "__all__";

export default function Home() {
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<string>(ALL_CATEGORIES);

  const [products, setProducts] = useState<Product[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the category list once, to populate the filter dropdown.
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {
        /* non-fatal: dropdown just won't populate */
      });
  }, []);

  const loadFirstPage = useCallback((category: string) => {
    setLoadingInitial(true);
    setError(null);
    fetchProducts({
      category: category === ALL_CATEGORIES ? undefined : category,
    })
      .then((res) => {
        setProducts(res.data);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      })
      .catch(() => setError("Couldn't load products. Is the backend running?"))
      .finally(() => setLoadingInitial(false));
  }, []);

  // Whenever the category filter changes, reload from scratch (page 1).
  useEffect(() => {
    loadFirstPage(selectedCategory);
  }, [selectedCategory, loadFirstPage]);

  function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    fetchProducts({
      category:
        selectedCategory === ALL_CATEGORIES ? undefined : selectedCategory,
      cursor: nextCursor,
    })
      .then((res) => {
        // APPEND new rows to the existing list -- this is what makes
        // it "load more" instead of "replace the current page."
        setProducts((prev) => [...prev, ...res.data]);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      })
      .catch(() => setError("Couldn't load more products."))
      .finally(() => setLoadingMore(false));
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-1">
          <p className="text-xs font-mono uppercase tracking-wider text-primary">
            pagination
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
          <p className="text-sm text-muted-foreground">
            200,000 products, paginated with a cursor so nothing duplicates or
            disappears while you browse.
          </p>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground font-mono">
              {products.length} loaded
            </span>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingInitial
              ? Array.from({ length: 9 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))
              : products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>

          {!loadingInitial && products.length === 0 && !error && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No products found in this category.
            </div>
          )}

          {!loadingInitial && hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="lg"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" />}
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}

          {!loadingInitial && !hasMore && products.length > 0 && (
            <p className="text-center text-sm text-muted-foreground pt-4">
              You&apos;ve reached the end of the catalog.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
