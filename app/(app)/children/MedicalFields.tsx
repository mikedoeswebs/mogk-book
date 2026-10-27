import { formatDateLong } from '@/lib/format';

/**
 * Medical notes plus the explicit-consent box that has to go with them. Never
 * pre-ticked: consent must be an active choice.
 */
export function MedicalFields({
  notes,
  consentAt,
}: {
  notes?: string | null;
  consentAt?: string | null;
}) {
  return (
    <>
      <label className="block">
        <span className="block mb-1">Medical or other important information</span>
        <textarea
          name="notes"
          rows={3}
          className="w-full"
          defaultValue={notes ?? ''}
          placeholder="Allergies, conditions, behavioural notes, anything coaches should know."
        />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="medical_consent" className="mt-1" />
        <span className="text-sm">
          I give my explicit consent for Club MO/GK to store the health information above and
          share it with the coaches running my player&apos;s sessions. Only needed if you&apos;ve
          entered something.
          {consentAt && (
            <span className="block text-fg-muted">
              Consent recorded on {formatDateLong(consentAt.slice(0, 10))}.
            </span>
          )}
        </span>
      </label>
    </>
  );
}
