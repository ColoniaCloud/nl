export const AGENT_META = {
  "manu-dev": {
    color: "emerald",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  margarita: {
    color: "rose",
    textClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/30",
    dotClass: "bg-rose-400",
  },
  jordan: {
    color: "orange",
    textClass: "text-orange-400",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
    dotClass: "bg-orange-400",
  },
  mentoria: {
    color: "sky",
    textClass: "text-sky-400",
    bgClass: "bg-sky-500/10",
    borderClass: "border-sky-500/30",
    dotClass: "bg-sky-400",
  },
  nubia: {
    color: "violet",
    textClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/30",
    dotClass: "bg-violet-400",
  },
  forge: {
    color: "amber",
    textClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    dotClass: "bg-amber-400",
  },
} as const;

export type AgentId = keyof typeof AGENT_META;
