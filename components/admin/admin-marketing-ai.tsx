"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import puter from "@heyputer/puter.js";
import {
  BadgeCheck,
  Bot,
  ImageUp,
  RefreshCcw,
  Rocket,
  Send,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/shared";
import { useToast } from "@/components/admin/toast";
import { cx } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import type { AdRecord } from "@/lib/marketing/ads";
import type { SocialPostRecord } from "@/lib/marketing/social";

interface CatalogueItem {
  slug: string;
  name: string;
  price: number;
  images: string[];
}

interface TelegramInfo {
  hasToken: boolean;
  hasChat: boolean;
  source: string;
  botUsername: string | null;
  chats: { id: string; title: string; type: string }[];
  linkedChatId: string | null;
}

interface MetaDiagnostics {
  configured: boolean;
  missingConfig: string[];
  pageTokenResolved: boolean;
  connectedPage?: string;
  connectedInstagramId?: string;
  grantedPermissions: string[];
  missingPublishPermissions: string[];
}

const SOCIAL_STATE_STYLE: Record<string, string> = {
  draft: "bg-[#b3922f]/15 text-[#7a5c14]",
  pending_approval: "bg-[#2c5f8a]/15 text-[#22506f]",
  approved: "bg-[#4c7a4f]/15 text-[#3f6b43]",
  published: "bg-[#2e7d4f]/20 text-[#1f6b40]",
  rejected: "bg-danger/15 text-danger",
};

const AD_STATE_STYLE: Record<string, string> = {
  draft: "bg-[#b3922f]/15 text-[#7a5c14]",
  pending_approval: "bg-[#2c5f8a]/15 text-[#22506f]",
  approved: "bg-[#4c7a4f]/15 text-[#3f6b43]",
  staged: "bg-[#6b4fa0]/15 text-[#54387f]",
  pending_activation: "bg-[#8a5a2c]/15 text-[#6f4522]",
  active: "bg-[#2e7d4f]/20 text-[#1f6b40]",
  paused: "bg-[#9d9d9d]/20 text-[#666]",
  rejected: "bg-danger/15 text-danger",
};

function stateLabel(s: string): string {
  return s.replace(/_/g, " ");
}

function puterImageUrl(out: unknown): string | undefined {
  if (typeof out === "string") return out;
  if (out instanceof HTMLImageElement) return out.src;
  if (out && typeof out === "object") {
    const obj = out as { url?: unknown; src?: unknown };
    return typeof obj.url === "string" ? obj.url : typeof obj.src === "string" ? obj.src : undefined;
  }
  return undefined;
}

export function AdminMarketingAI() {
  const toast = useToast();
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [ads, setAds] = useState<AdRecord[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [telegram, setTelegram] = useState<TelegramInfo | null>(null);
  const [socialTestMode, setSocialTestMode] = useState(true);
  const [puterPromoEnabled, setPuterPromoEnabled] = useState(false);
  const [puterStatus, setPuterStatus] = useState<"loading" | "signed_out" | "connected" | "unavailable">("loading");
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [metaMissing, setMetaMissing] = useState<string[]>([]);
  const [metaDiagnostics, setMetaDiagnostics] = useState<MetaDiagnostics | null>(null);
  const [adsTestMode, setAdsTestMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ hook: "", body: "", cta: "" });
  const [genSlug, setGenSlug] = useState("");
  const [genKind, setGenKind] = useState("promo_poster");
  const [genLanguage, setGenLanguage] = useState("hinglish");
  const [genObjective, setGenObjective] = useState("OUTCOME_TRAFFIC");
  const [genBudget, setGenBudget] = useState(100);
  const puterWorkerId = useRef(`admin-puter-${Math.random().toString(36).slice(2)}`);
  const puterWorkerStarted = useRef(false);
  const puterTimers = useRef<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [socRes, adsRes, prodRes, tgRes] = await Promise.all([
        fetch("/api/admin/marketing-ai/social", { cache: "no-store" }),
        fetch("/api/admin/marketing-ai/ads", { cache: "no-store" }),
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/marketing-ai/telegram", { cache: "no-store" }),
      ]);
      const soc = await socRes.json();
      const adsJson = await adsRes.json();
      const prod = await prodRes.json();
      const tg = await tgRes.json();
      setNeedsMigration(soc.needsMigration === true || adsJson.needsMigration === true);
      if (soc.ok) {
        setPosts(soc.posts as SocialPostRecord[]);
        setSocialTestMode(soc.testMode === true);
        setPuterPromoEnabled(soc.puterPromoEnabled === true);
        setMetaConfigured(soc.metaConfigured === true);
        setMetaMissing(Array.isArray(soc.metaMissing) ? soc.metaMissing : []);
        setMetaDiagnostics((soc.metaDiagnostics as MetaDiagnostics | undefined) ?? null);
      }
      if (adsJson.ok) {
        setAds(adsJson.ads as AdRecord[]);
        setAdsTestMode(adsJson.testMode === true);
      }
      if (prod.ok) {
        const items = (prod.products as (CatalogueItem & { dbStatus?: string })[]).filter(
          (p) => p.dbStatus !== "deleted",
        );
        setCatalogue(items);
        setGenSlug((cur) => cur || items[0]?.slug || "");
      }
      if (tg.ok) setTelegram(tg as TelegramInfo);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const heartbeatPuter = useCallback(async () => {
    await fetch(
      `/api/admin/marketing-ai/puter-relay/jobs?mode=heartbeat&workerId=${encodeURIComponent(puterWorkerId.current)}`,
      { cache: "no-store" },
    ).catch(() => undefined);
    setPuterPromoEnabled(true);
  }, []);

  const completePuterJob = useCallback(async (id: string, patch: { imageUrl?: string; error?: string }) => {
    await fetch("/api/admin/marketing-ai/puter-relay/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        workerId: puterWorkerId.current,
        imageUrl: patch.imageUrl,
        contentType: "image/png",
        error: patch.error,
      }),
    }).catch(() => undefined);
  }, []);

  const pollPuterJobs = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const res = await fetch(
      `/api/admin/marketing-ai/puter-relay/jobs?workerId=${encodeURIComponent(puterWorkerId.current)}`,
      { cache: "no-store" },
    ).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    const job = data?.job as { id?: string; payload?: { prompt?: string } } | null;
    if (!job?.id || !job.payload?.prompt) return;
    try {
      const out = await puter.ai.txt2img(job.payload.prompt, { model: "gpt-image-2.5-flare" });
      const imageUrl = puterImageUrl(out);
      if (!imageUrl) throw new Error("Puter returned no image URL");
      await completePuterJob(job.id, { imageUrl });
      toast.success("Puter finished the promo image.");
      await load();
    } catch (err) {
      await completePuterJob(job.id, { error: (err as Error).message || "Puter image generation failed" });
    }
  }, [completePuterJob, load, toast]);

  const startPuterWorker = useCallback(async () => {
    if (puterWorkerStarted.current) return;
    puterWorkerStarted.current = true;
    await heartbeatPuter();
    puterTimers.current.push(window.setInterval(() => void heartbeatPuter(), 30_000));
    puterTimers.current.push(window.setInterval(() => void pollPuterJobs(), 10_000));
  }, [heartbeatPuter, pollPuterJobs]);

  const connectPuter = useCallback(async () => {
    setPuterStatus("loading");
    try {
      if (!puter?.auth || !puter?.ai?.txt2img) throw new Error("Puter unavailable");
      let signedIn = puter.auth.isSignedIn();
      if (!signedIn) {
        await puter.auth.signIn();
        signedIn = puter.auth.isSignedIn();
      }
      if (!signedIn) {
        setPuterStatus("signed_out");
        return false;
      }
      setPuterStatus("connected");
      await startPuterWorker();
      await load();
      return true;
    } catch {
      setPuterStatus("unavailable");
      return false;
    }
  }, [load, startPuterWorker]);

  useEffect(() => {
    void connectPuter();
    return () => {
      for (const timer of puterTimers.current) window.clearInterval(timer);
      puterTimers.current = [];
      puterWorkerStarted.current = false;
    };
  }, [connectPuter]);

  const act = useCallback(
    async (url: string, body: Record<string, unknown>, okMsg?: string) => {
      setBusy(`${url}:${String(body.id ?? body.action ?? "")}`);
      setMessage(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.ok) {
          setMessage(data.error ?? "Action failed");
          toast.error(data.error ?? "Action failed");
        } else if (okMsg) {
          toast.success(okMsg);
        }
        await load();
        return data;
      } finally {
        setBusy(null);
      }
    },
    [load, toast],
  );

  const syncTelegram = () => act("/api/admin/marketing-ai/telegram", { action: "sync" });
  const linkChat = (chatId: string) =>
    act("/api/admin/marketing-ai/telegram", { action: "link", chatId }, "Telegram chat linked.");
  const testTelegram = () =>
    act("/api/admin/marketing-ai/telegram", { action: "test" }, "Test message sent.");

  const generateSocial = () => {
    if (!genSlug) return;
    if (genKind === "promo_poster" && puterStatus !== "connected") {
      void connectPuter().then((ok) => {
        if (!ok) toast.error("Puter is not connected. Allow the Puter sign-in popup, then retry.");
      });
      return;
    }
    void act(
      "/api/admin/marketing-ai/social",
      { productSlug: genSlug, kind: genKind, language: genLanguage },
              "Puter promo post generated — approve it below or in Telegram.",
    );
    if (genKind === "promo_poster") {
      window.setTimeout(() => void pollPuterJobs(), 200);
      window.setTimeout(() => void pollPuterJobs(), 2_000);
    }
  };

  const generateAd = () => {
    if (!genSlug) return;
    void act(
      "/api/admin/marketing-ai/ads",
      { productSlug: genSlug, objective: genObjective, language: genLanguage, dailyBudgetInr: genBudget },
      "Ad generated — approve it below or in Telegram (PAUSED, then a second approval to spend).",
    );
  };

  const updateMetaBranding = async () => {
    setBusy("/api/admin/marketing-ai/meta-profile:update");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-ai/meta-profile", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error ?? "Meta profile update failed");
        toast.error(data.error ?? "Meta profile update failed");
        return;
      }
      const result = data.result as {
        facebook?: { pageDetails?: string; coverPhoto?: string; profilePhoto?: string };
        instagram?: { note?: string };
        errors?: string[];
        manualSteps?: string[];
      };
      const errors = result.errors?.length ? ` Some fields need manual action: ${result.errors.join(" | ")}` : "";
      setMessage(
        `Meta branding update finished. Facebook details: ${result.facebook?.pageDetails ?? "skipped"}, cover: ${result.facebook?.coverPhoto ?? "skipped"}, logo: ${result.facebook?.profilePhoto ?? "manual"}. ${result.instagram?.note ?? ""}${errors}`,
      );
      toast.success("Meta branding update finished.");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (p: SocialPostRecord) => {
    setEditing(p.id);
    setEditDraft({ hook: p.caption.hook, body: p.caption.body, cta: p.caption.cta });
  };

  return (
    <div>
      <PageHeader
        title="Marketing AI"
        sub="Local Ollama writes social posts + ads from your existing product photos. Nothing publishes or spends without your approval."
        action={
          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => void connectPuter()}
                className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-80"
              >
                ✨ {puterStatus === "connected" ? "Puter connected" : "Connect Puter"}
              </button>
            <button
              type="button"
              onClick={() => void updateMetaBranding()}
              disabled={busy === "/api/admin/marketing-ai/meta-profile:update" || !metaConfigured}
              className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <ImageUp size={15} />
              Update Meta profiles
            </button>
            <button
              type="button"
              onClick={() => void syncTelegram()}
              disabled={busy === "/api/admin/marketing-ai/telegram:sync"}
              className="flex h-10 items-center gap-2 rounded-full bg-btn px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send size={15} />
              Sync Telegram
            </button>
          </div>
        }
      />

      {needsMigration && (
        <div className="mb-4 rounded-xl border border-[#b3922f]/40 bg-[#b3922f]/10 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Supabase setup required</p>
          <p className="mt-1 text-sm text-ink2">
            Run supabase/migrations/0006_marketing_ai.sql in the Supabase SQL editor to enable
            the Marketing AI tables.
          </p>
        </div>
      )}

      {message && (
        <p className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink2">
          {message}
        </p>
      )}

      {/* Test mode banners */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
          socialTestMode ? "bg-[#2c5f8a]/15 text-[#22506f]" : "bg-[#2e7d4f]/20 text-[#1f6b40]",
        )}>
          social: {socialTestMode ? "TEST MODE" : "LIVE"}
        </span>
        <span className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
          adsTestMode ? "bg-[#2c5f8a]/15 text-[#22506f]" : "bg-[#8a5a2c]/15 text-[#6f4522]",
        )}>
          ads: {adsTestMode ? "TEST MODE" : "LIVE (can spend after 2nd approval)"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-muted">
          <Wallet size={12} /> active daily spend:{" "}
          {formatINR(ads.filter((a) => a.state === "active").reduce((s, a) => s + a.dailyBudgetInr, 0))}
        </span>
        <span className={cx(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
          puterPromoEnabled ? "bg-[#2e7d4f]/20 text-[#1f6b40]" : "bg-[#b3922f]/15 text-[#7a5c14]",
        )}>
          Puter poster: {puterPromoEnabled ? "connected" : puterStatus === "signed_out" ? "sign in needed" : "not connected"}
        </span>
      </div>
      {socialTestMode && (
        <div className="mb-4 rounded-xl border border-[#2c5f8a]/30 bg-[#2c5f8a]/10 px-4 py-3 text-sm text-ink2">
          Social is in TEST MODE, so approve/publish only simulates Meta posting. Set <code>SOCIAL_TEST_MODE=false</code> with Meta page credentials to post live.
        </div>
      )}
      {!socialTestMode && !metaConfigured && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Live social publishing is on, but Meta is missing: {metaMissing.join(", ")}.
        </div>
      )}
      {!socialTestMode && metaDiagnostics && metaDiagnostics.missingPublishPermissions.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#b3922f]/40 bg-[#b3922f]/10 px-4 py-3 text-sm text-ink2">
          Meta is connected to {metaDiagnostics.connectedPage ?? "the page"}, but live publishing still needs:{" "}
          <b>{metaDiagnostics.missingPublishPermissions.join(", ")}</b>. Re-authorize the Meta app with those
          permissions, then approve posts again.
        </div>
      )}

      {/* Telegram connection */}
      <section className="mb-8 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Bot size={18} className="text-bronze" /> Telegram approval bot
        </h2>
        {!telegram || !telegram.hasToken ? (
          <p className="text-sm text-ink2">
            No bot token found. Put it in <code>secret/secret/telegrambot.txt</code> (or set
            TELEGRAM_BOT_TOKEN / app_secrets <code>telegram_bot_token</code>) and reload.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink2">
              Token loaded from <b>{telegram.source}</b>
              {telegram.botUsername && (
                <>
                  {" "}· bot <b>@{telegram.botUsername}</b>
                </>
              )}{" "}
              · {telegram.hasChat ? (
                <span className="text-[#1f6b40]">chat linked: {telegram.linkedChatId}</span>
              ) : (
                <span className="text-[#7a5c14]">no chat linked yet</span>
              )}
            </p>
            {!telegram.hasChat && telegram.chats.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {telegram.chats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void linkChat(c.id)}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink2 hover:border-accent hover:text-ink"
                  >
                    <BadgeCheck size={13} /> Link “{c.title}” ({c.id})
                  </button>
                ))}
              </div>
            )}
            {telegram.hasChat && (
              <button
                type="button"
                onClick={() => void testTelegram()}
                className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
              >
                <Send size={13} /> Send test message
              </button>
            )}
            <p className="text-xs text-muted">
              Message the bot once (or add it to a group) if no chats appear, then reload.
            </p>
          </div>
        )}
      </section>

      {/* Generator */}
      <section className="mb-8 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Sparkles size={18} className="text-bronze" /> Generate
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold text-muted">
            Product
            <select
              value={genSlug}
              onChange={(e) => setGenSlug(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              {catalogue.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Post kind
            <select
              value={genKind}
              onChange={(e) => setGenKind(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="promo_poster">Puter promo poster (₹199)</option>
              <option value="product_feature">Caption/card: Product feature</option>
              <option value="behind_the_loom">Behind the loom</option>
              <option value="styling_tip">Styling tip</option>
              <option value="festive_pick">Festive pick</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Language
            <select
              value={genLanguage}
              onChange={(e) => setGenLanguage(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="hinglish">Hinglish</option>
              <option value="banglish">Banglish</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Ad objective
            <select
              value={genObjective}
              onChange={(e) => setGenObjective(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="OUTCOME_TRAFFIC">Traffic</option>
              <option value="OUTCOME_ENGAGEMENT">Engagement</option>
              <option value="OUTCOME_SALES">Sales</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Ad daily budget (₹)
            <input
              type="number"
              min={50}
              max={1000}
              value={genBudget}
              onChange={(e) => setGenBudget(Number(e.target.value) || 100)}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateSocial}
            disabled={!genSlug || busy === "/api/admin/marketing-ai/social:"}
            className="flex h-10 items-center gap-2 rounded-full bg-btn px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles size={15} /> Generate social post
          </button>
          {genKind === "promo_poster" && !puterPromoEnabled && (
            <button
              type="button"
              onClick={() => void connectPuter()}
              className="flex min-h-10 items-center rounded-full border border-line px-3 text-xs font-semibold text-muted hover:text-ink"
            >
              Puter missing: connect/sign in here
            </button>
          )}
          <button
            type="button"
            onClick={generateAd}
            disabled={!genSlug || busy === "/api/admin/marketing-ai/ads:"}
            className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ink2 hover:text-ink disabled:opacity-50"
          >
            <Rocket size={15} /> Generate ad (no spending)
          </button>
        </div>
      </section>

      {/* Social queue */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Social posts</h2>
        {loading ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            Loading…
          </p>
        ) : posts.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            No posts yet — generate one above.
          </p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <article key={p.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.postImageUrl ?? p.imageUrl}
                      alt={p.productName}
                      className="h-40 w-32 rounded-xl border border-line object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink">{p.productName}</h3>
                      <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-bold", SOCIAL_STATE_STYLE[p.state])}>
                        {stateLabel(p.state)}
                      </span>
                      <span className="text-[11px] text-muted">
                        {p.kind} · {p.language} · {p.engine}
                      </span>
                      {p.postImageUrl && (
                        <span className="rounded-full bg-bronze/15 px-2 py-0.5 text-[10px] font-bold text-bronze">
                          branded card
                        </span>
                      )}
                    </div>
                    {editing === p.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          value={editDraft.hook}
                          onChange={(e) => setEditDraft({ ...editDraft, hook: e.target.value })}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
                          placeholder="Hook"
                        />
                        <textarea
                          value={editDraft.body}
                          onChange={(e) => setEditDraft({ ...editDraft, body: e.target.value })}
                          rows={3}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
                          placeholder="Body"
                        />
                        <input
                          value={editDraft.cta}
                          onChange={(e) => setEditDraft({ ...editDraft, cta: e.target.value })}
                          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
                          placeholder="CTA"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void act(
                                "/api/admin/marketing-ai/social/manage",
                                { id: p.id, action: "edit", ...editDraft },
                                "Caption updated.",
                              ).then(() => setEditing(null))
                            }
                            className="h-9 rounded-full bg-btn px-3.5 text-xs font-semibold text-white hover:opacity-90"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="h-9 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-ink2">
                        <p className="font-semibold text-ink">{p.caption.hook}</p>
                        <p>{p.caption.body}</p>
                        <p className="mt-1">{p.caption.cta}</p>
                        <p className="mt-1 text-xs text-muted">{p.caption.hashtags.join(" ")}</p>
                      </div>
                    )}
                    {p.publishError && (
                      <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                        {p.publishError}
                      </p>
                    )}
                    {p.publishedAt && (
                      <p className="mt-2 text-xs text-[#1f6b40]">
                        Published {new Date(p.publishedAt).toLocaleString("en-IN")}
                        {p.fbPostId?.startsWith("TEST-") ? " · TEST ids" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {p.state === "pending_approval" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void act(
                              "/api/admin/marketing-ai/social/manage",
                              { id: p.id, action: "approve_publish" },
                              socialTestMode ? "Approved and simulated." : "Approved and published.",
                            )
                          }
                          className="h-9 rounded-full bg-btn px-3.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          {socialTestMode ? "Approve & simulate" : "Approve & publish"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="h-9 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
                        >
                          Edit
                        </button>
                      </>
                    )}
                    {p.state === "approved" && (
                      <button
                        type="button"
                        onClick={() =>
                          void act(
                            "/api/admin/marketing-ai/social/manage",
                            { id: p.id, action: "publish" },
                            "Published (or simulated in TEST MODE).",
                          )
                        }
                        className="h-9 rounded-full bg-btn px-3.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Publish
                      </button>
                    )}
                    {(p.state === "pending_approval" || p.state === "rejected") && (
                      <button
                        type="button"
                        onClick={() =>
                          void act(
                            "/api/admin/marketing-ai/social/manage",
                            { id: p.id, action: "regenerate" },
                            "Regenerating with Ollama…",
                          )
                        }
                        className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
                      >
                        <RefreshCcw size={13} /> Regenerate
                      </button>
                    )}
                    {(p.state === "pending_approval" || p.state === "draft") && (
                      <button
                        type="button"
                        onClick={() =>
                          void act(
                            "/api/admin/marketing-ai/social/manage",
                            { id: p.id, action: "reject", reason: "Rejected in admin" },
                          )
                        }
                        className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-danger"
                      >
                        <X size={13} /> Reject
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Ads queue */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Meta ads</h2>
        {loading || ads.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
            {loading ? "Loading…" : "No ads yet — generate one above."}
          </p>
        ) : (
          <div className="space-y-4">
            {ads.map((a) => (
              <article key={a.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.imageUrl}
                      alt={a.productName}
                      className="h-32 w-24 rounded-xl border border-line object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-ink">{a.productName}</h3>
                      <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-bold", AD_STATE_STYLE[a.state])}>
                        {stateLabel(a.state)}
                      </span>
                      <span className="text-[11px] text-muted">
                        {a.objective} · {a.language} · ₹{a.dailyBudgetInr}/day · {a.engine}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-ink2">
                      <p className="font-semibold text-ink">{a.copy.headline}</p>
                      <p>{a.copy.primaryText}</p>
                      <p className="mt-1">
                        {a.copy.cta} → {a.destinationUrl}
                      </p>
                    </div>
                    {a.state === "pending_activation" && (
                      <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#8a5a2c]/10 px-3 py-2 text-xs font-semibold text-[#6f4522]">
                        <ShieldAlert size={13} /> PAUSED on Meta — activation starts spending{" "}
                        {formatINR(a.dailyBudgetInr)}/day.
                      </p>
                    )}
                    {a.stagingError && (
                      <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                        {a.stagingError}
                      </p>
                    )}
                    {a.activatedAt && (
                      <p className="mt-2 text-xs text-[#1f6b40]">
                        Active since {new Date(a.activatedAt).toLocaleString("en-IN")}
                        {a.metaAdId?.startsWith("TEST-") ? " · TEST ids" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {a.state === "pending_approval" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void act(
                              "/api/admin/marketing-ai/ads/manage",
                              { id: a.id, action: "approve" },
                              "Approved — creating PAUSED on Meta.",
                            )
                          }
                          className="h-9 rounded-full bg-btn px-3.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          Approve (create PAUSED)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void act(
                              "/api/admin/marketing-ai/ads/manage",
                              { id: a.id, action: "regenerate" },
                              "Regenerating with Ollama…",
                            )
                          }
                          className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
                        >
                          <RefreshCcw size={13} /> Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void act(
                              "/api/admin/marketing-ai/ads/manage",
                              { id: a.id, action: "reject", reason: "Rejected in admin" },
                            )
                          }
                          className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-danger"
                        >
                          <X size={13} /> Reject
                        </button>
                      </>
                    )}
                    {a.state === "pending_activation" && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void act(
                              "/api/admin/marketing-ai/ads/manage",
                              { id: a.id, action: "activate" },
                              "Ad is ACTIVE — it is now spending.",
                            )
                          }
                          className="h-9 rounded-full bg-danger px-3.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          ACTIVATE (₹{a.dailyBudgetInr}/day)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void act("/api/admin/marketing-ai/ads/manage", { id: a.id, action: "pause" })
                          }
                          className="h-9 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
                        >
                          Keep paused
                        </button>
                      </>
                    )}
                    {a.state === "active" && (
                      <button
                        type="button"
                        onClick={() =>
                          void act(
                            "/api/admin/marketing-ai/ads/manage",
                            { id: a.id, action: "pause" },
                            "Ad paused.",
                          )
                        }
                        className="h-9 rounded-full border border-line px-3.5 text-xs font-semibold text-ink2 hover:text-ink"
                      >
                        Pause
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
