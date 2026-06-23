import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/lib/api";

function formatPrice(price: string) {
  const n = Number(price);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="gap-3 py-4 hover:border-primary/40 transition-colors">
      <div className="px-5 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug text-[0.95rem]">
          {product.name}
        </h3>
        <Badge variant="secondary" className="shrink-0">
          {product.category}
        </Badge>
      </div>
      <div className="px-5 flex items-baseline justify-between">
        <span className="font-mono text-lg tabular-nums">
          {formatPrice(product.price)}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          #{product.id}
        </span>
      </div>
      <div className="px-5 text-xs text-muted-foreground font-mono">
        added {formatDate(product.created_at)}
      </div>
    </Card>
  );
}

export function ProductCardSkeleton() {
  return (
    <Card className="gap-3 py-4">
      <div className="px-5 flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="px-5 flex items-baseline justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="px-5">
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}
