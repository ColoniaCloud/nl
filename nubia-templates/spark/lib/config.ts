import storeConfigData from "../store-config.json";

export interface StoreConfig {
  storeName: string;
  tagline: string;
  apiUrl: string;
  subdomain: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  images: {
    hero: string;
    collection: string;
    banner: string;
  };
  payments: {
    bankTransfer: { enabled: boolean; details?: Record<string, string> };
    mercadopago: { enabled: boolean; publicKey?: string; country?: string; currency?: string };
    coinbase: { enabled: boolean };
  };
  contact: { email?: string; phone?: string; whatsapp?: string; location?: string };
}

const DEFAULT_IMAGES = {
  hero: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80",
  collection: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&q=80",
  banner: "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1200&q=80",
};

const raw = storeConfigData as any;

const _config: StoreConfig = {
  ...raw,
  images: {
    hero: raw.images?.hero || DEFAULT_IMAGES.hero,
    collection: raw.images?.collection || DEFAULT_IMAGES.collection,
    banner: raw.images?.banner || DEFAULT_IMAGES.banner,
  },
};

export function getConfig(): StoreConfig {
  return _config;
}

export function getApiBase(config: StoreConfig) {
  return `${config.apiUrl}/api/nubia/storefront/${config.subdomain}`;
}
