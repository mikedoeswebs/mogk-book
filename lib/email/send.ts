import { sendEmail } from './client';
import { formatDate, formatTime, formatPence } from '@/lib/format';
import type { Booking, Session, Parent, Child } from '@/lib/db/types';

type EmailContext = {
  booking: Booking;
  session: Session;
  parent: Parent;
  child: Child;
};

async function send(to: string, subject: string, text: string, html: string) {
  await sendEmail({ to, subject, text, html });
}

function sessionLine(session: Session) {
  return `${formatDate(session.date)} at ${formatTime(session.start_time)}–${formatTime(session.end_time)} with ${session.coach_name}${session.age_group ? ` (${session.age_group})` : ''}`;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: 'card',
  cash: 'cash',
  cheque: 'cheque',
  bank_transfer: 'bank transfer',
  free: 'free',
  credit: 'credit',
  other: 'other',
};

function paidLine(booking: Booking) {
  const parts = [];
  if (booking.amount_pence > 0) {
    const feeNote = booking.booking_fee_pence > 0
      ? ` (incl. ${formatPence(booking.booking_fee_pence)} booking fee)`
      : '';
    const methodNote = booking.payment_method && booking.payment_method !== 'card'
      ? ` by ${PAYMENT_METHOD_LABEL[booking.payment_method] ?? booking.payment_method}`
      : '';
    parts.push(`${formatPence(booking.amount_pence)}${feeNote}${methodNote}`);
  }
  if (booking.credit_applied_pence > 0) parts.push(`${formatPence(booking.credit_applied_pence)} credit`);
  if (parts.length === 0) {
    return booking.payment_method === 'free' ? 'Free' : 'Free';
  }
  return parts.join(' + ');
}

// ---------------- Bookings ----------------

