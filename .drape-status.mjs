/**
 * Draft-saree drape status probe for the batch driver.
 * Prints ALL DRAFTS COMPLETE when every draft has 4+ renders,
 * otherwise a summary line the driver can pattern-match.
 */
const { readFileSync } = await import("node:fs");

const cookie = readFileSync(".admin-cookie.txt", "utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.trim().split(/\t/))
  .filter((parts) => parts.length >= 7)
  .map((parts) => `${parts[5]}=${parts[6]}`)
  .pop();

const res = await fetch("http://localhost:3000/api/admin/products", {
  headers: { Cookie: cookie },
});
const { products = [] } = await res.json();
const drafts = products.filter((p) => p.dbStatus === "draft" && (p.images?.length ?? 0) > 0);
const incomplete = drafts.filter((p) => (p.marketing?.tryOn?.renders?.length ?? 0) < 4);

if (drafts.length > 0 && incomplete.length === 0) {
  console.log(`ALL DRAFTS COMPLETE (${drafts.length} drafts, 4 poses each)`);
} else {
  console.log(
    `PENDING: ${incomplete.length} of ${drafts.length} drafts incomplete ` +
      `(0 renders: ${incomplete.filter((p) => (p.marketing?.tryOn?.renders?.length ?? 0) === 0).length}, ` +
      `partial: ${incomplete.filter((p) => { const r = (p.marketing?.tryOn?.renders?.length ?? 0); return r > 0 && r < 4; }).length})`,
  );
}
