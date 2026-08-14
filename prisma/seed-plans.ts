import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "Get started with core intelligence features",
    priceMonthly: 0,
    priceYearly: 0,
    maxSources: 5,
    maxProjects: 2,
    maxArticles: 500,
    maxApiKeys: 1,
    maxApiCallsPerDay: 100,
    maxWebhooks: 0,
    maxNarrativePerDay: 1,
    hasMarketFull: false,
    hasExport: false,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For power users who need deeper intelligence",
    priceMonthly: 84900, // ₹849
    priceYearly: 849900, // ₹8,499
    maxSources: 25,
    maxProjects: 10,
    maxArticles: 5000,
    maxApiKeys: 5,
    maxApiCallsPerDay: 2000,
    maxWebhooks: 5,
    maxNarrativePerDay: 10,
    hasMarketFull: true,
    hasExport: true,
  },
  {
    slug: "ultimate",
    name: "Ultimate",
    description: "Maximum firepower for serious analysts and builders",
    priceMonthly: 129900, // ₹1,299
    priceYearly: 1299900, // ₹12,999
    maxSources: 100,
    maxProjects: 50,
    maxArticles: 25000,
    maxApiKeys: 20,
    maxApiCallsPerDay: 10000,
    maxWebhooks: 20,
    maxNarrativePerDay: -1, // unlimited
    hasMarketFull: true,
    hasExport: true,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Custom intelligence infrastructure — talk to sales",
    priceMonthly: 0, // custom, negotiated per contract
    priceYearly: 0,
    maxSources: -1,
    maxProjects: -1,
    maxArticles: -1,
    maxApiKeys: -1,
    maxApiCallsPerDay: -1,
    maxWebhooks: -1,
    maxNarrativePerDay: -1,
    hasMarketFull: true,
    hasExport: true,
  },
  {
    slug: "unlimited",
    name: "Unlimited",
    description: "Full unrestricted access (redeem code only)",
    priceMonthly: 0,
    priceYearly: 0,
    maxSources: -1,
    maxProjects: -1,
    maxArticles: -1,
    maxApiKeys: 20,
    maxApiCallsPerDay: 50000,
    maxWebhooks: 20,
    maxNarrativePerDay: -1,
    hasMarketFull: true,
    hasExport: true,
  },
];

async function main() {
  console.log("Seeding plans...");

  for (const plan of PLANS) {
    const existing = await prisma.plan.findUnique({ where: { slug: plan.slug } });
    if (existing) {
      await prisma.plan.update({ where: { slug: plan.slug }, data: plan });
      console.log(`  Updated plan: ${plan.name}`);
    } else {
      await prisma.plan.create({ data: plan });
      console.log(`  Created plan: ${plan.name}`);
    }
  }

  // Assign free plan to all existing users without a subscription
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
  if (!freePlan) throw new Error("Free plan not found after seeding");

  const usersWithoutSub = await prisma.user.findMany({
    where: { subscription: null },
    select: { id: true },
  });

  if (usersWithoutSub.length > 0) {
    console.log(`\nAssigning Free plan to ${usersWithoutSub.length} existing user(s)...`);
    for (const user of usersWithoutSub) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          status: "ACTIVE",
          source: "FREE",
        },
      });
      console.log(`  Assigned Free plan to user ${user.id}`);
    }
  } else {
    console.log("\nAll users already have subscriptions.");
  }

  // Seed redeem codes
  const REDEEM_CODES = [
    { code: "SHOWNOMOREFREE100", label: "Friends & Family — ShowNoMore", planSlug: "unlimited", maxUses: 100 },
    { code: "STALLONEFREE100", label: "Friends & Family — Stallone", planSlug: "unlimited", maxUses: 100 },
    { code: "LAVANFREE100", label: "Friends & Family — Lavan", planSlug: "unlimited", maxUses: 100 },
  ];

  console.log("\nSeeding redeem codes...");
  for (const rc of REDEEM_CODES) {
    const existing = await prisma.redeemCode.findUnique({ where: { code: rc.code } });
    if (existing) {
      await prisma.redeemCode.update({
        where: { code: rc.code },
        data: { label: rc.label, planSlug: rc.planSlug, maxUses: rc.maxUses, isActive: true },
      });
      console.log(`  Updated redeem code: ${rc.code}`);
    } else {
      await prisma.redeemCode.create({
        data: {
          code: rc.code,
          label: rc.label,
          planSlug: rc.planSlug,
          maxUses: rc.maxUses,
          useCount: 0,
          isActive: true,
          createdBy: "SYSTEM",
        },
      });
      console.log(`  Created redeem code: ${rc.code}`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
