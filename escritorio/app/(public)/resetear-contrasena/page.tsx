'use client';

import { Suspense } from 'react';
import ResetPasswordContent from './reset-content';

function ResetPasswordLoadingFallback() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <div className="h-10 w-24 bg-zinc-800 rounded animate-pulse" />
            <div className="mt-6 h-12 w-48 bg-zinc-800 rounded animate-pulse" />
            <div className="mt-3 h-6 w-64 bg-zinc-700 rounded animate-pulse" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-zinc-900/80 p-8">
            <div className="h-8 w-32 bg-zinc-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoadingFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
