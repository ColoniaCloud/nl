import { Provider } from "./types";
import { anthropicProvider } from "./anthropic";
import { veniceProvider } from "./venice";

export function getProvider(name: "anthropic" | "venice"): Provider {
  if (name === "venice") return veniceProvider;
  return anthropicProvider;
}

export * from "./types";
