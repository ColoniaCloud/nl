'use client';

import { useState } from 'react';

const glassStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  borderRadius: '16px',
  padding: '2.5rem 2rem',
  width: '100%',
  maxWidth: '400px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.25)',
  color: 'white',
  borderRadius: '8px',
  padding: '0.75rem 0.875rem',
  fontSize: '0.95rem',
  outline: 'none',
};

export function HeroLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // El endpoint espera `username` (acepta email o usuario)
        body: JSON.stringify({ username: email, password }),
      });
      if (res.ok) {
        window.location.href = '/workspace';
      } else {
        const data = await res.json();
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={glassStyle}>
      {/* Placeholder color para los inputs glass */}
      <style>{`.hlf-input::placeholder { color: rgba(255,255,255,0.5); }`}</style>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) handleSubmit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <input
          className="hlf-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          style={inputStyle}
        />
        <input
          className="hlf-input"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={inputStyle}
        />

        {error && (
          <p style={{ color: '#ffb4b4', fontSize: '0.8rem', margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: 'white',
            color: '#111',
            fontWeight: 700,
            borderRadius: '8px',
            padding: '0.8rem',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            fontSize: '0.95rem',
          }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1.25rem',
          fontSize: '0.8rem',
        }}
      >
        <a href="/recuperar-contrasena" style={{ color: 'rgba(255,255,255,0.75)' }}>
          ¿Olvidaste tu contraseña?
        </a>
        <a href="/registro" style={{ color: 'white', fontWeight: 600 }}>
          Crear cuenta
        </a>
      </div>
    </div>
  );
}

export default HeroLoginForm;
