import Link from "next/link";

const LINKS = {
  Producto: [
    { href: "/agentes", label: "Agentes" },
    { href: "/agentes/manu", label: "Manu (Sitios web)" },
    { href: "/agentes/margarita", label: "Margarita (Marketing)" },
    { href: "/agentes/jordan", label: "Jordan (Ventas)" },
    { href: "/agentes/mentoria", label: "MentorIA" },
    { href: "/precio", label: "Precios" },
  ],
  Soluciones: [
    { href: "/enterprise", label: "Enterprise" },
    { href: "/agencias", label: "Agencias" },
    { href: "/registro", label: "Crear cuenta" },
  ],
  Legal: [
    { href: "/terminos", label: "Terminos de servicio" },
    { href: "/privacidad", label: "Privacidad" },
    { href: "/cookies", label: "Cookies" },
  ],
};

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-zinc-950 mt-24">
      <div className="w-[95vw] md:w-[80vw] mx-auto py-14">

        {/* Top: brand + links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.nl360.site/wp-content/uploads/2026/01/Isotipo-NL360-Black.svg"
                alt="NL360"
                className="h-7 w-7 invert"
              />
              <span className="text-sm font-semibold text-white">NL360</span>
            </Link>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-[200px]">
              Suite de agentes de inteligencia artificial para negocios.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">
                {section}
              </p>
              <ul className="flex flex-col gap-2.5">
                {items.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} NL360. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-600">Sistema operativo</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
