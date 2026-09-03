import { Ornament } from "@/components/ui";

export function PageShell({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
          {kicker}
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink sm:text-4xl">{title}</h1>
        <Ornament className="mt-5" />
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-ink2">{lede}</p>
      </div>
      <div className="mt-10">{children}</div>
    </div>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8 text-[15px] leading-7 text-ink2">
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <h2 className="text-xl text-ink">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}
