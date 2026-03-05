export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: '30px auto', padding: 20 }}>
      <h1>Privacy Policy</h1>
      <p>WidgetAI collects only the data required to provide booking and support features.</p>
      <h3>Data we process</h3>
      <ul>
        <li>Business configuration (hours, services, contact details)</li>
        <li>Customer booking details (name, phone/email, booking time)</li>
        <li>Conversation logs for service quality and troubleshooting</li>
      </ul>
      <h3>How we use data</h3>
      <ul>
        <li>To run booking operations and calendar sync</li>
        <li>To provide owner/admin dashboards</li>
        <li>To investigate failures and support requests</li>
      </ul>
      <h3>Retention and deletion</h3>
      <p>Business owners can request session-level conversation deletion through admin controls.</p>
      <h3>Contact</h3>
      <p>For privacy requests, email <a href="mailto:nimobenne@gmail.com">nimobenne@gmail.com</a>.</p>
    </main>
  );
}
