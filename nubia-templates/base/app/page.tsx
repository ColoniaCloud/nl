import { getConfig, getApiBase } from "@/lib/config";
import { resolveTheme } from "@/lib/theme-resolver";
import { CartProvider } from "@/components/CartContext";

/* ── Static imports for every theme (tree-shaken per build) ── */
import BoutiqueNavbar from "@/components/themes/boutique/Navbar";
import BoutiqueFooter from "@/components/themes/boutique/Footer";
import BoutiqueProductCard from "@/components/themes/boutique/ProductCard";
import BoutiqueHomePage from "@/components/themes/boutique/HomePage";

import FreshNavbar from "@/components/themes/fresh/Navbar";
import FreshFooter from "@/components/themes/fresh/Footer";
import FreshProductCard from "@/components/themes/fresh/ProductCard";
import FreshHomePage from "@/components/themes/fresh/HomePage";

import SparkNavbar from "@/components/themes/spark/Navbar";
import SparkFooter from "@/components/themes/spark/Footer";
import SparkProductCard from "@/components/themes/spark/ProductCard";
import SparkHomePage from "@/components/themes/spark/HomePage";

import ClassicNavbar from "@/components/themes/classic/Navbar";
import ClassicFooter from "@/components/themes/classic/Footer";
import ClassicProductCard from "@/components/themes/classic/ProductCard";
import ClassicHomePage from "@/components/themes/classic/HomePage";

import NeonNavbar from "@/components/themes/neon/Navbar";
import NeonFooter from "@/components/themes/neon/Footer";
import NeonProductCard from "@/components/themes/neon/ProductCard";
import NeonHomePage from "@/components/themes/neon/HomePage";

import TerraNavbar from "@/components/themes/terra/Navbar";
import TerraFooter from "@/components/themes/terra/Footer";
import TerraProductCard from "@/components/themes/terra/ProductCard";
import TerraHomePage from "@/components/themes/terra/HomePage";

const THEMES = {
  boutique: { Navbar: BoutiqueNavbar, Footer: BoutiqueFooter, ProductCard: BoutiqueProductCard, HomePage: BoutiqueHomePage },
  fresh:    { Navbar: FreshNavbar,    Footer: FreshFooter,    ProductCard: FreshProductCard,    HomePage: FreshHomePage },
  spark:    { Navbar: SparkNavbar,    Footer: SparkFooter,    ProductCard: SparkProductCard,    HomePage: SparkHomePage },
  classic:  { Navbar: ClassicNavbar,  Footer: ClassicFooter,  ProductCard: ClassicProductCard,  HomePage: ClassicHomePage },
  neon:     { Navbar: NeonNavbar,     Footer: NeonFooter,     ProductCard: NeonProductCard,     HomePage: NeonHomePage },
  terra:    { Navbar: TerraNavbar,    Footer: TerraFooter,    ProductCard: TerraProductCard,    HomePage: TerraHomePage },
} as const;

async function getFeaturedProducts(apiBase: string) {
  try {
    const res = await fetch(`${apiBase}/products?featured=1`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.products ?? [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const cfg = getConfig();
  const apiBase = getApiBase(cfg);
  const featured = await getFeaturedProducts(apiBase);
  const theme = resolveTheme(cfg.theme);
  const { Navbar, Footer, ProductCard, HomePage } = THEMES[theme];

  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <HomePage cfg={cfg} featured={featured} ProductCard={ProductCard} />
      <Footer storeName={cfg.storeName} contact={cfg.contact} />
    </CartProvider>
  );
}
