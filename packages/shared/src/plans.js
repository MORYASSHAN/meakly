export const PLAN_LIMITS = {
  free: 5,
  pro: 100,
  power: Number.MAX_SAFE_INTEGER,
};

export const PLAN_PRICE_IDS = {
  pro: 'STRIPE_PRO_PRICE_ID',
  power: 'STRIPE_POWER_PRICE_ID',
};

export function normalizePlan(plan) {
  if (typeof plan !== 'string') {
    return 'free';
  }

  const normalized = plan.trim().toLowerCase();
  if (normalized === 'pro' || normalized === 'power') {
    return normalized;
  }
  return 'free';
}

export function getPlanLimit(plan) {
  return PLAN_LIMITS[normalizePlan(plan)] ?? PLAN_LIMITS.free;
}

export function getPlanPriceEnvKey(plan) {
  return PLAN_PRICE_IDS[normalizePlan(plan)] || null;
}

export function isUnlimitedPlan(plan) {
  return normalizePlan(plan) === 'power';
}

export function getPlanSummary(plan) {
  const normalized = normalizePlan(plan);
  const emailsPerMonth = getPlanLimit(normalized);

  return {
    name: normalized,
    emailsPerMonth: isUnlimitedPlan(normalized) ? null : emailsPerMonth,
    unlimited: isUnlimitedPlan(normalized),
  };
}
