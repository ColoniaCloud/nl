import Link from "next/link";
import {
  WandSparkles,
  Megaphone,
  Handshake,
  GraduationCap,
  Rocket,
  Code2,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type IconKey = "magic" | "bullhorn" | "handshake" | "graduation" | "rocket" | "code";
type ColorKey = "violet" | "indigo" | "emerald" | "rose" | "orange" | "sky" | "zinc";

const ICONS: Record<IconKey, React.ElementType> = {
  magic: WandSparkles,
  bullhorn: Megaphone,
  handshake: Handshake,
  graduation: GraduationCap,
  rocket: Rocket,
  code: Code2,
};

const COLORS: Record<ColorKey, { icon: string; cta: string; glow: string }> = {
  violet: {
    icon: "bg-violet-500/20 text-violet-400",
    cta: "text-violet-400",
    glow: "hover:shadow-[var(--glow-violet)]",
  },
  indigo: {
    icon: "bg-indigo-500/20 text-indigo-400",
    cta: "text-indigo-400",
    glow: "hover:shadow-[var(--glow-indigo)]",
  },
  emerald: {
    icon: "bg-emerald-500/20 text-emerald-400",
    cta: "text-emerald-400",
    glow: "hover:shadow-[var(--glow-emerald)]",
  },
  rose: {
    icon: "bg-rose-500/20 text-rose-400",
    cta: "text-rose-400",
    glow: "hover:shadow-[var(--glow-rose)]",
  },
  orange: {
    icon: "bg-orange-500/20 text-orange-400",
    cta: "text-orange-400",
    glow: "hover:shadow-[var(--glow-orange)]",
  },
  sky: {
    icon: "bg-sky-500/20 text-sky-400",
    cta: "text-sky-400",
    glow: "hover:shadow-[var(--glow-sky)]",
  },
  zinc: {
    icon: "bg-zinc-500/20 text-zinc-400",
    cta: "text-zinc-400",
    glow: "hover:shadow-[var(--glow-zinc)]",
  },
};

export default function AgentCard({
  title,
  description,
  href,
  icon,
  color = "zinc",
  badge,
  featured = false,
}: {
  title: string;
  description: string;
  href: string;
  icon: IconKey;
  color?: ColorKey;
  badge?: string;
  featured?: boolean;
}) {
  const c = COLORS[color];
  const Icon = ICONS[icon];

  return (
    <Link href={href} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden border-border bg-card/60 py-0 transition-all duration-200",
          "hover:-translate-y-0.5 hover:bg-card hover:border-white/[0.15]",
          c.glow,
          featured ? "p-6" : "p-5"
        )}
      >
        <CardContent className={cn("p-0", featured ? "space-y-4" : "space-y-3")}>
          {/* Icon + badge row */}
          <div className="flex items-start justify-between">
            <div
              className={cn(
                "flex items-center justify-center rounded-lg",
                c.icon,
                featured ? "size-12" : "size-10"
              )}
            >
              <Icon className={featured ? "size-5" : "size-4"} />
            </div>
            {badge && (
              <Badge variant="outline" className="text-2xs font-semibold tracking-wide">
                {badge}
              </Badge>
            )}
          </div>

          {/* Title + description */}
          <div>
            <div className={cn("font-semibold tracking-tight text-foreground", featured ? "text-lg" : "text-sm")}>
              {title}
            </div>
            <p className={cn("mt-1 text-muted-foreground leading-relaxed", featured ? "text-sm" : "text-xs")}>
              {description}
            </p>
          </div>

          {/* CTA */}
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold transition-all duration-200",
              "group-hover:gap-2.5",
              c.cta
            )}
          >
            Abrir agente
            <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
