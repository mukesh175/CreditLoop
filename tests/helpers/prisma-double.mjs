import { createFakePrisma } from './fake-prisma.mjs';

/**
 * The in-memory database every test shares.
 *
 * tests/alias-hook.mjs resolves `lib/prisma/client` to this module, so code
 * under test talks to the fake without any production import being aware of it.
 */
export const prisma = createFakePrisma();
export default prisma;
