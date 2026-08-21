'use client';

import Page from '@/components/ui/Page';
import PageHeader from '@/components/ui/PageHeader';

const TEMPLATES = [
  {
    id: 'credit-issued',
    name: 'Credit issued',
    subject: 'Your store credit is ready',
    when: 'Sent when store credit is issued, if the campaign is enabled.',
  },
  {
    id: 'credit-reminder',
    name: 'Credit reminder',
    subject: 'You have store credit waiting for you',
    when: 'Sent to customers holding unused credit past your reminder threshold.',
  },
  {
    id: 'credit-expiring',
    name: 'Credit expiring',
    subject: 'Your store credit expires soon',
    when: 'Sent ahead of expiry, only where expiration is configured and lawful.',
  },
  {
    id: 'win-back',
    name: 'Win-back',
    subject: 'Your store credit is waiting',
    when: 'Sent to customers with credit who have not ordered in a while.',
  },
];

function EmailSettings() {
  return (
    <>
      <PageHeader
        icon="email"
        title="Customer emails"
        subtitle="The messages CreditLoop can send on your store's behalf."
      />

      <div
        className="p-3 mb-3"
        style={{
          background: 'var(--cl-warning-soft)',
          border: '1px solid #f0d89a',
          borderRadius: 10,
          fontSize: 13.5,
          color: 'var(--cl-warning)',
        }}
      >
        <strong className="d-block mb-1">Before enabling expiration reminders</strong>
        Store credit expiration is restricted or prohibited in some jurisdictions. Make sure your
        credit-expiration settings comply with applicable laws and your store policies. CreditLoop
        does not enable expiration automatically.
      </div>

      <div className="cl-card">
        <div className="cl-card-header">
          <h2 className="cl-card-title">Templates</h2>
        </div>
        <div className="cl-table-wrap">
          <table className="cl-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Subject</th>
                <th>When it sends</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.map((template) => (
                <tr key={template.id}>
                  <td className="fw-semibold">{template.name}</td>
                  <td>{template.subject}</td>
                  <td className="cl-source-note">{template.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cl-card-body border-top">
          <p className="cl-source-note mb-0">
            Emails are sent from your store's identity, not CreditLoop's. Every send is recorded in
            the notification log with a hash of the recipient — CreditLoop does not keep a permanent
            copy of your customers' email addresses.
          </p>
        </div>
      </div>
    </>
  );
}

export default function EmailSettingsPage() {
  return (
    <Page>
      <EmailSettings />
    </Page>
  );
}
