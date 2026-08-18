import prisma from '@/lib/prisma/client';

/**
 * Seeds the three rules most merchants want on day one. They are created
 * DISABLED so no credit incentive goes live until a merchant reviews it.
 */
export async function seedDefaultRules({ shopId }) {
  const existing = await prisma.creditRule.count({ where: { shopId } });
  if (existing > 0) return { seeded: 0 };

  const definitions = [
    {
      name: 'Standard Return Credit',
      description: 'Offer a 10% bonus on returns of $50 or more.',
      priority: 10,
      bonusType: 'PERCENTAGE',
      bonusValue: 10,
      maxBonusAmount: 25,
      minRefundAmount: 50,
      customerEligibility: 'ALL',
      conditions: [{ field: 'refundAmount', operator: 'gte', value: 50 }],
    },
    {
      name: 'VIP Return',
      description: 'Reward customers with 5 or more orders with a 15% bonus.',
      priority: 30,
      bonusType: 'PERCENTAGE',
      bonusValue: 15,
      maxBonusAmount: 50,
      customerEligibility: 'VIP',
      conditions: [{ field: 'customerOrderCount', operator: 'gte', value: 5 }],
    },
    {
      name: 'High Value Customer',
      description: 'Offer a 10% bonus to customers with $500+ lifetime value.',
      priority: 20,
      bonusType: 'PERCENTAGE',
      bonusValue: 10,
      maxBonusAmount: 40,
      customerEligibility: 'ALL',
      conditions: [{ field: 'customerLifetimeValue', operator: 'gte', value: 500 }],
    },
  ];

  for (const def of definitions) {
    const { conditions, ...rule } = def;
    await prisma.creditRule.create({
      data: {
        shopId,
        enabled: false, // merchant reviews before any bonus goes live
        ...rule,
        conditions: { create: conditions },
      },
    });
  }

  return { seeded: definitions.length };
}
