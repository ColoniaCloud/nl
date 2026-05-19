import { Leaf, Mail, Phone, MapPin } from "lucide-react";

export default function Footer({ storeName, contact }: {
  storeName: string;
  contact: { email?: string; whatsapp?: string; phone?: string; location?: string };
}) {
  return (
    <footer className="bg-amber-50/60 border-t border-amber-100 mt-20">
      <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
            <h3 className="font-heading text-xl font-bold text-stone-800">{storeName}</h3>
          </div>
          <p className="text-sm text-stone-500 max-w-sm leading-relaxed">
            Productos naturales seleccionados con cuidado. Creemos en la calidad, la frescura y el compromiso con nuestros clientes.
          </p>
        </div>

        {/* Contact */}
        <div id="contacto">
          <h4 className="font-heading font-semibold text-stone-800 mb-4">Contactanos</h4>
          <ul className="space-y-3 text-sm text-stone-600">
            {contact.email && (
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--color-primary)", opacity: 0.1 }}>
                  <Mail className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                </div>
                <a href={`mailto:${contact.email}`} className="hover:text-stone-900 transition-colors">{contact.email}</a>
              </li>
            )}
            {contact.whatsapp && (
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--color-primary)", opacity: 0.1 }}>
                  <Phone className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                </div>
                <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-stone-900">{contact.whatsapp}</a>
              </li>
            )}
            {contact.location && (
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--color-primary)", opacity: 0.1 }}>
                  <MapPin className="w-4 h-4" style={{ color: "var(--color-primary)" }} />
                </div>
                <span>{contact.location}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-amber-200/60 text-center text-xs text-stone-400 py-5">
        &copy; {new Date().getFullYear()} {storeName}. Hecho con amor.
      </div>
    </footer>
  );
}
