import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 text-center">
      <div>
        <p className="font-display text-[120px] font-bold leading-none text-accent/30">
          404
        </p>
        <h1 className="mt-2 font-display text-2xl text-ink">
          This drape is out of frame
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink2">
          The page you’re looking for doesn’t exist — but the good news is that
          every saree in the store is still exactly ₹199.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full bg-btn px-6 text-[15px] font-semibold text-btntext"
          >
            Back to Home
          </Link>
          <Link
            href="/sarees"
            className="inline-flex h-11 items-center justify-center rounded-full border border-accent/60 px-6 text-[15px] font-semibold text-ink hover:bg-accent/10"
          >
            Shop Sarees
          </Link>
        </div>
      </div>
    </div>
  );
}
