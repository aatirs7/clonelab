import Link from "next/link";
import AdSpendDetector from "@/components/AdSpendDetector";
import CreativeLibrary from "@/components/CreativeLibrary";
import SignOutButton from "@/components/SignOutButton";
import { requireOperator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  await requireOperator();

  return (
    <div className="deck">
      <nav className="deck-rail">
        <Link href="/" className="wordmark" aria-label="CloneLab, back to all runs">
          Clone<span>Lab</span>
        </Link>
        <div className="rail-list">
          <Link href="/" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">01</span>
            Runs
          </Link>
          <Link href="/research" className="rail-item" data-state="active" style={{ textDecoration: "none" }}>
            <span className="rail-num">02</span>
            Research
          </Link>
          <Link href="/money" className="rail-item" style={{ textDecoration: "none" }}>
            <span className="rail-num">03</span>
            Money
          </Link>
        </div>
        <div className="rail-footer">
          <SignOutButton />
        </div>
      </nav>

      <main className="deck-stage">
        <div className="stage-inner" style={{ maxWidth: "44rem" }}>
          <p className="eyebrow">Research</p>
          <h1 className="panel-title">What is already winning</h1>
          <p className="panel-hint">
            Which videos to copy, and which brands are paying to boost their affiliates. Both
            answer questions worth settling before committing to film for a niche.
          </p>

          <div className="dash-stack" style={{ marginTop: "2rem" }}>
            <CreativeLibrary />
            <AdSpendDetector />
          </div>
        </div>
      </main>
    </div>
  );
}
