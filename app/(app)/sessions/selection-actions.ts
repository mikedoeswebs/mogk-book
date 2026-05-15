'use server';

import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/auth/require-parent';
import {
  addSessionRow,
  removeRow,
  clearSelection,
} from '@/lib/booking/selection';

/**
 * Always appends another row for the given session. A parent can call this
 * twice for the same session (two siblings on one Saturday) and get two
 * distinct selection rows.
 */
export async function addToSelection(formData: FormData) {
  await requireParent();
  const sessionId = String(formData.get('session_id') ?? '').trim();
  if (!sessionId) return;
  await addSessionRow(sessionId);
  revalidatePath('/sessions');
  revalidatePath('/book');
}

export async function removeFromSelection(formData: FormData) {
  await requireParent();
  const id = String(formData.get('row_id') ?? '').trim();
  if (!id) return;
  await removeRow(id);
  revalidatePath('/sessions');
  revalidatePath('/book');
}

export async function clearAllSelection() {
  await requireParent();
  await clearSelection();
  revalidatePath('/sessions');
  revalidatePath('/book');
}
