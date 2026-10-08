"use client";
import { getConfig } from "@/lib/config";
import { resolveTheme } from "@/lib/theme-resolver";

import BoutiqueProductCard from "./themes/boutique/ProductCard";
import FreshProductCard from "./themes/fresh/ProductCard";
import SparkProductCard from "./themes/spark/ProductCard";
import ClassicProductCard from "./themes/classic/ProductCard";
import NeonProductCard from "./themes/neon/ProductCard";
import TerraProductCard from "./themes/terra/ProductCard";

const MAP = {
  boutique: BoutiqueProductCard,
  fresh: FreshProductCard,
  spark: SparkProductCard,
  classic: ClassicProductCard,
  neon: NeonProductCard,
  terra: TerraProductCard,
} as const;

export default function ProductCard({ product }: { product: any }) {
  const cfg = getConfig();
  const theme = resolveTheme(cfg.theme);
  const ThemedCard = MAP[theme];
  return <ThemedCard product={product} />;
}
