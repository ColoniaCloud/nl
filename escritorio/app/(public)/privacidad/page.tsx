import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Politica de Privacidad — NL360" };

export default function PrivacidadPage() {
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
          Politica de Privacidad
        </h1>
        <p className="text-sm text-zinc-500">Ultima actualizacion: enero 2026</p>
      </div>

      <div className="prose-custom">
        <Section title="1. Informacion que recopilamos">
          Recopilamos informacion que nos proporcionas directamente al crear una cuenta (nombre,
          correo electronico, contrasena), al utilizar el Servicio (contenido generado, preferencias,
          historial de conversaciones) y automaticamente mediante tecnologias de seguimiento (datos
          de uso, direccion IP, tipo de dispositivo).
        </Section>

        <Section title="2. Como usamos tu informacion">
          Utilizamos la informacion recopilada para: (a) proveer, mantener y mejorar el Servicio;
          (b) procesar transacciones y enviar notificaciones relacionadas; (c) responder a comentarios
          y preguntas; (d) monitorear el uso del Servicio para detectar y prevenir fraudes;
          (e) enviarte comunicaciones de marketing, con tu consentimiento.
        </Section>

        <Section title="3. Compartir informacion">
          No vendemos ni alquilamos tu informacion personal a terceros. Podemos compartir informacion
          con: proveedores de servicios que nos asisten en la operacion del Servicio (bajo acuerdos
          de confidencialidad); autoridades cuando sea requerido por ley; terceros en caso de fusion,
          adquisicion o venta de activos.
        </Section>

        <Section title="4. Seguridad de datos">
          Implementamos medidas tecnicas y organizativas razonables para proteger tu informacion
          personal contra acceso no autorizado, alteracion, divulgacion o destruccion. Sin embargo,
          ninguna transmision por Internet es completamente segura.
        </Section>

        <Section title="5. Retencion de datos">
          Conservamos tu informacion personal durante el tiempo necesario para cumplir con los
          propositos descritos en esta politica, a menos que la ley exija un periodo de retencion
          mayor.
        </Section>

        <Section title="6. Tus derechos">
          Tienes derecho a: acceder a tu informacion personal; solicitar su correccion o eliminacion;
          oponerte al procesamiento de tus datos; solicitar la portabilidad de tus datos. Para
          ejercer estos derechos, contactanos en{" "}
          <a href="mailto:privacidad@nl360.site" className="text-violet-400 hover:text-violet-300">
            privacidad@nl360.site
          </a>
          .
        </Section>

        <Section title="7. Cookies">
          Utilizamos cookies y tecnologias similares para mejorar tu experiencia. Consulta nuestra{" "}
          <Link href="/cookies" className="text-violet-400 hover:text-violet-300">
            Politica de Cookies
          </Link>{" "}
          para mas informacion.
        </Section>

        <Section title="8. Cambios a esta politica">
          Podemos actualizar esta politica periodicamente. Te notificaremos sobre cambios
          significativos mediante correo electronico o un aviso en el Servicio.
        </Section>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/terminos" className="text-zinc-400 hover:text-white transition-colors">
          Terminos de Servicio
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
