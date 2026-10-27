'use client';

import { SubmitButton } from '@/lib/ui/SubmitButton';
import { adminDeleteChild } from './actions';

export function DeleteChildButton({
  parentId,
  childId,
  childName,
}: {
  parentId: string;
  childId: string;
  childName: string;
}) {
  return (
    <form
      action={adminDeleteChild}
      onSubmit={(e) => {
        if (!confirm(`Delete ${childName} and all their bookings? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="child_id" value={childId} />
      <SubmitButton className="text-sm" pendingLabel="Deleting…">
        Delete
      </SubmitButton>
    </form>
  );
}
