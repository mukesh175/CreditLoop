import '../legal.css';
import { BRAND } from '@/lib/config';

export const metadata = {
  title: `Privacy Policy — ${BRAND.name}`,
  description: 'How CreditLoop handles merchant and customer data.',
};

// Fill these in before publishing. Shopify requires a reachable privacy policy
// URL and a working contact address for data requests.
const OPERATOR = {
  legalName: '[YOUR LEGAL ENTITY NAME]',
  contactEmail: '[privacy@yourdomain.com]',
  address: '[YOUR REGISTERED ADDRESS]',
  jurisdiction: '[YOUR COUNTRY / STATE]',
};

const EFFECTIVE_DATE = 'August 19, 2026';

export default function PrivacyPolicyPage() {
  return (
    <main className="cl-legal">
      <h1>Privacy Policy</h1>
      <p className="cl-legal-meta">
        For the {BRAND.name} Shopify application · Effective {EFFECTIVE_DATE}
      </p>

      <p>
        {BRAND.name} (“the app”, “we”) is operated by {OPERATOR.legalName}. This policy explains
        what data the app processes when a merchant installs it on their Shopify store, why we
        process it, how long we keep it, and how a merchant or their customer can have it removed.
      </p>

      <div className="cl-legal-note">
        <strong>In short:</strong> the app reads order and customer information from Shopify to
        recommend store-credit offers and produce the merchant’s own analytics. It stores Shopify
        identifiers and aggregate figures rather than personal profiles. It never stores customer
        email addresses, phone numbers or postal addresses, and it never sells data.
      </div>

      <h2>1. Who is responsible for your data</h2>
      <p>
        The merchant operating the Shopify store is the <strong>data controller</strong> for their
        customers’ personal data. {OPERATOR.legalName} acts as a <strong>data processor</strong>,
        processing that data only on the merchant’s instructions in order to provide the app.
      </p>
      <p>
        Contact: <a href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a>
        <br />
        {OPERATOR.address}
      </p>

      <h2>2. Data we process</h2>

      <h3>Merchant data</h3>
      <ul>
        <li>Store domain, store name, store email address and currency</li>
        <li>An encrypted Shopify access token used to call the Shopify Admin API</li>
        <li>Settings you configure: credit rules, campaigns and notification preferences</li>
        <li>An audit record of actions taken in the app</li>
      </ul>

      <h3>Customer data</h3>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Purpose</th>
            <th>Stored?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Shopify customer ID</td>
            <td>Linking analytics and credit records to a customer</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Customer name</td>
            <td>Shown to the merchant so they can identify a customer in the app</td>
            <td>Yes — removed on request</td>
          </tr>
          <tr>
            <td>Email address</td>
            <td>Sending credit notifications and campaigns the merchant has enabled</td>
            <td>
              <strong>No.</strong> Retrieved from Shopify at the moment of sending and discarded.
              Only an irreversible hash is kept, to avoid sending the same message twice
            </td>
          </tr>
          <tr>
            <td>Marketing consent status</td>
            <td>Ensuring no marketing email is sent without consent</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Order counts, spend totals, order dates</td>
            <td>Deciding whether a return qualifies for a store-credit offer, and analytics</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Store-credit amounts, currencies and Shopify transaction IDs</td>
            <td>Reporting and audit records for the merchant</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Phone number, postal address, payment details</td>
            <td>Not used by any feature</td>
            <td>Never requested or stored</td>
          </tr>
        </tbody>
      </table>

      <p>
        Store-credit <em>balances</em> are held by Shopify, not by us. The app reads them from
        Shopify and never holds customer funds.
      </p>

      <h2>3. Why we process it</h2>
      <ul>
        <li>
          <strong>To provide the app:</strong> calculating store-credit recommendations, issuing
          credit and refunds the merchant confirms, and displaying the merchant’s data
        </li>
        <li>
          <strong>Analytics for the merchant:</strong> how much credit was issued, redeemed, and
          what it is associated with — visible only to that merchant
        </li>
        <li>
          <strong>Emails the merchant enables:</strong> credit notifications and reminder or
          win-back campaigns
        </li>
      </ul>
      <p>
        We do not use this data to train models, build cross-merchant profiles, or advertise. We do
        not sell personal data.
      </p>

      <h2>4. Marketing consent</h2>
      <p>
        Marketing emails are sent only where all of the following are true: the merchant has enabled
        the campaign, the campaign is active, and the customer’s marketing consent status in Shopify
        is <em>subscribed</em>. Holding store credit is not treated as consent. Customers can
        withdraw consent at any time through the merchant’s store or by using the unsubscribe
        mechanism in the email, and the app will stop including them.
      </p>

      <h2>5. Automated decisions</h2>
      <p>
        The app produces store-credit <em>recommendations</em> using rules the merchant configures.
        A person reviews and confirms every credit issuance and refund. No credit is issued to a
        customer automatically, and a recommendation can only offer additional credit — a refund to
        the original payment method always remains available.
      </p>

      <h2>6. Who else processes the data</h2>
      <table>
        <thead>
          <tr>
            <th>Processor</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Shopify</td>
            <td>Source of all store data and holder of store-credit balances</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Application hosting</td>
          </tr>
          <tr>
            <td>Neon</td>
            <td>Database hosting</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Email delivery — receives a recipient address only at the moment of sending</td>
          </tr>
        </tbody>
      </table>

      <h2>7. Security</h2>
      <ul>
        <li>All data is transmitted over encrypted connections (TLS)</li>
        <li>Data is encrypted at rest by our database provider, including backups</li>
        <li>
          Shopify access tokens receive an additional layer of AES-256-GCM encryption before being
          stored, so database access alone does not yield working credentials
        </li>
        <li>Each store’s data is isolated, and every request is authenticated against that store</li>
        <li>Actions affecting store credit are recorded in an audit log available to the merchant</li>
      </ul>

      <h2>8. How long we keep data</h2>
      <ul>
        <li>
          <strong>While installed:</strong> for as long as the app is installed on the store
        </li>
        <li>
          <strong>Customer erasure request:</strong> on receiving Shopify’s customer redaction
          request, personal data is deleted. Financial records are anonymised — amounts and Shopify
          transaction IDs are retained without the customer identifier, so the merchant keeps their
          accounting record
        </li>
        <li>
          <strong>Uninstall:</strong> processing stops immediately, campaigns are paused and access
          tokens are deleted. Shopify sends a shop redaction request 48 hours later, at which point
          all remaining data for that store is deleted
        </li>
        <li>
          <strong>Customer store credit is never affected.</strong> Balances belong to the customer
          and remain in Shopify whether or not the app is installed
        </li>
      </ul>

      <h2>9. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete, restrict or
        port your personal data, and to object to its processing.
      </p>
      <p>
        <strong>Customers:</strong> please contact the store you purchased from. As their processor,
        we act on requests they pass to us, including automatically via Shopify.
      </p>
      <p>
        <strong>Merchants:</strong> contact us at{' '}
        <a href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a>. We respond within 30
        days.
      </p>

      <h2>10. International transfers</h2>
      <p>
        Our providers may process data in countries other than your own, including the United
        States. Where required, transfers rely on appropriate safeguards such as the European
        Commission’s Standard Contractual Clauses.
      </p>

      <h2>11. Data breaches</h2>
      <p>
        We maintain an incident response process. If a breach affects personal data, we notify
        affected merchants without undue delay and, where legally required, within 72 hours of
        becoming aware of it, together with what happened and what we are doing about it.
      </p>

      <h2>12. Children</h2>
      <p>
        The app is a business tool and is not directed at children. We do not knowingly process the
        personal data of children.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update this policy. Material changes will be communicated to merchants before taking
        effect, and the effective date above will be updated.
      </p>

      <h2>14. Contact</h2>
      <p>
        {OPERATOR.legalName}
        <br />
        {OPERATOR.address}
        <br />
        <a href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a>
        <br />
        Governing law: {OPERATOR.jurisdiction}
      </p>
    </main>
  );
}
