/** Probe not-lain/background-removal: get person silhouette for the mask. */
const fs = require("node:fs");
const sharp = require("sharp");
const BASE = "https://not-lain-background-removal.hf.space";

(async () => {
  const form = new FormData();
  const bytes = fs.readFileSync("public/marketing/models/ai-model-01.png");
  form.append("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "model.png");
  const up = await fetch(`${BASE}/gradio_api/upload`, { method: "POST", body: form });
  const [path] = await up.json();
  console.log("uploaded:", path);

  const submit = await fetch(`${BASE}/gradio_api/call/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [{ path, meta: { _type: "gradio.FileData" } }] }),
  });
  console.log("submit:", submit.status, (await submit.text()).slice(0, 120));

  // need event id — refetch response body properly
  return;
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
