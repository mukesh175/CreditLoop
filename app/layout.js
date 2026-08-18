import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import { BRAND } from '@/lib/config';

export const metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    'CreditLoop helps Shopify merchants turn returns into store credit, then measure what that credit turns into.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* App Bridge must load from Shopify's CDN, before any app script. */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" async />
      </head>
      <body>{children}</body>
    </html>
  );
}
