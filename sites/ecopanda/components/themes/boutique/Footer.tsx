import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer({ storeName, contact }: {
  storeName: string;
  contact: { email?: string; whatsapp?: string; phone?: string; location?: string };
}) {
  return (
    <footer className="bg-stone-900 text-stone-300 mt-24">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h3 className="font-heading text-white text-2xl font-bold mb-2">{storeName}</h3>
          <div className="boutique-separator mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center md:text-left">
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-[0.2em] mb-4">Tienda</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="hover:text-white transition-colors">Inicio</a></li>
              <li><a href="/productos" className="hover:text-white transition-colors">Coleccion</a></li>
              <li><a href="/cart" className="hover:text-white transition-colors">Carrito</a></li>
            </ul>
          </div>
          <div id="contacto">
            <h4 className="text-white text-xs font-semibold uppercase tracking-[0.2em] mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm">
              {contact.email && (
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <Mail className="w-4 h-4 text-stone-500" />
                  <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>
                </li>
              )}
              {contact.whatsapp && (
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <Phone className="w-4 h-4 text-stone-500" />
                  <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-white">{contact.whatsapp}</a>
                </li>
              )}
              {contact.location && (
                <li className="flex items-center gap-2 justify-center md:justify-start">
                  <MapPin className="w-4 h-4 text-stone-500" />
                  <span>{contact.location}</span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-[0.2em] mb-4">Horario</h4>
            <p className="text-sm text-stone-400">Lun - Vie: 9:00 - 18:00</p>
            <p className="text-sm text-stone-400">Sab: 10:00 - 14:00</p>
          </div>
        </div>
      </div>
      <div className="border-t border-stone-800 text-center text-xs text-stone-500 py-5">
        &copy; {new Date().getFullYear()} {storeName}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
