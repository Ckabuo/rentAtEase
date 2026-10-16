import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  href?: string;
  inverted?: boolean;
};

export function Logo({ className, href = "/", inverted }: LogoProps) {
  const content = (
    <span
      className={cn(
        "font-display text-[1.35rem] font-black tracking-tight",
        inverted ? "text-white" : "text-ink",
        className,
      )}
    >
      Rent<span className={inverted ? "text-primary-hover" : "text-primary"}>@</span>
      <em className="font-black italic">Ease</em>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {content}
      </Link>
    );
  }

  return content;
}
