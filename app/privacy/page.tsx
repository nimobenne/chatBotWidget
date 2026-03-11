export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: '30px auto', padding: 20, lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> March 2026</p>

      <h3>Data Controller</h3>
      <p>
        WidgetAI, operated by Nimo Benne. For privacy requests, contact{' '}
        <a href="mailto:nimobenne@gmail.com">nimobenne@gmail.com</a>.
      </p>

      <h3>Data We Process</h3>
      <ul>
        <li>Business configuration (hours, services, contact details)</li>
        <li>Customer booking details (name, phone/email, booking time)</li>
        <li>Conversation logs for service quality and troubleshooting</li>
      </ul>

      <h3>Lawful Basis</h3>
      <p>
        We process your data based on <strong>consent</strong> (provided via the chat widget consent gate)
        and <strong>legitimate interest</strong> (to fulfil booking requests and maintain service reliability).
      </p>

      <h3>How We Use Data</h3>
      <ul>
        <li>To run booking operations and calendar sync</li>
        <li>To send booking confirmation and reminder emails</li>
        <li>To provide owner/admin dashboards</li>
        <li>To investigate failures and support requests</li>
      </ul>

      <h3>Data Retention</h3>
      <p>
        Conversation logs are automatically deleted after <strong>90 days</strong>.
        Booking records are retained for the duration of the business relationship.
        Idempotency keys used for duplicate prevention are deleted after 30 days.
      </p>

      <h3>Your Rights</h3>
      <p>Under GDPR, you have the right to:</p>
      <ul>
        <li><strong>Access</strong> your personal data</li>
        <li><strong>Rectify</strong> inaccurate data</li>
        <li><strong>Erase</strong> your data (&quot;right to be forgotten&quot;)</li>
        <li><strong>Object</strong> to processing</li>
        <li><strong>Data portability</strong> &mdash; receive your data in a structured format</li>
      </ul>
      <p>
        To exercise any of these rights, email{' '}
        <a href="mailto:nimobenne@gmail.com">nimobenne@gmail.com</a>.
      </p>

      <h3>Withdrawing Consent</h3>
      <p>
        You can withdraw consent at any time by clearing your browser&apos;s local storage for the
        widget site, or by contacting us. Withdrawal does not affect the lawfulness of processing
        performed before withdrawal.
      </p>

      <h3>Contact</h3>
      <p>
        For privacy requests, email <a href="mailto:nimobenne@gmail.com">nimobenne@gmail.com</a>.
      </p>
    </main>
  );
}
