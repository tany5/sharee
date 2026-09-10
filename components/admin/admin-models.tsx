"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, Pencil, Sparkles, Trash2, Upload } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import { PageHeader } from "@/components/admin/shared";
import { useToast } from "@/components/admin/toast";

interface BaseModel {
  id: string;
  name: string;
  imageUrl: string;
}

function isBuiltIn(model: BaseModel): boolean {
  return model.id.startsWith("ai-model-");
}

export function AdminModels() {
  const toast = useToast();
  const [models, setModels] = useState<BaseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("AI saree model");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing/base-models", { cache: "no-store" });
      const data = (await res.json()) as { ok: boolean; models?: BaseModel[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not load models");
      setModels(data.models ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load models");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/marketing/base-models", { method: "POST", body: form });
      const data = (await res.json()) as { ok: boolean; models?: BaseModel[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Upload failed");
      setModels(data.models ?? []);
      toast.success("Model photo added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("generate");
    try {
      const res = await fetch("/api/admin/marketing/base-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", name }),
      });
      const data = (await res.json()) as { ok: boolean; models?: BaseModel[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not generate model");
      setModels(data.models ?? []);
      toast.success("Synthetic model added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate model");
    } finally {
      setBusy(null);
    }
  };

  const rename = async (model: BaseModel) => {
    const nextName = (editing[model.id] ?? model.name).trim();
    if (nextName.length < 2) {
      toast.error("Model name is required");
      return;
    }
    setBusy(`rename:${model.id}`);
    try {
      const res = await fetch("/api/admin/marketing/base-models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id, name: nextName }),
      });
      const data = (await res.json()) as { ok: boolean; models?: BaseModel[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not rename model");
      setModels(data.models ?? []);
      toast.success("Model updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename model");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (model: BaseModel) => {
    setBusy(`delete:${model.id}`);
    try {
      const res = await fetch("/api/admin/marketing/base-models", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: model.id }),
      });
      const data = (await res.json()) as { ok: boolean; models?: BaseModel[]; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Could not delete model");
      setModels(data.models ?? []);
      toast.success("Model removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete model");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Saree Models"
        sub="Manage the AI and brand-owned model photos used when a new saree is created."
        action={
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-ink2 hover:text-ink">
            {busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload model
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        }
      />

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg text-ink">
          <Sparkles size={17} className="text-bronze" /> Generate synthetic model
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Model name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="button" className="self-end" disabled={Boolean(busy)} onClick={generate}>
            {busy === "generate" ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            Generate model
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          This free mode creates a managed copy from the packaged synthetic AI
          model set. Replace it later with your own generated or photographed
          model if you want a unique brand face. For CatVTON, upload a same-model
          pose set named with front, side, back and full_saree so each catalogue
          view gets the correct base pose.
        </p>
      </section>

      {loading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-surface2" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => {
            const builtIn = isBuiltIn(model);
            return (
              <article key={model.id} className="rounded-2xl border border-line bg-surface p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={model.imageUrl}
                  alt={model.name}
                  className="aspect-[4/5] w-full rounded-xl border border-line object-cover"
                />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{model.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {builtIn ? "Protected AI default" : "Managed model"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <TextInput
                    value={editing[model.id] ?? model.name}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [model.id]: e.target.value }))
                    }
                    readOnly={builtIn}
                    className={builtIn ? "opacity-60" : ""}
                  />
                  <button
                    type="button"
                    aria-label="Rename model"
                    title="Rename model"
                    disabled={builtIn || Boolean(busy)}
                    onClick={() => void rename(model)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === `rename:${model.id}` ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Pencil size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="Remove model"
                    title="Remove model"
                    disabled={builtIn || Boolean(busy)}
                    onClick={() => void remove(model)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === `delete:${model.id}` ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
