import { type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { AuthHeroPanel } from "@/components/layout/auth-hero-panel";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  wide?: boolean;
  headerSlot?: ReactNode;
};

export function AuthShell({ children, title, subtitle, wide, headerSlot }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-card lg:flex-row">
      <aside className="relative hidden min-h-screen w-full shrink-0 lg:block lg:w-1/2">
        <AuthHeroPanel />
      </aside>

      <div className="flex min-h-screen w-full flex-1 flex-col lg:min-h-0 lg:w-1/2">
        <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className={wide ? "mx-auto w-full max-w-lg" : "mx-auto w-full max-w-[22rem] sm:max-w-md"}>
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo href="/sign-in" />
            </div>
            {headerSlot}
            <div className="mb-8">
              <h1 className="text-center font-display text-[1.75rem] font-black leading-tight tracking-tight text-ink sm:text-3xl lg:text-left">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-2 text-center text-sm leading-relaxed text-muted lg:text-left">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>
        </main>

        <footer className="px-6 py-5 text-center text-xs text-muted sm:px-10 lg:text-left lg:px-14 xl:px-20">
          Need help?{" "}
          <a href="mailto:support@rentatease.ng" className="font-semibold text-primary underline-offset-2 hover:underline">
            Contact support
          </a>
        </footer>
      </div>
    </div>
  );
}
