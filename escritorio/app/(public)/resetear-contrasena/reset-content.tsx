'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const uid = searchParams.get('uid');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    if (!token || !uid) {
      setError('Enlace invalido.');
      setValidating(false);
      return;
    }

    const validate = async () => {
      try {
        const res = await fetch('/api/auth/reset-password?validate=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, uid }),
        });
        const data = await res.json();
        if (data?.valid) {
          setIsValidToken(true);
        } else {
          setError(data?.error || 'Token invalido o expirado.');
        }
      } catch {
        setError('Error al validar enlace.');
      } finally {
        setValidating(false);
      }
    };

    validate();
  }, [token, uid]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Minimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Error al cambiar.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Error de conexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <img
              src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
              alt="NL360"
              className="h-10 w-auto invert"
            />
            <h1 className="mt-6 text-4xl font-semibold text-white">
              Nueva contraseña
            </h1>
            <p className="mt-3 text-zinc-400">
              Crea una contraseña fuerte y segura.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-8">
            <div className="mb-6">
              <div className="text-sm text-zinc-500">NL360</div>
              <div className="font-semibold text-white">Resetear contraseña</div>
            </div>

            {validating ? (
              <div className="text-center py-8">
                <Loader2 className="mx-auto mb-4 size-8 animate-spin text-violet-400" />
                <p className="text-sm text-zinc-400">Validando...</p>
              </div>
            ) : success ? (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto mb-4 size-8 text-emerald-400" />
                <p className="font-semibold text-white">Listo!</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Contraseña cambiada.
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-block rounded-lg bg-violet-600 px-6 py-2 text-white hover:bg-violet-500"
                >
                  Ir al login
                </Link>
              </div>
            ) : !isValidToken ? (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto mb-4 size-8 text-red-400" />
                <p className="font-semibold text-white">Enlace invalido</p>
                <p className="mt-2 text-sm text-zinc-400">
                  {error || 'Solicita uno nuevo.'}
                </p>
                <Link
                  href="/recuperar-contrasena"
                  className="mt-4 inline-block border border-white/10 rounded-lg px-6 py-2 text-white hover:border-white/30"
                >
                  Nuevo enlace
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-500">
                    CONTRASEÑA
                  </label>
                  <div className="relative mt-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full h-10 rounded-lg border border-white/10 bg-zinc-800 px-3 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-zinc-400"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-500">
                    CONFIRMAR
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-2 w-full h-10 rounded-lg border border-white/10 bg-zinc-800 px-3 text-white"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-lg bg-violet-600 font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {loading ? 'Cambiando...' : 'Cambiar'}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Volver al login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
