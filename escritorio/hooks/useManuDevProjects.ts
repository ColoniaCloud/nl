import { useCallback, useEffect, useState } from "react";

export type ManuDevProject = {
  id: number;
  name?: string;
  subdomain?: string;
  status: string;
};

export type NubiaProject = {
  id: number;
  name: string;
  subdomain: string;
  status: string;
};

export type ForgeProject = {
  id: number;
  name?: string;
  token_name?: string;
  token_symbol?: string;
  status: string;
};

export type SubAgentProjects = {
  manuDev: ManuDevProject[];
  nubia: NubiaProject[];
  forge: ForgeProject[];
};

export function useManuDevProjects() {
  const [projects, setProjects] = useState<SubAgentProjects>({
    manuDev: [],
    nubia: [],
    forge: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [manuDevRes, nubiaRes, forgeRes] = await Promise.allSettled([
        fetch("/api/manu-dev/projects", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nubia/projects", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/forge/projects", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setProjects({
        manuDev:
          manuDevRes.status === "fulfilled" && Array.isArray(manuDevRes.value?.projects)
            ? manuDevRes.value.projects
            : [],
        nubia:
          nubiaRes.status === "fulfilled" && Array.isArray(nubiaRes.value?.projects)
            ? nubiaRes.value.projects
            : [],
        forge:
          forgeRes.status === "fulfilled" && Array.isArray(forgeRes.value?.projects)
            ? forgeRes.value.projects
            : [],
      });
    } catch {
      setError("Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { projects, loading, error, refetch: fetchAll };
}
