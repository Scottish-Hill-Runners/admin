import Link from "next/link";
import { EditorialShell } from "@/components/editorial-shell";

export default function Home() {
  return (
    <EditorialShell
      eyebrow="Scottish Hill Runners"
      title="This site is no longer used for updates"
      description="Please use the links on the main Scottish Hill Runners site instead."
    >
      <div className="rounded-[1.5rem] border border-stone-900/10 bg-white/80 p-6 shadow-[0_18px_40px_rgba(47,39,29,0.08)]">
        <p className="text-base leading-6 text-stone-600">
          This admin site is no longer used for submitting updates. Please visit{" "}
          <Link
            href="https://www.scottishhillrunners.uk"
            className="font-semibold text-amber-700 underline hover:text-amber-800"
          >
            www.scottishhillrunners.uk
          </Link>{" "}
          and use the links there instead.
        </p>
      </div>
    </EditorialShell>
  );
}
