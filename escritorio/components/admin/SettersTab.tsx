"use client";

import { useEffect, useState } from "react";

type SetterRow = {
  setter_id: number;
  setter_username: string;
  setter_email: string;
  client_count: number;
};

type ClientRow = {
  id: number;
  client_id: number;
  username: string;
  email: string;
  plan_slug: string;
  created_at: string;
};

export default function SettersTab() {
  const [setters, setSetters] = useState<SetterRow[] | null>(null);
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [selectedSetter, setSelectedSetter] = useState<{ id: number; username: string } | null>(null);
  const [loadingSetters, setLoadingSetters] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [errorSetters, setErrorSetters] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Error al cargar setters");
        setSetters(d.setters ?? []);
      })
      .catch((e: Error) => setErrorSetters(e.message))
      .finally(() => setLoadingSetters(false));
  }, []);

  function handleVerClientes(row: SetterRow) {
    setSelectedSetter({ id: row.setter_id, username: row.setter_username });
    setClients(null);
    setLoadingClients(true);
    fetch(`/api/admin/clients?setterId=${row.setter_id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "Error al cargar clientes");
        setClients(d.clients ?? []);
      })
      .catch(() => setClients([]))
      .finally(() => setLoadingClients(false));
  }

  if (loadingSetters) {
    return (
      <div className="p-6 space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />
        ))}
      </div>
    );
  }

  if (errorSetters) {
    return (
      <div className="p-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
        {errorSetters}
      </div>
    );
  }

  // ── Fase 2: clientes del setter seleccionado ──────────────────────────────
  if (selectedSetter) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => { setSelectedSetter(null); setClients(null); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Volver
          </button>
          <h2 className="text-sm font-semibold text-foreground">
            Clientes de {selectedSetter.username}
          </h2>
        </div>

        {loadingClients ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-10 bg-white/[0.05] rounded-lg" />)}
          </div>
        ) : !clients || clients.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin clientes registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground/70">
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {clients.map((c) => (
                  <tr key={c.id} className="text-zinc-300">
                    <td className="py-2.5 pr-4 font-medium">{c.username}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{c.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5">
                        {c.plan_slug.replace("nl360_", "")}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-500 text-xs">
                      {new Date(c.created_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Fase 1: tabla de setters ──────────────────────────────────────────────
  return (
    <div className="p-6">
      {!setters || setters.length === 0 ? (
        <p className="text-sm text-zinc-500">No hay setters registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground/70">
                <th className="pb-2 pr-4 font-medium">Setter</th>
                <th className="pb-2 pr-4 font-medium">Email</th>
                <th className="pb-2 pr-4 font-medium">Clientes</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {setters.map((row) => (
                <tr key={row.setter_id} className="text-zinc-300">
                  <td className="py-2.5 pr-4 font-medium">{row.setter_username}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{row.setter_email}</td>
                  <td className="py-2.5 pr-4">{row.client_count}</td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleVerClientes(row)}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
