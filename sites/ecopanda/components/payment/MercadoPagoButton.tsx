"use client";
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

interface Props {
  apiBase: string;
  orderNumber: string;
  amount: number;
  publicKey: string;
}

export default function MercadoPagoButton({ apiBase, orderNumber, amount, publicKey }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/payment/mercadopago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      window.location.href = data.init_point;
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "#009ee3" }}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
        {loading ? "Redirigiendo..." : "Pagar con MercadoPago"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
