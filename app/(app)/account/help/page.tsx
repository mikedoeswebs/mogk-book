import Link from 'next/link';
import { requireParent } from '@/lib/auth/require-parent';

export const metadata = {
  title: 'Help - MO Goalkeeping',
};

export default async function HelpPage() {
  await requireParent();

  return (
    <article className="space-y-4 leading-relaxed">
      <h1 className="text-3xl font-bold">Help &amp; how it works</h1>
      <p>
        Thank you for using the Club MO/GK online booking system. This system is designed to make it easy to book, pay for, and manage your sessions. If something isn&apos;t covered here, email <a href="mailto:mike@mogoalkeeping.co.uk">mike@mogoalkeeping.co.uk</a>{' '}and we&apos;ll sort it.
      </p>

      <nav aria-label="On this page" className="p-4 xl:p-6 bg-surface-2 border border-line rounded text-sm w-auto inline-block">
        <p className="font-bold mb-2 text-base">On this page</p>
        <ul className="space-y-2">
          <li><a href="#signing-up">Signing up</a></li>
          <li><a href="#adding-players">Adding a player</a></li>
          <li><a href="#booking">Booking sessions</a></li>
          <li><a href="#paying">Paying</a></li>
          <li><a href="#fees-credit">Booking fees and account credit</a></li>
          <li><a href="#cancelling">Cancelling a session</a></li>
          <li><a href="#the-24-hour-rules">The 24-hour rules</a></li>
          <li><a href="#account">Managing your account</a></li>
          <li><a href="#emails">Emails you&apos;ll get from us</a></li>
          <li><a href="#contact">Getting in touch</a></li>
        </ul>
      </nav>

      <h2 id="signing-up" className="text-2xl font-bold mt-8">Signing up</h2>
      <p>
        There are no passwords. You sign in by entering your email at the{' '}<Link href="/login">log in page</Link>; we send a "magic" link to that address. Click it from your phone or computer and you&apos;re in. Links expire after an hour, so request a fresh one if it no longer works.
      </p>
      <p>
        The first time you sign in you&apos;ll be asked for your name, phone number, and to accept the <Link href="/legal/terms">terms of use</Link> and{' '}<Link href="/legal/privacy">privacy notice</Link>. You can also opt into a weekly email reminder of upcoming sessions that goes out on Friday mornings. Once that&apos;s saved you&apos;re ready to add a player and book sessions.
      </p>

      <h2 id="adding-players" className="text-2xl font-bold mt-8">Adding a player</h2>
      <p>
        Open <Link href="/children">My players</Link>{' '}and fill in the form at the bottom. We need the player&apos;s name and date of birth. The medical/important info field is optional but worth using for allergies, asthma, conditions, behavioural notes, or anything else a coach should know before the session starts.
      </p>
      <p>
        You can add as many players as you need; bookings are made per player. If you stop using the service for a player, you can remove them from the same page provided they have no bookings on record.
      </p>

      <h2 id="booking" className="text-2xl font-bold mt-8">Booking sessions</h2>
      <p>
        <Link href="/sessions">Sessions</Link>{' '}shows everything that&apos;s available for booking, either as a list or a calendar (toggle in the top right). Each session shows the date and time, coach, group, price, and the number of spots left.
      </p>
      <p>
        Click on a session to add it to your selection. You can add several sessions at once (and the same session twice if you&apos;re booking for two players). A bar appears at the top or bottom of the screen (depending on your device) showing how many sessions you have selected. When you&apos;re ready to confirm, click <strong>Review &amp; pay</strong>.
      </p>
      <p>
        On the review screen you assign a player to each session. If you haven&apos;t added players yet, do that first from <Link href="/children">My players</Link>. You can&apos;t checkout without a player attached to every session.
      </p>

      <h2 id="paying" className="text-2xl font-bold mt-8">Paying</h2>
      <p>
        Payments are handled by Stripe; we never see your card number. After you click to pay you&apos;re taken to Stripe&apos;s secure checkout page. Once the
        payment goes through, you&apos;re returned to your bookings page and we send a confirmation email.
      </p>
      <p>
        If you have credit on your account, it&apos;s applied automatically and only the remainder goes to your card. Bookings fully covered by credit don&apos;t go through Stripe at all.
      </p>
      <p>
        Booking several sessions in one go is processed as a single transaction, which keeps the booking fee down. See the section below.
      </p>

      <h2 id="fees-credit" className="text-2xl font-bold mt-8">Booking fees and account credit</h2>
      <p>
        Card payments add a small booking fee that covers what Stripe charges us to process the payment. It works out at roughly <strong>1.5% of the card total + 20p</strong>, so a single £20 session is around 50p. Because we&apos;re billed per transaction not per session, booking five at once is one fee of about £1.70 rather than five separate fees. The fee is shown before you confirm, both in the review screen and on Stripe&apos;s page.
      </p>
      <p>
        The booking fee is <strong>non-refundable</strong>{' '}because Stripe doesn&apos;t return their fee to us when a payment is refunded.
      </p>
      <p>
        Account credit is built up when you cancel a session more than 24 hours ahead, or when we cancel a session ourselves. The current balance is shown
        on your <Link href="/bookings">My bookings</Link> page along with a full log of credit added and removed. Credit applies automatically to your next booking, isn&apos;t transferable to other accounts, and has no cash value.
      </p>
      <p>
        Full detail is in the <Link href="/legal/payments">Payment FAQs</Link>.
      </p>

      <h2 id="cancelling" className="text-2xl font-bold mt-8">Cancelling a session</h2>
      <p>
        Open <Link href="/bookings">My bookings</Link>, find the booking, and click the cancel button next to it. The button tells you what will happen before
        you commit: credit, no credit, or full refund (for late bookings still awaiting approval).
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>24 hours or more before the session.</strong> The session price is added to your credit balance, which will be applied to your next booking. The booking fee isn&apos;t returned.</li>
        <li><strong>Within 24 hours of the session.</strong> The cancellation is recorded so the coach knows your player won&apos;t be there, but no credit is issued; the slot was already held.</li>
        <li><strong>Awaiting approval (late booking we haven&apos;t reviewed yet).</strong> You&apos;re refunded in full to your card.</li>
      </ul>
      <p>
        If we ever cancel a session at our end, you&apos;ll be credited the full amount including the booking fee.
      </p>

      <h2 id="the-24-hour-rules" className="text-2xl font-bold mt-8">The 24-hour rules</h2>
      <p>
        Two key things change inside the last 24 hours before a session starts. It&apos;s worth knowing both:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>Late bookings need admin approval.</strong> If you book within 24 hours of the start time, your payment is taken straight away but the booking shows as &quot;awaiting approval&quot; until we&apos;ve checked it. You&apos;ll get an email either way. If we can&apos;t accept it, the session price is refunded to your card (the booking fee stays with Stripe).
        </li>
        <li>
          <strong>Cancellations stop generating credit.</strong> Cancellations made inside the 24-hour window don&apos;t issue credit, because we&apos;ve
          already planned the session around your player. We&apos;d still rather you cancel than no-show so the coach can adjust accordingly.
        </li>
      </ul>

      <h2 id="account" className="text-2xl font-bold mt-8">Managing your account</h2>
      <p>
        <Link href="/account">My Account</Link> lets you update your name, phone number, email, and weekly-reminder preference.
      </p>
      <p>
        Changing your email sends a confirmation link to the new address. You&apos;ll carry on signing in with the old one until you click that link, so you can&apos;t accidentally lock yourself out by mistyping.
      </p>
      <p>
        We don&apos;t have a self-service way to close your account. If you want your data removed, see the <Link href="/legal/privacy">privacy notice</Link>{' '}or email us and we&apos;ll handle it.
      </p>

      <h2 id="emails" className="text-2xl font-bold mt-8">Emails you&apos;ll get from us</h2>
      <p>
        We try to keep email volume low. You&apos;ll hear from us:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>When you confirm a booking, or a late booking is approved/declined.</li>
        <li>When you cancel a booking (with credit, refund, or just confirmation as appropriate).</li>
        <li>A short reminder the day before each session.</li>
        <li>A weekly summary of upcoming sessions on Friday mornings, <em>only</em> if you opted in. You can turn this on or off any time from <Link href="/account">My account</Link>.</li>
        <li>Occasionally, important changes such as a cancelled session or an update to our terms.</li>
      </ul>

      <h2 id="contact" className="text-2xl font-bold mt-8">Getting in touch</h2>
      <p>
        For anything the site can&apos;t do, or if something doesn&apos;t look right, email <a href="mailto:mike@mogoalkeeping.co.uk">mike@mogoalkeeping.co.uk</a>. We aim to reply within a day. For safeguarding or urgent session-day matters, WhatsApp or phone is faster.
      </p>

      <p className="text-sm text-fg-muted mt-8 pt-4 border-t border-line">
        Related: <Link href="/legal/terms">Terms of service</Link> &middot;{' '}
        <Link href="/legal/privacy">Privacy &amp; cookies</Link> &middot;{' '}
        <Link href="/legal/payments">Payment FAQs</Link>
      </p>
    </article>
  );
}
