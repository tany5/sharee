"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";
import { PageHeader } from "@/components/admin/shared";
import type { Category } from "@/lib/types";

interface CatRow extends Category {
  count: number;
}

interface ProductPayload {
  products?: { category: string; dbStatus: string }[];
  categories?: Category[];
}

const EMPTY_FORM = { name: "", short: "", blurb: "" };

export function AdminCategories() {
  const router = useRouter();
  const [rows, setRows] = useState<CatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<ProductPayload>)
      .then((d) => {
        const counts = new Map<string, number>();
        for (const p of d.products ?? []) {
          if (p.dbStatus === "deleted") continue;
          counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
        }
        setRows(
          (d.categories ?? []).map((c) => ({ ...c, count: counts.get(c.slug) ?? 0 })),
        );
      })
      .catch(() => setError("Could not load categories"));
  }, []);
  useEffect(load, [load]);

  const showError = (msg: string) => {
    setError(msg);
    window.setTimeout(() => setError(null), 6000);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    setBusy(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      showError(data.error ?? "Could not add the category");
      return;
    }
    setAddForm(EMPTY_FORM);
    setAdding(false);
    load();
    router.refresh();
  };

  const startEdit = (row: CatRow) => {
    setEditingId(row.slug);
    setEditForm({ name: row.name, short: row.short, blurb: row.blurb });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setBusy(true);
    const res = await fetch(`/api/admin/categories?slug=${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (!data.ok) {
      showError(data.error ?? "Could not update the category");
      return;
    }
    setEditingId(null);
    load();
    router.refresh();
  };

  const remove = async (row: CatRow) => {
    if (!window.confirm(`Delete category "${row.name}"?`)) return;
    const res = await fetch(`/api/admin/categories?slug=${row.slug}`, { method: "DELETE" });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      showError(data.error ?? "Could not delete the category");
      return;
    }
    load();
    router.refresh();
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        sub={rows ? `${rows.length} collections · ${rows.reduce((s, c) => s + c.count, 0)} products` : ""}
        action={
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            {adding ? <X size={15} /> : <Plus size={15} />}
            {adding ? "Cancel" : "Add category"}
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {adding && (
        <form
          onSubmit={add}
          className="mb-6 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-ink">
            <Plus size={16} className="text-bronze" /> New category
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" required hint="e.g. Organza Sarees">
              <TextInput
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Organza Sarees"
              />
            </Field>
            <Field label="Short label" hint="Chips & nav, optional">
              <TextInput
                value={addForm.short}
                onChange={(e) => setAddForm((f) => ({ ...f, short: e.target.value }))}
                placeholder="Organza"
              />
            </Field>
            <Field label="Blurb" hint="One line for the category card">
              <TextInput
                value={addForm.blurb}
                onChange={(e) => setAddForm((f) => ({ ...f, blurb: e.target.value }))}
                placeholder="Soft, sheer and elegant"
              />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" size="sm" disabled={busy}>
              <Plus size={14} /> Create
            </Button>
          </div>
        </form>
      )}

      {rows === null ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-sm text-muted">
          No categories yet — add one to start organising products.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="rounded-2xl border border-line bg-surface px-4 py-3"
            >
              {editingId === row.slug ? (
                <form onSubmit={saveEdit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Field label="Name" required className="sm:flex-1">
                    <TextInput
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Short" className="sm:w-40">
                    <TextInput
                      value={editForm.short}
                      onChange={(e) => setEditForm((f) => ({ ...f, short: e.target.value }))}
                    />
                  </Field>
                  <Field label="Blurb" className="sm:flex-1">
                    <TextInput
                      value={editForm.blurb}
                      onChange={(e) => setEditForm((f) => ({ ...f, blurb: e.target.value }))}
                    />
                  </Field>
                  <div className="flex gap-1.5 pb-1">
                    <Button type="submit" size="sm" disabled={busy} aria-label="Save category">
                      <Check size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel editing"
                    >
                      <X size={15} />
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                    <Tags size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{row.name}</p>
                    <p className="truncate text-xs text-muted">
                      /categories/{row.slug}
                      {row.blurb ? ` · ${row.blurb}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-bold text-ink2">
                    {row.count} {row.count === 1 ? "product" : "products"}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    aria-label={`Edit ${row.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-accent/15 hover:text-accent"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    aria-label={`Delete ${row.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        Categories with products can&apos;t be deleted — move or delete the products first.
      </p>
    </div>
  );
}
