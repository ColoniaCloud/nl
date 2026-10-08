import { getConfig } from "@/lib/config";
import { resolveTheme } from "@/lib/theme-resolver";

import BoutiqueFooter from "./themes/boutique/Footer";
import FreshFooter from "./themes/fresh/Footer";
import SparkFooter from "./themes/spark/Footer";
import ClassicFooter from "./themes/classic/Footer";
import NeonFooter from "./themes/neon/Footer";
import TerraFooter from "./themes/terra/Footer";

const MAP = {
  boutique: BoutiqueFooter,
  fresh: FreshFooter,
  spark: SparkFooter,
  classic: ClassicFooter,
  neon: NeonFooter,
  terra: TerraFooter,
} as const;

export default function Footer({ storeName, contact }: {
  storeName: string;
  contact: { email?: string; whatsapp?: string; phone?: string; location?: string };
}) {
  const cfg = getConfig();
  const theme = resolveTheme(cfg.theme);
  const ThemedFooter = MAP[theme];
  return <ThemedFooter storeName={storeName} contact={contact} />;
}
