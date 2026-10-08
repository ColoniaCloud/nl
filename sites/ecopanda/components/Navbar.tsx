"use client";
import { getConfig } from "@/lib/config";
import { resolveTheme } from "@/lib/theme-resolver";

import BoutiqueNavbar from "./themes/boutique/Navbar";
import FreshNavbar from "./themes/fresh/Navbar";
import SparkNavbar from "./themes/spark/Navbar";
import ClassicNavbar from "./themes/classic/Navbar";
import NeonNavbar from "./themes/neon/Navbar";
import TerraNavbar from "./themes/terra/Navbar";

const MAP = {
  boutique: BoutiqueNavbar,
  fresh: FreshNavbar,
  spark: SparkNavbar,
  classic: ClassicNavbar,
  neon: NeonNavbar,
  terra: TerraNavbar,
} as const;

export default function Navbar({ storeName }: { storeName: string }) {
  const cfg = getConfig();
  const theme = resolveTheme(cfg.theme);
  const ThemedNavbar = MAP[theme];
  return <ThemedNavbar storeName={storeName} />;
}
