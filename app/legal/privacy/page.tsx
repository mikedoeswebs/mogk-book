export const metadata = {
  title: 'Privacy & cookies - MO Goalkeeping',
};

export default function PrivacyPage() {
  return (
    <article className="space-y-4">

      <h1 className="text-3xl font-bold">Privacy &amp; cookies notice</h1>
      <p className="text-sm text-fg-muted">Last updated: May 2026</p>

      <h2 className="text-xl font-bold mt-6">Who we are</h2>
      <p>
        This service is provided by Mike Onslow, trading as MO Goalkeeping. We are the data controller for personal data you
        give us when you use this booking platform. Contact: mike@mogoalkeeping.co.uk.
      </p>

      <h2 className="text-xl font-bold mt-6">What we collect</h2>
      <p>About you (the parent or guardian):</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Name, email address, and phone number (if you give it).</li>
        <li>Your account login credentials, managed by our authentication provider.</li>
        <li>Your booking history and any account credit balance.</li>
        <li>Payment metadata (last 4 digits, card brand) returned to us by Stripe - we never see or store full card numbers.</li>
      </ul>
      <p>About your player:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>First name.</li>
        <li>Date of birth (if you give it).</li>
        <li>Playing position (if you give it).</li>
        <li>Any notes you choose to add, including medical or learning information.</li>
        <li>Which sessions they&apos;re booked into, and any attendance, captain, or player-of-the-week record made by a coach.</li>
      </ul>

      <h2 className="text-xl font-bold mt-6">Why we use it</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>To run your account and let you book and cancel sessions.</li>
        <li>To take payment and issue refunds or credit.</li>
        <li>To send transactional emails - booking confirmations, cancellation receipts, and reminders. We do not send marketing emails from this service.</li>
        <li>To run the sessions safely, including making sure coaches know about medical conditions you&apos;ve shared.</li>
        <li>To keep accounting records for as long as the law requires.</li>
        <li>To investigate complaints, prevent fraud, and meet our safeguarding obligations.</li>
      </ul>
      <p>
        Our legal basis for most of this is <strong>performance of a contract</strong> (the booking
        you make with us). For tax and accounting records the basis is <strong>legal obligation</strong>.
        For safeguarding and protecting our service we rely on our <strong>legitimate interests</strong>,
        and on any guardian who provides health information we rely on <strong>explicit consent</strong>.
      </p>

      <h2 className="text-xl font-bold mt-6">Who we share it with</h2>
      <p>
        We only share personal data with the small set of providers we need to deliver the service.
        These are our processors (or independent controllers where noted):
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Supabase</strong> - database and authentication hosting. Data is held in Europe and access is restricted to admins.</li>
        <li><strong>Stripe</strong> - card payment processing. Stripe is an independent controller for payment data. See <a href="https://stripe.com/gb/privacy" rel="noreferrer noopener" target="_blank">stripe.com/gb/privacy</a>.</li>
        <li><strong>SMTP2GO</strong> - sends transactional emails on our behalf.</li>
        <li><strong>Vercel</strong> - hosts the application; receives logs and request metadata.</li>
      </ul>
      <p>
        We don&apos;t sell personal data to anyone or share it with advertisers. We may have to
        disclose data if required by law (for example, a court order) or for safeguarding reasons.
      </p>

      <h2 className="text-xl font-bold mt-6">International transfers</h2>
      <p>
        Some of our processors (notably Stripe and Vercel) process data outside the UK and EEA.
        Where they do, we rely on standard contractual clauses or other lawful safeguards, and we
        only use providers with appropriate certifications.
      </p>

      <h2 className="text-xl font-bold mt-6">How long we keep it</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Active accounts: kept while you continue to use the service.</li>
        <li>Bookings, payments, and credit ledger: kept for at least 6 years for accounting and tax purposes.</li>
        <li>Closed accounts: personal contact details are deleted on request, subject to the retention period for financial records.</li>
        <li>Session attendance and awards: retained alongside the session record while we operate the service.</li>
      </ul>

      <h2 className="text-xl font-bold mt-6">Your rights</h2>
      <p>
        Under UK GDPR you have the right to:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>ask for a copy of the personal data we hold about you (subject access);</li>
        <li>correct anything inaccurate;</li>
        <li>ask us to delete data, subject to our legal obligations to retain some records;</li>
        <li>restrict or object to certain kinds of processing;</li>
        <li>ask for your data in a portable format.</li>
      </ul>
      <p>
        To exercise any of these, email mike@mogoalkeeping.co.uk. We&apos;ll respond within
        one month. If you&apos;re unhappy with our response you can complain to the Information
        Commissioner&apos;s Office at <a href="https://ico.org.uk" rel="noreferrer noopener" target="_blank">ico.org.uk</a>.
      </p>

      <h2 className="text-xl font-bold mt-6">Cookies</h2>
      <p>
        We use a small number of cookies, all of which are strictly necessary for the service to
        work. We don&apos;t use any cookies for analytics, advertising, or third-party tracking, so
        we don&apos;t show a cookie banner.
      </p>
      <table className="mt-2">
        <thead>
          <tr><th>Cookie</th><th>Purpose</th><th>Set by</th><th>Lifetime</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase auth session</td>
            <td>Keeps you signed in.</td>
            <td>This site (via Supabase Auth)</td>
            <td>Session / up to 1 week</td>
          </tr>
          <tr>
            <td>Stripe checkout cookies</td>
            <td>Set on Stripe&apos;s payment pages to process your card payment securely and prevent fraud.</td>
            <td>Stripe (only on the checkout page)</td>
            <td>Up to 1 year</td>
          </tr>
        </tbody>
      </table>
      <p>
        You can clear or block cookies in your browser, but if you block the Supabase auth cookie
        you won&apos;t be able to sign in, and if you block Stripe cookies you won&apos;t be able to
        pay by card.
      </p>

      <h2 className="text-xl font-bold mt-6">Changes to this notice</h2>
      <p>
        We&apos;ll update the &quot;last updated&quot; date at the top of the page when we make a
        change. For material changes (like a new processor or a different purpose) we&apos;ll email
        you at the address on your account.
      </p>

      <h2 className="text-xl font-bold mt-6">Contact</h2>
      <p>
        Questions about your data or this notice? Email mike@mogoalkeeping.co.uk.
      </p>
    </article>
  );
}
