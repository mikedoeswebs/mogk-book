'use client';

import { SubmitButton } from '@/lib/ui/SubmitButton';
import { cancelAdminBooking } from './[id]/cancel/actions';

type Props = {
  bookingId: string;
  playerName: string;
  sessionLabel: string;
  issueCredit: boolean;
  refundCard: boolean;
};

export function CancelBookingButton({ bookingId, playerName, sessionLabel, issueCredit, refundCard }: Props) {
  const outcome = refundCard
    ? 'The session fee will be refunded to their card.'
    : issueCredit
      ? 'The session fee will be added as account credit.'
      : 'No refund will be issued.';

  return (
    <form
      action={cancelAdminBooking}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(`Cancel ${playerName}'s booking for ${sessionLabel}?\n\n${outcome}`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="issue_credit" value={issueCredit ? '1' : '0'} />
      <input type="hidden" name="refund_card" value={refundCard ? '1' : '0'} />
      <SubmitButton
        className="text-[var(--danger-fg)] border-0 bg-transparent p-0 capitalize no-underline! hover:underline! font-normal tracking-normal"
        pendingLabel="Cancelling…"
      >
        Cancel
      </SubmitButton>
    </form>
  );
}
