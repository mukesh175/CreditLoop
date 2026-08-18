import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Module resolution for `node --test`.
 *
 * Two jobs:
 *   1. Resolve the `@/` path alias and extensionless relative imports that
 *      Next.js handles natively.
 *   2. Swap the Prisma client and the Shopify GraphQL transport for in-memory
 *      doubles, so the financial paths can be tested end to end without a live
 *      database or a live store.
 */
const projectRoot = path.resolve(import.meta.dirname, '..');
const prismaDouble = pathToFileURL(path.join(projectRoot, 'tests/helpers/prisma-double.mjs')).href;
const shopifyDouble = pathToFileURL(path.join(projectRoot, 'tests/helpers/shopify-double.mjs')).href;

function resolveWithExtension(target) {
  if (existsSync(target) && !existsSync(path.join(target, '.'))) return target;
  for (const ext of ['', '.js', '.jsx', '.mjs']) {
    if (existsSync(target + ext)) return target + ext;
  }
  return target;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isPrismaClient =
      specifier === '@/lib/prisma/client' ||
      specifier.endsWith('/lib/prisma/client') ||
      specifier.endsWith('/lib/prisma/client.js');

    if (isPrismaClient) return { url: prismaDouble, shortCircuit: true };

    const isShopifyGraphql =
      specifier === '@/lib/shopify/graphql' ||
      specifier.endsWith('/lib/shopify/graphql') ||
      specifier.endsWith('/lib/shopify/graphql.js');

    if (isShopifyGraphql) return { url: shopifyDouble, shortCircuit: true };

    if (specifier.startsWith('@/')) {
      const target = resolveWithExtension(path.join(projectRoot, specifier.slice(2)));
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }

    // Next.js resolves extensionless relative imports; bare Node does not.
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const parentDir = context.parentURL
        ? path.dirname(fileURLToPath(context.parentURL))
        : projectRoot;
      const target = resolveWithExtension(path.resolve(parentDir, specifier));
      if (existsSync(target)) return { url: pathToFileURL(target).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
