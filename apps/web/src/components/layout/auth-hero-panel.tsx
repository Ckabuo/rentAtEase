import { Logo } from "@/components/brand/logo";

export function AuthHeroPanel() {
  return (
    <div className="relative flex h-full min-h-screen flex-col overflow-hidden bg-ink p-8 lg:p-12 xl:p-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.03) 3px, rgba(255,255,255,0.03) 4px)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-32 top-1/3 size-[480px] rounded-full bg-[radial-gradient(circle,rgba(45,155,128,0.22)_0%,transparent_68%)]"
        aria-hidden="true"
      />

      <div className="relative z-10">
        <Logo href="/sign-in" inverted />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center py-10 lg:py-16">
        <h2 className="max-w-lg font-display text-[2rem] font-black leading-[1.08] tracking-tight text-cream sm:text-4xl xl:text-[2.75rem]">
          Every rent tracked.
          <br />
          <span className="text-primary-hover">Every receipt resolved.</span>
        </h2>
        <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/60">
          Ledger, receipts, and reminders for Nigerian landlords — without the spreadsheet.
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap gap-10 border-t border-white/10 pt-8 sm:gap-14">
        <div>
          <p className="font-display text-3xl font-black tracking-tight text-cream">5 min</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-cream/45">Secure codes</p>
        </div>
        <div>
          <p className="font-display text-3xl font-black tracking-tight text-cream">₦</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-cream/45">Kobo-accurate</p>
        </div>
      </div>
    </div>
  );
}
