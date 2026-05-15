export const metadata = {
  title: 'Terms of service - MO Goalkeeping',
};

export default function TermsPage() {
  return (
    <article className="prose-like space-y-4">

      <h1 className="text-3xl font-bold">Terms of service</h1>
      <p className="text-sm text-fg-muted">Last updated: May 2026</p>

      <h2 className="text-xl font-bold mt-6">1. About us</h2>
      <p>
        This booking platform is operated by Mike Onslow, trading as
        MO Goalkeeping. You can contact us at mike@mogoalkeeping.co.uk. In these terms, &quot;we&quot;, &quot;us&quot; and
        &quot;our&quot; refer to that entity; &quot;you&quot; and &quot;your&quot; refer to the
        adult who registers an account.
      </p>

      <h2 className="text-xl font-bold mt-6">2. What this service does</h2>
      <p>
        We let you book goalkeeper coaching sessions for players in your care, see your booking
        history, hold credit on account, and cancel within our policy. We don&apos;t provide the
        coaching itself through this site - sessions are run in person by MO Goalkeeping coaches.
      </p>

      <h2 className="text-xl font-bold mt-6">3. Your account</h2>
      <p>
        To use the service you must be 18 or over and the parent or legal guardian of any player
        you book for. You&apos;re responsible for keeping your sign-in details secure and for any
        bookings made from your account. Make sure the contact details and any medical or
        positional notes you give us about your player are accurate and up to date - we and our
        coaches rely on what you tell us.
      </p>

      <h2 className="text-xl font-bold mt-6">4. Bookings and capacity</h2>
      <p>
        Sessions are limited in number. A booking is confirmed only once we&apos;ve received
        payment (or applied credit) and you&apos;ve seen a confirmation screen and email.
        Bookings made within 24 hours of a session start need admin approval before they&apos;re
        confirmed; if we can&apos;t accept the booking we&apos;ll refund you in full (less the
        non-refundable booking fee - see clause 5).
      </p>
      <p>
        We may cancel or move a session for reasons including weather, coach availability,
        venue issues, or safeguarding. If we cancel, you&apos;ll receive credit for the full
        amount paid, including the booking fee.
      </p>

      <h2 className="text-xl font-bold mt-6">5. Pricing, fees and refunds</h2>
      <p>
        Each session price is shown before you book. Card payments add a 50p booking fee that
        covers our payment processing costs. This fee is <strong>non-refundable</strong>, as our
        card processor doesn&apos;t refund their fee to us either. Full payment details are in
        our <a href="/legal/payments">Payment FAQs</a>.
      </p>
      <p>
        Our cancellation policy:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Cancel <strong>at least 24 hours</strong> before a session and we&apos;ll credit your account for the session price (the 50p fee, where paid, isn&apos;t returned).</li>
        <li>Cancel <strong>within 24 hours</strong> and no credit is given - the slot has already been allocated.</li>
        <li>If we reject a late booking that needed approval, you&apos;ll receive a card refund for the session price.</li>
        <li>If we cancel a session ourselves, you&apos;ll get a full credit including the booking fee.</li>
      </ul>
      <p>
        Credit on your account is automatically applied to your next booking. Credit isn&apos;t
        transferable to other accounts and has no cash value.
      </p>

      <h2 className="text-xl font-bold mt-6">6. At the session</h2>
      <p>
        You&apos;re responsible for getting your player to and from sessions on time. Coaching
        involves physical activity and there&apos;s an ordinary risk of minor injury that you
        accept by booking. Tell us about any medical condition, allergy or learning need before
        the session so our coaches can plan accordingly.
      </p>
      <p>
        Photography and filming during sessions is governed by our separate safeguarding and
        photography consent processes (ask us if you&apos;re unsure). Don&apos;t film or
        photograph other people&apos;s children without permission.
      </p>

      <h2 className="text-xl font-bold mt-6">7. Behaviour</h2>
      <p>
        We may refuse a booking, end a session early, or close an account if a player, parent or
        guardian behaves in a way that&apos;s unsafe, abusive, discriminatory, or otherwise
        unreasonable. In serious cases we may also refer matters to safeguarding authorities or
        the police.
      </p>

      <h2 className="text-xl font-bold mt-6">8. Data</h2>
      <p>
        We process personal data about you and your player to run the booking service. See our{' '}
        <a href="/legal/privacy">privacy and cookies notice</a> for the detail.
      </p>

      <h2 className="text-xl font-bold mt-6">9. Liability</h2>
      <p>
        We don&apos;t exclude or limit liability where we&apos;re not legally allowed to - for
        example for death or personal injury caused by our negligence, or for fraud. Subject to
        that, our total liability to you in connection with this service is limited to the
        amount you&apos;ve paid us in the 12 months before the relevant claim.
      </p>

      <h2 className="text-xl font-bold mt-6">10. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. For material changes we&apos;ll email you
        at the address on your account at least 14 days before the new terms take effect. If you
        don&apos;t agree to a change, you can stop using the service and ask us to close your
        account.
      </p>

      <h2 className="text-xl font-bold mt-6">11. Governing law</h2>
      <p>
        These terms are governed by the laws of England and Wales, and the courts of England and
        Wales have exclusive jurisdiction over any dispute, except that if you live in Scotland
        or Northern Ireland you may also bring claims in your local courts.
      </p>

      <h2 className="text-xl font-bold mt-6">12. Contact</h2>
      <p>
        Questions about these terms? Email mike@mogoalkeeping.co.uk.
      </p>
    </article>
  );
}
