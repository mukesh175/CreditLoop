/**
 * Seeds demo data for local development.
 *
 * Usage: npm run seed:demo -- <shop-domain>
 *
 * Refuses to run against production. Every row it writes is tagged with a
 * `creditloop-demo` GID prefix so `clearDemoData` can remove all of it and
 * nothing else.
 */
import prisma from '../lib/prisma/client.js';
import { generateDemoData } from '../lib/demo/generate.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo data in production.');
    process.exit(1);
  }

  const domain = process.argv[2];
  if (!domain) {
    console.error('Usage: npm run seed:demo -- <shop-domain>.myshopify.com');
    process.exit(1);
  }

  const shop = await prisma.shop.upsert({
    where: { domain },
    create: { domain, name: 'Demo Store', currencyCode: 'USD', demoMode: true },
    update: { demoMode: true },
  });

  console.log(`Seeding demo data for ${domain}…`);
  const result = await generateDemoData({ shopId: shop.id, currencyCode: shop.currencyCode });

  console.log('Demo data created:');
  console.table(result);
  console.log('\nThis store is now flagged as DEMO. The dashboard shows a demo banner.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
