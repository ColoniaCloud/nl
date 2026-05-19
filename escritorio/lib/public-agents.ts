export type SubAgent = {
  slug: string;
  name: string;
  description: string;
  badge?: string;
};

export type Agent = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  color: string;
  icon: string;
  badge?: string;
  subAgents?: SubAgent[];
};

export const AGENTS: Agent[] = [
  {
    slug: "manu-dev",
    name: "Manu Dev",
    tagline: "Crea sitios Next.js con IA",
    description:
      "Genera, despliega y gestiona sitios web completos mediante chat. Desde una landing page hasta un e-commerce con tienda integrada.",
    color: "emerald",
    icon: "code",
    badge: "Popular",
  },
  {
    slug: "margarita",
    name: "Margarita",
    tagline: "Marketing en redes sociales",
    description:
      "Gestiona tu estrategia de contenido, automatiza publicaciones y mide el impacto de tus campanas en todas las redes.",
    color: "rose",
    icon: "bullhorn",
    subAgents: [
      {
        slug: "margarita-content",
        name: "Contenido",
        description: "Genera copies, graficos e ideas de contenido para cada red social.",
      },
      {
        slug: "margarita-calendar",
        name: "Calendario Editorial",
        description: "Planifica y programa tus publicaciones con estrategia mensual.",
      },
      {
        slug: "margarita-ads",
        name: "Ads & Campanas",
        description: "Crea y optimiza campanas pagas en Meta e Instagram.",
      },
    ],
  },
  {
    slug: "jordan",
    name: "Jordan",
    tagline: "Ventas y cierre comercial",
    description:
      "Filtra leads, califica prospectos y asiste a tu equipo de ventas con guiones, objeciones y estrategias de cierre.",
    color: "orange",
    icon: "handshake",
    subAgents: [
      {
        slug: "jordan-leads",
        name: "Captacion de Leads",
        description: "Formularios, landing pages y embudos optimizados para captar clientes.",
      },
      {
        slug: "jordan-closer",
        name: "Closer IA",
        description: "Asistente de cierre que responde objeciones y guia la negociacion.",
      },
    ],
  },
  {
    slug: "mentoria",
    name: "MentorIA",
    tagline: "Formacion inteligente para equipos y emprendedores",
    description:
      "Accede a los cursos de NL360 o entrena un agente Teacher con los documentos de tu empresa para onboarding, mentoria interna y certificacion de empleados.",
    color: "sky",
    icon: "graduation",
    subAgents: [
      {
        slug: "cursos-nl360",
        name: "Cursos NL360",
        description: "Accede al catalogo de cursos de NL360 en formato de chat interactivo con un mentor IA.",
        badge: "Cursos",
      },
      {
        slug: "teacher",
        name: "Teacher",
        description: "Entrena un agente mentor con los documentos, estatutos y manuales de tu empresa. Ofrece mentoria personalizada a empleados con evaluacion y certificacion incluidas.",
        badge: "Empresas",
      },
    ],
  },
];

export function getAgent(slug: string): Agent | undefined {
  return AGENTS.find((a) => a.slug === slug);
}

export function getSubAgent(agentSlug: string, subSlug: string): SubAgent | undefined {
  const agent = getAgent(agentSlug);
  return agent?.subAgents?.find((s) => s.slug === subSlug);
}
