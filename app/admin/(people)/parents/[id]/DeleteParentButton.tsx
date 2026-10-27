'use client';

import { SubmitButton } from '@/lib/ui/SubmitButton';
import { deleteParent } from './actions';

export function DeleteParentButton({
  parentId,
  parentName,
  childCount,
  bookingCount,
}: {
  parentId: string;
  parentName: string;
  childCount: number;
  bookingCount: number;
}) {
  const players = `${childCount} player${childCount === 1 ? '' : 's'}`;
  const bookings = `${bookingCount} booking${bookingCount === 1 ? '' : 's'}`;
  return (
    <form
      action={deleteParent}
      onSubmit={(e) => {
        if (
          !confirm(
            `Permanently delete ${parentName}, their ${players} and ${bookings}, and their login? This erases all their data and cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="parent_id" value={parentId} />
      <SubmitButton
        className="bg-[var(--danger-bg)] border border-[var(--danger-line)] text-[var(--danger-fg)] hover:bg-[var(--danger-line)]"
        pendingLabel="Deleting…"
      >
        Delete parent
      </SubmitButton>
    </form>
  );
}
