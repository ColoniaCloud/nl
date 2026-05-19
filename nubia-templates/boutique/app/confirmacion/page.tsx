import Link from "next/link";
import { getConfig } from "@/lib/config";
import { CartProvider } from "@/components/CartContext";
import Navbar from "@/components/Navbar";
import { CheckCircle, Clock, ArrowRight } from "lucide-react";

export default function ConfirmacionPage({
  searchParams,
}: {
  searchParams: { order?: string; status?: string };
}) {
  const cfg = getConfig();
  const { order, status } = searchParams;
  const isPending = status === "pending" || status === "crypto";
  const isPaid = status === "success";

  return (
    <CartProvider>
      <Navbar storeName={cfg.storeName} />
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {isPaid ? (
          <CheckCircle className="w-16 h-16 mx-auto mb-6 text-green-500" />
        ) : (
          <Clock className="w-16 h-16 mx-auto mb-6" style={{ color: "var(--color-accent)" }} />
        )}

        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-4">
          {isPaid ? "Pago confirmado" : "Pedido recibido"}
        </h1>

        {order && (
          <p className="text-gray-500 mb-4">
            Numero de orden: <span className="font-bold text-gray-800">{order}</span>
          </p>
        )}

        <p className="text-gray-600 mb-10 leading-relaxed">
          {isPaid
            ? "Tu pago fue procesado correctamente. Recibiras un email con los detalles de tu pedido."
            : status === "crypto"
            ? "Tu pago en criptomonedas esta siendo procesado. Te notificaremos cuando sea confirmado."
            : "Recibimos tu pedido. Por favor realiza la transferencia bancaria con los datos proporcionados. Tu pedido sera confirmado al verificar el pago."}
        </p>

        {cfg.contact.email && (
          <p className="text-sm text-gray-500 mb-8">
            Consultas: <a href={`mailto:${cfg.contact.email}`} className="underline" style={{ color: "var(--color-primary)" }}>{cfg.contact.email}</a>
          </p>
        )}

        <Link
          href="/productos"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-white"
          style={{ background: "var(--color-primary)" }}
        >
          Seguir comprando
          <ArrowRight className="w-4 h-4" />
        </Link>
      </main>
    </CartProvider>
  );
}
