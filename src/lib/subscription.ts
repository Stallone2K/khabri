import { prisma } from "@/lib/prisma";

/**
 * Shape returned by GET /api/subscription/status and consumed by
 * useSubscription(), the usage page, and the settings billing tab.
 */
export interface UserLimits {
  user: {
    id: string;
    name: string | null;
    memberSince: string | null;
  };
  plan: {
    slug: string;
    name: string;
  };
  subscription: {
    status: string;
    source: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  limits: {
    maxSources: number;
    maxProjects: number;
    maxArticles: number;
    maxApiKeys: number;
    maxApiCallsPerDay: number;
    maxWebhooks: number;
    maxNarrativePerDay: number;
    hasMarketFull: boolean;
    hasExport: boolean;
  };
  usage: {
    currentSources: number;
    currentProjects: number;
    currentArticles: number;
    currentApiKeys: number;
    apiCallsToday: number;
    currentWebhooks: number;
  };
}

// Used when the user has no Subscription row (or Plan table isn't seeded yet).
const FREE_PLAN_DEFAULTS = {
  slug: "free",
  name: "Free",
  maxSources: 5,
  maxProjects: 2,
  maxArticles: 500,
  maxApiKeys: 1,
  maxApiCallsPerDay: 100,
  maxWebhooks: 0,
  maxNarrativePerDay: 1,
  hasMarketFull: false,
  hasExport: false,
};

export async function getUserPlan(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (subscription && subscription.status !== "EXPIRED") {
    return { plan: subscription.plan, subscription };
  }
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
  return { plan: freePlan, subscription: null };
}

export async function getUserLimits(userId: string): Promise<UserLimits> {
  const [{ plan, subscription }, user] = await Promise.all([
    getUserPlan(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  const limits = plan
    ? {
        maxSources: plan.maxSources,
        maxProjects: plan.maxProjects,
        maxArticles: plan.maxArticles,
        maxApiKeys: plan.maxApiKeys,
        maxApiCallsPerDay: plan.maxApiCallsPerDay,
        maxWebhooks: plan.maxWebhooks,
        maxNarrativePerDay: plan.maxNarrativePerDay,
        hasMarketFull: plan.hasMarketFull,
        hasExport: plan.hasExport,
      }
    : { ...FREE_PLAN_DEFAULTS };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const userKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true },
  });
  const keyIds = userKeys.map((k) => k.id);

  const [currentSources, currentProjects, currentArticles, currentApiKeys, currentWebhooks, apiCallsToday] =
    await Promise.all([
      prisma.source.count({ where: { userId } }),
      prisma.project.count({ where: { userId } }),
      prisma.article.count({ where: { source: { userId } } }),
      prisma.apiKey.count({ where: { userId, isActive: true } }),
      prisma.webhook.count({ where: { userId } }),
      keyIds.length
        ? prisma.apiUsageLog.count({
            where: { keyId: { in: keyIds }, createdAt: { gte: startOfToday } },
          })
        : Promise.resolve(0),
    ]);

  return {
    user: {
      id: user?.id ?? userId,
      name: user?.name ?? null,
      memberSince: user?.createdAt?.toISOString() ?? null,
    },
    plan: {
      slug: plan?.slug ?? FREE_PLAN_DEFAULTS.slug,
      name: plan?.name ?? FREE_PLAN_DEFAULTS.name,
    },
    subscription: {
      status: subscription?.status ?? "ACTIVE",
      source: subscription?.source ?? "FREE",
      currentPeriodStart: subscription?.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    },
    limits: {
      maxSources: limits.maxSources,
      maxProjects: limits.maxProjects,
      maxArticles: limits.maxArticles,
      maxApiKeys: limits.maxApiKeys,
      maxApiCallsPerDay: limits.maxApiCallsPerDay,
      maxWebhooks: limits.maxWebhooks,
      maxNarrativePerDay: limits.maxNarrativePerDay,
      hasMarketFull: limits.hasMarketFull,
      hasExport: limits.hasExport,
    },
    usage: {
      currentSources,
      currentProjects,
      currentArticles,
      currentApiKeys,
      apiCallsToday,
      currentWebhooks,
    },
  };
}

/**
 * Check whether the user is under a numeric plan limit (-1 = unlimited).
 * Returns { allowed, current, max }.
 */
export async function checkLimit(
  userId: string,
  limit: "maxSources" | "maxProjects" | "maxApiKeys" | "maxWebhooks",
): Promise<{ allowed: boolean; current: number; max: number }> {
  const { plan } = await getUserPlan(userId);
  const max = plan ? plan[limit] : FREE_PLAN_DEFAULTS[limit];
  if (max === -1) return { allowed: true, current: 0, max };

  const counts = {
    maxSources: () => prisma.source.count({ where: { userId } }),
    maxProjects: () => prisma.project.count({ where: { userId } }),
    maxApiKeys: () => prisma.apiKey.count({ where: { userId, isActive: true } }),
    maxWebhooks: () => prisma.webhook.count({ where: { userId } }),
  };
  const current = await counts[limit]();
  return { allowed: current < max, current, max };
}
