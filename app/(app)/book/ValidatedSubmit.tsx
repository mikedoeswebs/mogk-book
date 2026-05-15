'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function ValidatedSubmit({
  children,
  forceDisabled = false,
  className,
}: {
  children: ReactNode;
  forceDisabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const update = () => setValid(form.checkValidity());
    update();
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    return () => {
      form.removeEventListener('input', update);
      form.removeEventListener('change', update);
    };
  }, []);

  return (
    <button ref={ref} type="submit" disabled={forceDisabled || !valid} className={className}>
      {children}
    </button>
  );
}
