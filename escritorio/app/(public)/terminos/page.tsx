import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Terminos de Servicio — NL360" };

export default function TerminosPage() {
  return (
    <div className="py-12 md:py-16 max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-10"
      >
        <ArrowLeft className="size-4" /> Inicio
      </Link>

      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Legal</p>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
          Terminos de Servicio
        </h1>
        <p className="text-sm text-zinc-500">Ultima actualizacion: enero 2026</p>
      </div>

      <div className="prose-custom">
        <Section title="1. Aceptacion de los terminos">
          Al acceder y utilizar la plataforma NL360 (el &quot;Servicio&quot;), aceptas quedar vinculado
          por estos Terminos de Servicio. Si no estas de acuerdo con alguna parte de estos terminos,
          no podras acceder al Servicio.
        </Section>

        <Section title="2. Descripcion del servicio">
          NL360 es una suite de agentes de inteligencia artificial que permite a los usuarios crear
          sitios web, gestionar estrategias de marketing, automatizar procesos de ventas y acceder
          a mentorias interactivas. El Servicio se presta bajo un modelo de suscripcion mensual.
        </Section>

        <Section title="3. Cuentas de usuario">
          Para acceder al Servicio debes crear una cuenta. Eres responsable de mantener la
          confidencialidad de tu contrasena y de todas las actividades que ocurran bajo tu cuenta.
          Debes notificarnos de inmediato sobre cualquier uso no autorizado de tu cuenta.
        </Section>

        <Section title="4. Uso aceptable">
          Aceptas no utilizar el Servicio para: (a) actividades ilegales o que violen derechos de
          terceros; (b) generar contenido danino, difamatorio o engañoso; (c) intentar acceder a
          sistemas o datos sin autorizacion; (d) revender o sublicenciar el acceso al Servicio sin
          permiso expreso.
        </Section>

        <Section title="5. Propiedad intelectual">
          El Servicio y su contenido original, caracteristicas y funcionalidad son propiedad de
          NL360 y estan protegidos por leyes de propiedad intelectual. El contenido generado por
          el usuario mediante el Servicio es de propiedad del usuario, sujeto a la licencia
          otorgada a NL360 para operar el Servicio.
        </Section>

        <Section title="6. Limitacion de responsabilidad">
          En la maxima medida permitida por la ley aplicable, NL360 no sera responsable por danos
          indirectos, incidentales, especiales o consecuentes derivados del uso o la imposibilidad
          de uso del Servicio.
        </Section>

        <Section title="7. Modificaciones">
          Nos reservamos el derecho de modificar estos terminos en cualquier momento. Te
          notificaremos sobre cambios significativos mediante correo electronico o un aviso
          prominente en el Servicio.
        </Section>

        <Section title="8. Contacto">
          Para preguntas sobre estos Terminos de Servicio, contactanos en{" "}
          <a href="mailto:legal@nl360.site" className="text-violet-400 hover:text-violet-300">
            legal@nl360.site
          </a>
          .
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/privacidad" className="text-zinc-400 hover:text-white transition-colors">
          Politica de Privacidad
        </Link>
        <Link href="/cookies" className="text-zinc-400 hover:text-white transition-colors">
          Politica de Cookies
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      <p className="text-sm text-zinc-400 leading-relaxed">{children}</p>
    </div>
  );
}
