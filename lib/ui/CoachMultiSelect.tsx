'use client';

import { useState } from 'react';
import type { Coach } from '@/lib/db/types';

/**
 * Chip-style multi-select. Renders pills for the chosen coaches inside a
 * bordered "input", plus a dropdown to add more. Emits one hidden
 * <input name={name} value={coachId}> per chip so a normal server-action form
 * submit gets every selected id via `formData.getAll(name)`.
 */
export function CoachMultiSelect({
  name,
  coaches,
  defaultIds = [],
  placeholder = 'Select…',
}: {
  name: string;
  coaches: Coach[];
  defaultIds?: string[];
  placeholder?: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultIds);
  const byId = new Map(coaches.map((c) => [c.id, c]));
  const selected = selectedIds.map((id) => byId.get(id)).filter((c): c is Coach => !!c);
  const available = coaches.filter((c) => !selectedIds.includes(c.id));

  return (
    <div className="border border-line rounded bg-surface px-2 py-1.5 flex flex-wrap items-center gap-1.5">
      {selected.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 bg-surface-2 text-fg text-sm rounded px-2 py-0.5"
        >
          <span>{c.name}</span>
          <button
            type="button"
            onClick={() => setSelectedIds(selectedIds.filter((id) => id !== c.id))}
            aria-label={`Remove ${c.name}`}
            className="bg-transparent border-0 text-fg-muted hover:text-fg p-0 font-normal text-base leading-none"
          >
            ×
          </button>
        </span>
      ))}

      <select
        value=""
        onChange={(e) => {
          if (e.target.value) {
            setSelectedIds([...selectedIds, e.target.value]);
            e.target.value = '';
          }
        }}
        disabled={available.length === 0}
        className="border-0 bg-transparent text-sm flex-1 min-w-[120px] p-0"
      >
        <option value="">
          {selected.length === 0
            ? placeholder
            : available.length === 0
            ? 'All selected'
            : '+ Add coach'}
        </option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
