import { Provider } from "./types";
import { anthropicProvider } from "./anthropic";
import { veniceProvider } from "./venice";
import { nvidiaProvider } from "./nvidia";

export function getProvider(name: "anthropic" | "venice" | "nvidia_nim"): Provider {
  if (name === "venice") return veniceProvider;
  if (name === "nvidia_nim") return nvidiaProvider;
  return anthropicProvider;
}

export * from "./types";
