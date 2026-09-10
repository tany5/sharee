"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Film,
  Play,
  RefreshCcw,
  Rocket,
  Square,
} from "lucide-react";
import { PageHeader } from "@/components/admin/shared";
import { useToast } from "@/components/admin/toast";
import { formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";
import type { PipelineStatus } from "@/lib/marketing/types";

interface QueueItem {
  slug: string;
  name: string;
  category: string;
  price: number;
  image: string | null;
  status: PipelineStatus;
  statusLabel: string;
  attempts: number;
  error: string | null;
  updatedAt: string;
  tryOnUrl: string | null;
  tryOnProvider: string | null;
  catalogueUrls: string[];
  copy: { headline: string; bullets: string[]; cta: string; hashtags: string[] } | null;
  postUrls: string[];
  videoUrl: string | null;
  videoDurationSec: number | null;
  publishedAt: string | null;
  fbPostId: string | null;
  igMediaId: string | null;
  fbPhotoIds: string[];
  igImageIds: string[];
}

const SETUP_HINT =
  "Run supabase/migrations/0004_marketing_pipeline.sql + 0005_pipeline_secrets.sql in the Supabase SQL editor to enable the Marketing Studio.";

interface CatalogueItem {
  slug: string;
  name: string;
  price: number;
  images: string[];
}

const STATUS_STYLE: Record<PipelineStatus, string> = {
  pending: "bg-[#b3922f]/15 text-[#7a5c14]",
  tryon_processing: "bg-[#2c5f8a]/15 text-[#22506f]",
  tryon_completed: "bg-[#4c7a4f]/15 text-[#3f6b43]",
  rendering_video: "bg-[#6b4fa0]/15 text-[#54387f]",
  publishing: "bg-[#8a5a2c]/15 text-[#6f4522]",
  published: "bg-[#2e7d4f]/20 text-[#1f6b40]",
  failed: "bg-danger/15 text-danger",
};

const STAGE_ORDER: PipelineStatus[] = [
  "pending",
  "tryon_processing",
  "tryon_completed",
  "rendering_video",
  "publishing",
  "published",
];

function stageIndex(status: PipelineStatus): number {
  if (status === "failed") return -1;
  return STAGE_ORDER.indexOf(status);
}

export function AdminMarketing() {
  const toast = useToast();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [backend, setBackend] = useState<string>("demo");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [needsMigration, setNeedsMigration] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mktRes, prodRes] = await Promise.all([
        fetch("/api/admin/marketing", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
      ]);
      const mkt = await mktRes.json();
      const prod = await prodRes.json();
      setNeedsMigration(mkt.needsMigration === true);
      if (mkt.ok) {
        setQueue(mkt.queue as QueueItem[]);
        setBackend(mkt.backend as string);
      }
      if (prod.ok) {
        const inPipeline = new Set((mkt.queue ?? []).map((q: QueueItem) => q.slug));
        setCatalogue(
          (prod.products as (CatalogueItem & { dbStatus?: string })[])
            .filter((p) => p.dbStatus !== "deleted" && !inPipeline.has(p.slug))
            .map((p) => ({ slug: p.slug, name: p.name, price: p.price, images: p.images ?? [] })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const runStage = useCallback(
    async (slug: string, action: "advance" | "retry" | "cancel") => {
      setBusy(`${slug}:${action}`);
      setMessage(null);
      try {
        const res = await fetch("/api/admin/marketing/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, action }),
        });
        const data = await res.json();
        if (!data.ok) {
          const msg = `${slug}: ${data.error ?? "Action failed"}`;
          setMessage(msg);
          toast.error(data.error ?? "Action failed");
        } else if (data.status === "failed") {
          setMessage(`${slug}: ${data.error ?? "Stage failed"}`);
          toast.error(`${slug}: ${data.error ?? "Stage failed"}`);
        }
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load, toast],
  );

  const enqueue = useCallback(
    async (slugs: string[]) => {
      if (slugs.length === 0) return;
      setBusy("enqueue");
      setMessage(null);
      try {
        const res = await fetch("/api/admin/marketing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs }),
        });
        const data = await res.json();
        if (!data.ok) {
          setMessage(data.error ?? "Could not queue products");
          toast.error(data.error ?? "Could not queue products");
        } else {
          toast.success(`Queued ${slugs.length} product${slugs.length === 1 ? "" : "s"} for processing.`);
        }
        setSelected(new Set());
        await load();
      } finally {
        setBusy(null);
      }
    },
    [load, toast],
  );

  const processQueue = useCallback(async () => {
    setBusy("advance-all");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing/advance", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMessage(
          data.processed === 0
            ? "Nothing in flight — queue some products first."
            : `Processed ${data.processed} product(s)${data.failed ? `, ${data.failed} failed` : ""}.`,
        );
        if (data.processed > 0) {
          toast.success(
            `Processed ${data.processed} product${data.processed === 1 ? "" : "s"}${data.failed ? `, ${data.failed} failed` : ""}.`,
          );
        }
      }
      await load();
    } finally {
      setBusy(null);
    }
  }, [load, toast]);

  // Auto-run: process the queue every 20s while enabled (deferred so the
  // effect body itself never sets state synchronously).
  useEffect(() => {
    if (!autoRun) return;
    const kickoff = setTimeout(() => void processQueue(), 0);
    autoTimer.current = setInterval(() => void processQueue(), 20_000);
    return () => {
      clearTimeout(kickoff);
      if (autoTimer.current) clearInterval(autoTimer.current);
      autoTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of queue) counts.set(q.status, (counts.get(q.status) ?? 0) + 1);
    return counts;
  }, [queue]);

  const toggleSelect = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Marketing Studio"
        sub="Free mode: one saree photo → model catalogue gallery → social posts → 24s reel."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAutoRun((v) => !v)}
              className={cx(
                "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                autoRun
                  ? "bg-danger/15 text-danger hover:bg-danger/20"
                  : "bg-surface text-ink2 hover:text-ink border border-line",
              )}
            >
              {autoRun ? <Square size={15} /> : <Play size={15} />}
              {autoRun ? "Stop auto-run" : "Auto-run"}
            </button>
            <button
              type="button"
              onClick={() => void processQueue()}
              disabled={busy === "advance-all"}
              className="flex h-10 items-center gap-2 rounded-full bg-btn px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Rocket size={15} />
              {busy === "advance-all" ? "Processing…" : "Process queue"}
            </button>
          </div>
        }
      />

      {needsMigration && (
        <div className="mb-4 rounded-xl border border-[#b3922f]/40 bg-[#b3922f]/10 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Supabase setup required</p>
          <p className="mt-1 text-sm text-ink2">{SETUP_HINT}</p>
        </div>
      )}

      {message && (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink2">
          {message}
        </p>
      )}

      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STAGE_ORDER.concat("failed").map((s) => {
          const n = summary.get(s) ?? 0;
          if (n === 0) return null;
          return (
            <span
              key={s}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
                STATUS_STYLE[s],
              )}
            >
              {n} {s.replace("_", " ")}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-muted">
          backend: {backend}
        </span>
      </div>

      {/* Pipeline queue */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Clapperboard size={18} className="text-bronze" /> Pipeline queue
        </h2>
        {loading ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            Loading…
          </p>
        ) : queue.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            Nothing queued yet. Pick products from your catalogue below and press
            &ldquo;Queue selected&rdquo;.
          </p>
        ) : (
          <div className="space-y-4">
            {queue.map((q) => (
              <article key={q.slug} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {q.tryOnUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.tryOnUrl}
                      alt={`${q.name} — AI try-on`}
                      className="h-36 w-27 rounded-xl border border-line object-cover"
                    />
                  ) : q.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={q.image}
                      alt={q.name}
                      className="h-36 w-27 rounded-xl border border-line object-cover"
                    />
                  ) : (
                    <div className="flex h-36 w-27 items-center justify-center rounded-xl border border-line bg-bg text-xs text-muted">
                      no photo
                    </div>
                  )}
                  {q.videoUrl && (
                    <video
                      src={q.videoUrl}
                      controls
                      preload="metadata"
                      className="h-36 w-27 rounded-xl border border-line object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold text-ink">{q.name}</h3>
                      <span
                        className={cx(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                          STATUS_STYLE[q.status],
                        )}
                      >
                        {q.statusLabel}
                      </span>
                      {q.attempts > 0 && (
                        <span className="text-[11px] text-muted">attempt {q.attempts}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {q.category.replace(/-/g, " ")} · {formatINR(q.price)}
                      {q.tryOnProvider && ` · try-on: ${q.tryOnProvider}`}
                    </p>

                    {/* Progress rail */}
                    <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {STAGE_ORDER.map((s, i) => {
                        const cur = stageIndex(q.status);
                        const done = cur > i;
                        const active = cur === i;
                        return (
                          <li key={s}>
                            <span
                              className={cx(
                                "rounded-full px-2 py-0.5 font-semibold",
                                done && "bg-[#4c7a4f]/15 text-[#3f6b43]",
                                active && "bg-accent/25 text-ink",
                                !done && !active && "bg-bg text-muted",
                              )}
                            >
                              {s === "tryon_processing"
                                ? "try-on"
                                : s === "rendering_video"
                                  ? "reel"
                                  : s === "publishing"
                                    ? "publish"
                                    : s}
                            </span>
                          </li>
                        );
                      })}
                    </ol>

                    {q.copy && (
                      <p className="mt-2 line-clamp-2 text-sm text-ink2">
                        <span className="font-semibold text-ink">{q.copy.headline}</span>{" "}
                        — {q.copy.bullets[0]}
                      </p>
                    )}
                    {q.catalogueUrls.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {q.catalogueUrls.slice(0, 4).map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt={`${q.name} catalogue render`}
                            className="h-20 w-16 rounded-lg border border-line object-cover"
                          />
                        ))}
                        <span className="text-xs font-semibold text-muted">
                          {q.catalogueUrls.length} clean catalogue render
                          {q.catalogueUrls.length === 1 ? "" : "s"} added to product
                        </span>
                      </div>
                    )}
                    {q.postUrls.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {q.postUrls.slice(0, 4).map((url) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt={`${q.name} generated post`}
                            className="h-16 w-13 rounded-lg border border-line object-cover"
                          />
                        ))}
                        <span className="text-xs font-semibold text-muted">
                          {q.postUrls.length} image post{q.postUrls.length === 1 ? "" : "s"}
                          {q.videoDurationSec ? ` · ${q.videoDurationSec}s reel` : ""}
                        </span>
                      </div>
                    )}
                    {q.error && (
                      <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                        {q.error}
                      </p>
                    )}
                    {q.publishedAt && (
                      <p className="mt-2 text-xs text-[#1f6b40]">
                        Published {new Date(q.publishedAt).toLocaleString("en-IN")}
                        {q.fbPostId && " · FB ✓"}
                        {q.igMediaId && " · IG ✓"}
                        {q.fbPhotoIds.length > 0 && ` · FB photos ${q.fbPhotoIds.length}`}
                        {q.igImageIds.length > 0 && ` · IG images ${q.igImageIds.length}`}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {q.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => void runStage(q.slug, "retry")}
                        disabled={busy === `${q.slug}:retry`}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-btn px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <RefreshCcw size={13} /> Retry
                      </button>
                    ) : q.status !== "published" ? (
                      <button
                        type="button"
                        onClick={() => void runStage(q.slug, "advance")}
                        disabled={busy === `${q.slug}:advance`}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-btn px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        <Play size={13} /> {busy === `${q.slug}:advance` ? "Running…" : "Advance"}
                      </button>
                    ) : null}
                    {q.status !== "published" && (
                      <button
                        type="button"
                        onClick={() => void runStage(q.slug, "cancel")}
                        disabled={busy === `${q.slug}:cancel`}
                        className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-danger disabled:opacity-50"
                      >
                        <Square size={13} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Catalogue picker */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Film size={18} className="text-bronze" /> Catalogue
          </h2>
          <button
            type="button"
            onClick={() => void enqueue([...selected])}
            disabled={selected.size === 0 || busy === "enqueue"}
            className="flex h-10 items-center gap-2 rounded-full bg-btn px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Rocket size={15} />
            {busy === "enqueue" ? "Queueing…" : `Queue selected (${selected.size})`}
          </button>
        </div>
        {catalogue.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            Every catalogue product is already in the pipeline.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {catalogue.map((p) => {
              const checked = selected.has(p.slug);
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => toggleSelect(p.slug)}
                  aria-pressed={checked}
                  className={cx(
                    "rounded-2xl border p-3 text-left transition-colors",
                    checked
                      ? "border-accent bg-accent/10"
                      : "border-line bg-surface hover:border-accent/50",
                  )}
                >
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="mb-2 aspect-3/4 w-full rounded-xl border border-line object-cover"
                    />
                  ) : (
                    <div className="mb-2 aspect-3/4 w-full rounded-xl border border-line bg-bg" />
                  )}
                  <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                  <p className="text-xs text-muted">{formatINR(p.price)}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
