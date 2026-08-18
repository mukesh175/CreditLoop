/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The admin UI renders inside the Shopify Admin iframe.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors https://*.myshopify.com https://admin.shopify.com;',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
