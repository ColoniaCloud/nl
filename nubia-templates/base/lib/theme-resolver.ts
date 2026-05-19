/**
 * Theme Resolver — maps theme name from store-config.json to component set.
 * Adding a new theme requires:
 * 1. Create components/themes/{name}/ with HomePage, Navbar, Footer, ProductCard
 * 2. Add the theme name here
 */

export const VALID_THEMES = [
  "boutique",
  "fresh",
  "spark",
  "classic",
  "neon",
  "terra",
] as const;

export type ThemeName = (typeof VALID_THEMES)[number];

export function isValidTheme(name: string): name is ThemeName {
  return VALID_THEMES.includes(name as ThemeName);
}

export function resolveTheme(name?: string): ThemeName {
  if (name && isValidTheme(name)) return name;
  return "boutique"; // fallback
}
