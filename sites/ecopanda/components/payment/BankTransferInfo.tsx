interface BankDetails {
  bank?: string;
  account?: string;
  cbu?: string;
  alias?: string;
  holder?: string;
}

export default function BankTransferInfo({ details, amount }: { details: BankDetails; amount: number }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-blue-900">Datos para la transferencia</h3>
      <dl className="space-y-2 text-sm text-blue-800">
        {details.holder && <div className="flex gap-3"><dt className="font-medium w-24 flex-shrink-0">Titular:</dt><dd>{details.holder}</dd></div>}
        {details.bank && <div className="flex gap-3"><dt className="font-medium w-24 flex-shrink-0">Banco:</dt><dd>{details.bank}</dd></div>}
        {details.account && <div className="flex gap-3"><dt className="font-medium w-24 flex-shrink-0">Cuenta:</dt><dd>{details.account}</dd></div>}
        {details.cbu && <div className="flex gap-3"><dt className="font-medium w-24 flex-shrink-0">CBU/CCI:</dt><dd className="font-mono break-all">{details.cbu}</dd></div>}
        {details.alias && <div className="flex gap-3"><dt className="font-medium w-24 flex-shrink-0">Alias:</dt><dd className="font-mono">{details.alias}</dd></div>}
        <div className="flex gap-3 pt-2 border-t border-blue-200">
          <dt className="font-bold w-24 flex-shrink-0 text-blue-900">Monto:</dt>
          <dd className="font-bold text-blue-900 text-base">${amount.toLocaleString("es-AR")}</dd>
        </div>
      </dl>
      <p className="text-xs text-blue-600">
        Luego de realizar la transferencia, tu pedido sera confirmado al verificar el pago. Guarda el comprobante.
      </p>
    </div>
  );
}
