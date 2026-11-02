import { formatDateLong } from '@/lib/format';

/** Optional photo and video consent. Never pre-ticked; unticking withdraws it. */
export function MediaConsentField({ consentAt }: { consentAt?: string | null }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" name="media_consent" defaultChecked={!!consentAt} className="mt-1" />
      <span className="text-sm">
        I consent to photos and videos of my player being taken at sessions and used by Club MO/GK.
        Optional. Untick at any time to withdraw consent.
        {consentAt && (
          <span className="block text-fg-muted">
            Consent recorded on {formatDateLong(consentAt.slice(0, 10))}.
          </span>
        )}
      </span>
    </label>
  );
}