export async function sendBookingConfirmation(ctx: EmailContext) {
  const { booking, session, parent, child } = ctx;
  const subject = `Booking confirmed - ${formatDate(session.date)}`;
  const text = `Hi ${parent.name},

Your booking for ${child.name} is confirmed.

${sessionLine(session)}
Paid: ${paidLine(booking)}

You can cancel up to 24 hours before the session for a full credit. Cancellations inside 24 hours are recorded for the coach but no credit applies.

Thanks,
Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>Your booking for <strong>${escape(child.name)}</strong> is confirmed.</p>
    <p><strong>${escape(sessionLine(session))}</strong><br>
    Paid: ${escape(paidLine(booking))}</p>
    <p>You can cancel up to 24 hours before the session for a full credit. Cancellations inside 24 hours are recorded for the coach but no credit applies.</p>
    <p>Thanks,<br>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

export async function sendBookingAwaitingApproval(ctx: EmailContext) {
  const { booking, session, parent, child } = ctx;
  const subject = `Booking received - awaiting approval (${formatDate(session.date)})`;
  const text = `Hi ${parent.name},

We've received your booking for ${child.name} and your payment has gone through.

${sessionLine(session)}
Paid: ${paidLine(booking)}

Because this session starts within 24 hours, an admin needs to approve it before it's confirmed. We'll email you as soon as we've reviewed it. If we can't accept the booking, your payment will be refunded in full.

Thanks,
Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>We've received your booking for <strong>${escape(child.name)}</strong> and your payment has gone through.</p>
    <p><strong>${escape(sessionLine(session))}</strong><br>
    Paid: ${escape(paidLine(booking))}</p>
    <p>Because this session starts within 24 hours, an admin needs to approve it before it's confirmed. We'll email you as soon as we've reviewed it. If we can't accept the booking, your payment will be refunded in full.</p>
    <p>Thanks,<br>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

export async function sendBookingApproved(ctx: EmailContext) {
  const { session, parent, child } = ctx;
  const subject = `Booking approved - ${formatDate(session.date)}`;
  const text = `Hi ${parent.name},

Your late booking for ${child.name} has been approved:

${sessionLine(session)}

See you there.

Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>Your late booking for <strong>${escape(child.name)}</strong> has been approved:</p>
    <p><strong>${escape(sessionLine(session))}</strong></p>
    <p>See you there.</p>
    <p>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

export async function sendBookingRejected(ctx: EmailContext & { reason?: string }) {
  const { booking, session, parent, child, reason } = ctx;
  const refundedPence = booking.amount_pence - booking.booking_fee_pence;
  const feeNote = booking.booking_fee_pence > 0
    ? ` The ${formatPence(booking.booking_fee_pence)} booking fee is non-refundable, as it covers card processing.`
    : '';
  const subject = `Booking declined - ${formatDate(session.date)} (refunded)`;
  const text = `Hi ${parent.name},

Unfortunately we couldn't accept your late booking for ${child.name}:

${sessionLine(session)}

${reason ? `Reason: ${reason}\n\n` : ''}A refund of ${formatPence(refundedPence)} has been issued and any credit applied has been returned.${feeNote} If you have questions, just reply to this email.

Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>Unfortunately we couldn't accept your late booking for <strong>${escape(child.name)}</strong>:</p>
    <p><strong>${escape(sessionLine(session))}</strong></p>
    ${reason ? `<p><strong>Reason:</strong> ${escape(reason)}</p>` : ''}
    <p>A refund of <strong>${escape(formatPence(refundedPence))}</strong> has been issued and any credit applied has been returned.${escape(feeNote)} If you have questions, just reply to this email.</p>
    <p>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

// ---------------- Cancellations ----------------

export async function sendCancellationCredit(ctx: EmailContext & { creditIssuedPence: number }) {
  const { session, parent, child, creditIssuedPence } = ctx;
  const subject = `Cancellation confirmed - ${formatDate(session.date)}`;
  const text = `Hi ${parent.name},

Your cancellation for ${child.name}'s session has been recorded:

${sessionLine(session)}

${formatPence(creditIssuedPence)} has been added to your credit balance and will be applied automatically to your next booking.

Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>Your cancellation for <strong>${escape(child.name)}</strong>'s session has been recorded:</p>
    <p><strong>${escape(sessionLine(session))}</strong></p>
    <p><strong>${escape(formatPence(creditIssuedPence))}</strong> has been added to your credit balance and will be applied automatically to your next booking.</p>
    <p>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

export async function sendCancellationNoRefund(ctx: EmailContext) {
  const { session, parent, child } = ctx;
  const subject = `Cancellation recorded - ${formatDate(session.date)}`;
  const text = `Hi ${parent.name},

We've recorded that ${child.name} won't be at:

${sessionLine(session)}

As the session is within 24 hours, no credit applies. We've let the coach know.

Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>We've recorded that <strong>${escape(child.name)}</strong> won't be at:</p>
    <p><strong>${escape(sessionLine(session))}</strong></p>
    <p>As the session is within 24 hours, no credit applies. We've let the coach know.</p>
    <p>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

export async function sendCancellationRefunded(ctx: EmailContext) {
  const { booking, session, parent, child } = ctx;
  const refundedPence = booking.amount_pence - booking.booking_fee_pence;
  const feeNote = booking.booking_fee_pence > 0
    ? ` The ${formatPence(booking.booking_fee_pence)} booking fee is non-refundable, as it covers card processing.`
    : '';
  const subject = `Cancellation refunded - ${formatDate(session.date)}`;
  const text = `Hi ${parent.name},

Your booking for ${child.name} has been cancelled and ${formatPence(refundedPence)} has been refunded to your card. Any credit applied has been returned to your balance.${feeNote}

${sessionLine(session)}

Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>Your booking for <strong>${escape(child.name)}</strong> has been cancelled and <strong>${escape(formatPence(refundedPence))}</strong> has been refunded to your card. Any credit applied has been returned to your balance.${escape(feeNote)}</p>
    <p><strong>${escape(sessionLine(session))}</strong></p>
    <p>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

// ---------------- Reminder ----------------

export async function sendReminder(ctx: EmailContext) {
  const { session, parent, child } = ctx;
  const subject = `Reminder - ${child.name}'s session tomorrow`;
  const text = `Hi ${parent.name},

A quick reminder that ${child.name} has a session tomorrow:

${sessionLine(session)}

See you there.

Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>A quick reminder that <strong>${escape(child.name)}</strong> has a session tomorrow:</p>
    <p><strong>${escape(sessionLine(session))}</strong></p>
    <p>See you there.</p>
    <p>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

// ---------------- Batch (bulk) bookings ----------------

type BatchItem = {
  booking: Booking;
  session: Session;
  child: Child | null;
};

type BatchContext = {
  parent: Parent;
  items: BatchItem[];
};

function renderBatchLines(items: BatchItem[]): { text: string; html: string } {
  const text = items
    .map((it) => {
      const who = it.child?.name ?? (it.booking.trialist_name ?? 'Trialist');
      return `• ${sessionLine(it.session)} - ${who} (${paidLine(it.booking)})`;
    })
    .join('\n');
  const html = items
    .map((it) => {
      const who = it.child?.name ?? (it.booking.trialist_name ?? 'Trialist');
      return `<li><strong>${escape(sessionLine(it.session))}</strong> - ${escape(who)} (${escape(paidLine(it.booking))})</li>`;
    })
    .join('');
  return { text, html: `<ul>${html}</ul>` };
}

export async function sendBookingsBatchConfirmation(ctx: BatchContext) {
  const { parent, items } = ctx;
  const count = items.length;
  const subject = `${count} booking${count === 1 ? '' : 's'} confirmed`;
  const rendered = renderBatchLines(items);

  const text = `Hi ${parent.name},

We've confirmed ${count} booking${count === 1 ? '' : 's'}:

${rendered.text}

You can cancel any of these up to 24 hours before the session for an account credit.

Thanks,
Club MO/GK`;
  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>We&apos;ve confirmed <strong>${count}</strong> booking${count === 1 ? '' : 's'}:</p>
    ${rendered.html}
    <p>You can cancel any of these up to 24 hours before the session for an account credit.</p>
    <p>Thanks,<br>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

export async function sendBookingsBatchAwaitingApproval(ctx: BatchContext) {
  const { parent, items } = ctx;
  const awaiting = items.filter((i) => i.booking.status === 'awaiting_approval');
  const confirmed = items.filter((i) => i.booking.status !== 'awaiting_approval');

  const subject = `Booking${items.length === 1 ? '' : 's'} received - some need approval`;

  const awaitingRendered = renderBatchLines(awaiting);
  const confirmedRendered = renderBatchLines(confirmed);

  const text = `Hi ${parent.name},

Thanks - we've received your bookings.

${confirmed.length > 0 ? `Confirmed:\n${confirmedRendered.text}\n\n` : ''}${awaiting.length > 0 ? `Awaiting approval (within 24 hours of the session):\n${awaitingRendered.text}\n\nWe'll email you once those are reviewed. If we can't accept any of them, you'll be refunded for those specific sessions.\n\n` : ''}Thanks,
Club MO/GK`;

  const html = `
    <p>Hi ${escape(parent.name)},</p>
    <p>Thanks - we&apos;ve received your bookings.</p>
    ${confirmed.length > 0 ? `<p><strong>Confirmed:</strong></p>${confirmedRendered.html}` : ''}
    ${awaiting.length > 0 ? `<p><strong>Awaiting approval</strong> (within 24 hours of the session):</p>${awaitingRendered.html}
      <p>We&apos;ll email you once those are reviewed. If we can&apos;t accept any of them, you&apos;ll be refunded for those specific sessions.</p>` : ''}
    <p>Thanks,<br>Club MO/GK</p>
  `;
  await send(parent.email, subject, text, html);
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
