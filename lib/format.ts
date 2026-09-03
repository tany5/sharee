/** Format a rupee amount for display, e.g. formatINR(1299) -> "₹1,299". */
export function formatINR(amount: number): string {
  const value = Math.round(amount);
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Compact price like "₹199" — no decimals, no commas. */
export function formatPrice(amount: number): string {
  return `₹${Math.round(amount)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
