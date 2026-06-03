'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/schemas/auth';

export default function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const uid = searchParams.get('uid');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({ resolver: zodResolver(resetPasswordSchema) });

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

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid, newPassword: data.newPassword }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error || 'Error al cambiar.');
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
                  className="react-aria-Button btn-primary mt-4 px-6 py-2"
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
                  className="react-aria-Button mt-4 px-6 py-2"
                >
                  Nuevo enlace
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="react-aria-Label text-xs">
                    CONTRASEÑA
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      {...register('newPassword')}
                      className="react-aria-Input w-full h-10"
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
                  {errors.newPassword && (
                    <p className="react-aria-FieldError">{errors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm-password" className="react-aria-Label text-xs">
                    CONFIRMAR
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    {...register('confirmPassword')}
                    className="react-aria-Input w-full mt-2 h-10"
                  />
                  {errors.confirmPassword && (
                    <p className="react-aria-FieldError">{errors.confirmPassword.message}</p>
                  )}
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="react-aria-Button btn-primary w-full h-10 font-semibold"
                >
                  {loading ? 'Cambiando...' : 'Cambiar'}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="react-aria-Link text-xs"
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
