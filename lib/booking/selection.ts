/**
 * Server-side store for the parent's "session selection" - the list of
 * sessions they're lining up to book together. Backed by a single HttpOnly
 * cookie so it survives refresh, doesn't bleed into client JS, and renders
 * cleanly through SSR.
 *
 * Each row has its own id so a parent can sign more than one child up for
 * the same session (twins, siblings) without the entries collapsing.
 *
 * The cookie is *not* trusted: every consumer (review page, bulk reservation
 * action) re-validates session ids, child ownership, capacity, and price at
 * the moment of use.
 */

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'mo-selection';
const MAX_ITEMS = 50;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type SelectionItem = {
  id: string;
  sessionId: string;
  childId?: string;
};

export type Selection = {
  items: SelectionItem[];
};

export async function getSelection(): Promise<Selection> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return { items: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    const items: SelectionItem[] = parsed.items
      .slice(0, MAX_ITEMS)
      .filter((i: unknown): i is Partial<SelectionItem> => {
        return !!i && typeof i === 'object'
          && typeof (i as SelectionItem).sessionId === 'string';
      })
      .map((i: Partial<SelectionItem>) => ({
        id: typeof i.id === 'string' && i.id.length > 0 ? i.id : randomUUID(),
        sessionId: i.sessionId as string,
        childId: typeof i.childId === 'string' ? i.childId : undefined,
      }));
    return { items };
  } catch {
    return { items: [] };
  }
}

export async function writeSelection(selection: Selection): Promise<void> {
  const store = await cookies();
  if (selection.items.length === 0) {
    store.delete(COOKIE_NAME);
    return;
  }
  store.set(COOKIE_NAME, JSON.stringify({ items: selection.items.slice(0, MAX_ITEMS) }), {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function selectionSize(): Promise<number> {
  return (await getSelection()).items.length;
}

export async function countSessionInSelection(sessionId: string): Promise<number> {
  return (await getSelection()).items.filter((i) => i.sessionId === sessionId).length;
}

// --- Mutators (called from server actions) ---------------------------------

/** Always appends - duplicates by sessionId are allowed (e.g. two siblings). */
export async function addSessionRow(sessionId: string): Promise<void> {
  const sel = await getSelection();
  if (sel.items.length >= MAX_ITEMS) return;
  sel.items.push({ id: randomUUID(), sessionId });
  await writeSelection(sel);
}

export async function removeRow(id: string): Promise<void> {
  const sel = await getSelection();
  sel.items = sel.items.filter((i) => i.id !== id);
  await writeSelection(sel);
}

export async function setChildForRow(id: string, childId: string | null): Promise<void> {
  const sel = await getSelection();
  sel.items = sel.items.map((i) =>
    i.id === id ? { ...i, childId: childId ?? undefined } : i,
  );
  await writeSelection(sel);
}

export async function clearSelection(): Promise<void> {
  await writeSelection({ items: [] });
}
