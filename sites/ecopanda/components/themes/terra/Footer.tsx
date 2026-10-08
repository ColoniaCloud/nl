import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer({ storeName, contact }: {
  storeName: string;
  contact: { email?: string; whatsapp?: string; phone?: string; location?: string };
}) {
  return (
    <footer className="bg-amber-950 text-amber-200/70 mt-20">
      <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <h3 className="font-heading text-lg font-bold text-amber-100 mb-3">{storeName}</h3>
          <p className="text-sm leading-relaxed text-amber-300/50">Conectados con la tierra, hechos con el corazon.</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400/60 mb-4">Navegar</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="/" className="hover:text-amber-100 transition-colors">Inicio</a></li>
            <li><a href="/productos" className="hover:text-amber-100 transition-colors">Productos</a></li>
            <li><a href="/cart" className="hover:text-amber-100 transition-colors">Carrito</a></li>
          </ul>
        </div>
        <div id="contacto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400/60 mb-4">Contacto</h4>
          <ul className="space-y-2.5 text-sm">
            {contact.email && (
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-amber-600" /> <a href={`mailto:${contact.email}`} className="hover:text-amber-100">{contact.email}</a></li>
            )}
            {contact.whatsapp && (
              <li className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-amber-600" /> <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:text-amber-100">{contact.whatsapp}</a></li>
            )}
            {contact.location && (
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-amber-600" /> <span>{contact.location}</span></li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-amber-800/30 text-center text-xs text-amber-700/50 py-4">
        &copy; {new Date().getFullYear()} {storeName}
      </div>
    </footer>
  );
}
