import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { BRAND, SHOPIFY_API_KEY } from '@/lib/config';

export const metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    'CreditLoop helps Shopify merchants turn returns into store credit, then measure what that credit turns into.',
};

// The API key is read from the environment at request time, so a deployment
// picks up a changed key without a rebuild.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/*
          App Bridge must be the first script on the page, loaded synchronously
          (no async/defer), and carry the app's client ID as `data-api-key`.
          Without the key it never initialises, `window.shopify` is undefined,
          and every API call fails with a missing session token.
        */}
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
          data-api-key={SHOPIFY_API_KEY}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
