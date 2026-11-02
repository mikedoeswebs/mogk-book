import Link from 'next/link';

export type SortKey = 'name' | 'age';
export type Sort = { key: SortKey; asc: boolean };

/** Reads `?sort=name|age&dir=asc|desc`, defaulting to name A–Z. */
export function parseSort(sp: { sort?: string; dir?: string }): Sort {
  return { key: sp.sort === 'age' ? 'age' : 'name', asc: sp.dir !== 'desc' };
}

/**
 * Sorts rows by name or age. Age is compared via date of birth (a later DOB is
 * a younger player); players without a DOB always sit at the bottom.
 */
export function sortRows<T>(
  rows: T[],
  sort: Sort,
  get: { name: (r: T) => string; dob: (r: T) => string | null | undefined },
): T[] {
  const dir = sort.asc ? 1 : -1;
  return rows.slice().sort((a, b) => {
    if (sort.key === 'name') return dir * get.name(a).localeCompare(get.name(b));
    const da = get.dob(a);
    const db = get.dob(b);
    if (!da || !db) return da ? -1 : db ? 1 : 0;
    return dir * db.localeCompare(da);
  });
}

/**
 * Column header that links to the same page sorted by `col`, flipping
 * direction when it's already the active column. Other params are kept.
 */
export function SortHeader({
  label,
  col,
  sort,
  path,
  params = {},
  hash = '',
  className,
}: {
  label: string;
  col: SortKey;
  sort: Sort;
  path: string;
  params?: Record<string, string | undefined>;
  hash?: string;
  className?: string;
}) {
  const active = sort.key === col;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set('sort', col);
  qs.set('dir', active && sort.asc ? 'desc' : 'asc');

  return (
    <th
      className={className}
      aria-sort={active ? (sort.asc ? 'ascending' : 'descending') : undefined}
    >
      <Link href={`${path}?${qs}${hash}`} className="no-underline! text-inherit!">
        {label}
        <span aria-hidden="true" className={active ? '' : 'opacity-30'}>
          {' '}
          {active && !sort.asc ? '▼' : '▲'}
        </span>
      </Link>
    </th>
  );
}
