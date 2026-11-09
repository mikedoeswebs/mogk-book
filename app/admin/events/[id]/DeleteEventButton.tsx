'use client';

import { SubmitButton } from '@/lib/ui/SubmitButton';
import { deleteEvent } from '../actions';

export function DeleteEventButton({ id, title, replies }: { id: string; title: string; replies: number }) {
  return (
    <form
      action={deleteEvent}
      onSubmit={(e) => {
        const lost = replies ? ` and its ${replies} repl${replies === 1 ? 'y' : 'ies'}` : '';
        if (!confirm(`Delete ${title}${lost}? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] hover:bg-[var(--danger-line)]"
        pendingLabel="Deleting…"
      >
        Delete event
      </SubmitButton>
    </form>
  );
}
