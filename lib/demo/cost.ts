/** Default per-category cost factor of the unit price (seed rows). */
const COST_FACTORS: Record<string, number> = {
  "cotton-sarees": 0.45,
  "silk-sarees": 0.62,
  "printed-sarees": 0.5,
  "chiffon-sarees": 0.5,
  "georgette-sarees": 0.52,
  "fancy-sarees": 0.58,
};

export function defaultCostFor(categorySlug: string, price: number): number {
  const factor = COST_FACTORS[categorySlug] ?? 0.5;
  return Math.max(40, Math.round(price * factor));
}
