import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer({ storeName, contact }: {
  storeName: string;
  contact: { email?: string; whatsapp?: string; phone?: string; location?: string };
}) {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-20">
      <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <h3 className="font-heading text-lg font-bold text-gray-900 mb-3">{storeName}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">Productos de calidad seleccionados para ti.</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Navegacion</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><a href="/" className="hover:text-gray-900 transition-colors">Inicio</a></li>
            <li><a href="/productos" className="hover:text-gray-900 transition-colors">Productos</a></li>
            <li><a href="/cart" className="hover:text-gray-900 transition-colors">Carrito</a></li>
          </ul>
        </div>
        <div id="contacto">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Contacto</h4>
          <ul className="space-y-2.5 text-sm text-gray-600">
            {contact.email && (
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> <a href={`mailto:${contact.email}`} className="hover:text-gray-900">{contact.email}</a></li>
            )}
            {contact.whatsapp && (
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-gray-900">{contact.whatsapp}</a></li>
            )}
            {contact.location && (
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /> <span>{contact.location}</span></li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 text-center text-xs text-gray-400 py-5">
        &copy; {new Date().getFullYear()} {storeName}
      </div>
    </footer>
  );
}
