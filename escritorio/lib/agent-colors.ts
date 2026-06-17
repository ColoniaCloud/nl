import {
  Code2,
  Megaphone,
  Handshake,
  GraduationCap,
  ShoppingBag,
  Hammer,
  type LucideIcon,
} from "lucide-react";

export type AgentMeta = {
  color: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  /** Icono representativo del agente (lucide-react) */
  icon: LucideIcon;
};

export const AGENT_META = {
  "manu-dev": {
    color: "emerald",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    dotClass: "bg-emerald-400",
    icon: Code2,
  },
  margarita: {
    color: "rose",
    textClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/30",
    dotClass: "bg-rose-400",
    icon: Megaphone,
  },
  jordan: {
    color: "orange",
    textClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
    dotClass: "bg-orange-400",
    icon: Handshake,
  },
  mentoria: {
    color: "sky",
    textClass: "text-sky-400",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/30",
    dotClass: "bg-sky-400",
    icon: GraduationCap,
  },
  nubia: {
    color: "violet",
    textClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/30",
    dotClass: "bg-violet-400",
    icon: ShoppingBag,
  },
  forge: {
    color: "amber",
    textClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    dotClass: "bg-amber-400",
    icon: Hammer,
  },
} as const satisfies Record<string, AgentMeta>;

export type AgentId = keyof typeof AGENT_META;
