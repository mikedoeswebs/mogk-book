'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

export function PendingButton({
  className,
  pendingLabel = 'Adding…',
  children,
}: {
  className?: string;
  pendingLabel?: ReactNode;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ''} ${pending ? 'opacity-60 cursor-wait' : ''}`.trim()}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
