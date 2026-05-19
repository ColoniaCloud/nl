import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer({ storeName, contact }: {
  storeName: string;
  contact: { email?: string; whatsapp?: string; phone?: string; location?: string };
}) {
  return (
    <footer className="bg-gray-950 text-gray-500 mt-20">
      <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <h3 className="font-heading text-lg font-extrabold mb-3" style={{ color: "var(--color-accent)" }}>{storeName}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">Donde lo nuevo se enciende primero.</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Tienda</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/" className="hover:text-white transition-colors">Inicio</a></li>
            <li><a href="/productos" className="hover:text-white transition-colors">Productos</a></li>
            <li><a href="/cart" className="hover:text-white transition-colors">Carrito</a></li>
          </ul>
        </div>
        <div id="contacto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Contacto</h4>
          <ul className="space-y-2.5 text-sm">
            {contact.email && (
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-700" /> <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a></li>
            )}
            {contact.whatsapp && (
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-700" /> <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-white">{contact.whatsapp}</a></li>
            )}
            {contact.location && (
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-700" /> <span>{contact.location}</span></li>
            )}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Estado</h4>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-accent)" }} />
            <span>Online</span>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 text-center text-xs text-gray-700 py-4">
        &copy; {new Date().getFullYear()} {storeName} &middot; NL360
      </div>
    </footer>
  );
}
