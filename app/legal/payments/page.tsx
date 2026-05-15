export const metadata = {
  title: 'Payment FAQs - MO Goalkeeping',
};

export default function PaymentsFaqPage() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-bold">Payment FAQs</h1>
      <p className="text-sm text-fg-muted">Last updated: May 2026</p>

      <p>
        We try to keep payments straightforward. Below are the questions we get most often.
        If yours isn&apos;t here, email mike@mogoalkeeping.co.uk.
      </p>

      <h2 className="text-xl font-bold mt-6">Who handles payments?</h2>
      <p>
        All card payments are processed by <strong>Stripe</strong>, a regulated payment provider
        used by millions of businesses worldwide. When you click to pay, you&apos;re taken to a
        secure page hosted by Stripe - we never see or store your full card number.
      </p>

      <h2 className="text-xl font-bold mt-6">What&apos;s the booking fee?</h2>
      <p>
        Each card payment includes a small booking fee that covers the cost Stripe charges us to
        process the payment. It&apos;s calculated as <strong>1.5% of the card total + 20p</strong> -
        so a single £20 session is 50p, and the fee scales naturally if you book several at once.
        Because Stripe doesn&apos;t return their fee to us on a refund, the booking fee is{' '}
        <strong>non-refundable</strong>.
      </p>
      <p>
        The fee is shown clearly before you pay, both in the review screen and on the Stripe
        checkout page. Bookings that are fully covered by account credit don&apos;t pay a booking
        fee.
      </p>
      <p className="text-sm text-fg-muted">
        Booking several sessions in one go (multiple sessions or multiple players) is charged as
        one transaction - you pay the booking fee once across all of them, not per session.
      </p>

      <h2 className="text-xl font-bold mt-6">What happens when I cancel?</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <strong>24 hours or more before the session:</strong> the session price is added back
          to your account as credit, which is automatically applied to your next booking. The
          50p booking fee isn&apos;t returned.
        </li>
        <li>
          <strong>Less than 24 hours before:</strong> the cancellation is recorded so the coach
          knows, but no credit is issued - the slot was held for you.
        </li>
        <li>
          <strong>If we cancel the session:</strong> you get a full credit, including the
          booking fee.
        </li>
      </ul>

      <h2 className="text-xl font-bold mt-6">What if my late booking is rejected?</h2>
      <p>
        Bookings made within 24 hours of a session need admin approval before they&apos;re
        confirmed. If we can&apos;t accept the booking, we&apos;ll refund the session price back
        to your card and return any credit you used. The 50p booking fee isn&apos;t refunded -
        we&apos;ve still paid Stripe to process the original payment.
      </p>

      <h2 className="text-xl font-bold mt-6">How does account credit work?</h2>
      <p>
        Credit appears on your account when you cancel in good time or when we issue a refund as
        credit. You can see your balance on the &quot;My bookings&quot; page. The next time you
        book, your credit is applied automatically - if it covers the full session price,
        you&apos;ll go straight through without paying again (and no booking fee is charged).
      </p>
      <p>
        Credit can&apos;t be paid out as cash and can&apos;t be moved to another account.
      </p>

      <h2 className="text-xl font-bold mt-6">Can I pay by cash, cheque, or bank transfer?</h2>
      <p>
        Cash, cheque, bank transfer, and free trial bookings are handled by our admin team
        in person rather than through the website. Talk to your coach or email{' '}
        mike@mogoalkeeping.co.uk and we&apos;ll arrange it. The 50p booking fee doesn&apos;t
        apply to non-card payments.
      </p>

      <h2 className="text-xl font-bold mt-6">Do I get a receipt?</h2>
      <p>
        Yes - Stripe automatically emails you a receipt as soon as the payment goes through. If
        you can&apos;t find it, check your spam folder, then get in touch and we&apos;ll resend
        from our side.
      </p>

      <h2 className="text-xl font-bold mt-6">Is my card data safe?</h2>
      <p>
        Card details are entered directly into Stripe&apos;s payment page, which is
        PCI-DSS compliant. We never receive, see, or store your card number; we only get back
        non-sensitive metadata (the last 4 digits and the card brand) so we can show you your
        booking history.
      </p>

      <h2 className="text-xl font-bold mt-6">Something went wrong with a payment.</h2>
      <p>
        If you were charged but don&apos;t see a booking, or you see a duplicate charge, email{' '}
        mike@mogoalkeeping.co.uk with the date and amount and we&apos;ll sort it. Most
        issues are caused by a checkout page that closed before confirming - Stripe typically
        releases the held funds within a few working days.
      </p>

      <h2 className="text-xl font-bold mt-6">Anything else?</h2>
      <p>
        Full booking terms are in our <a href="/legal/terms">terms of service</a>; data handling
        is described in our <a href="/legal/privacy">privacy notice</a>.
      </p>
    </article>
  );
}
