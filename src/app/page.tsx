import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ArrowRight, FileText, Sparkles, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[var(--color-fg)]">
      <header className="border-b border-[var(--color-border)] bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-soft)] px-3 py-1 text-xs font-medium text-[var(--color-brand)] mb-6">
              <Sparkles className="h-3.5 w-3.5" /> Built for NHS applicants
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] text-[var(--color-fg)]">
              NHS supporting statements that hit every essential criterion.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-[var(--color-muted)] leading-relaxed max-w-2xl">
              Paste the job advert. Add your CV. Answer a few focused questions.
              ApplySharp turns your real experience into a personalised
              statement that addresses every essential criterion and reads
              like you, not AI.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild>
                <Link href="/login">
                  Write my statement <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <a href="#how">See how it works</a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-[var(--color-muted-soft)]">
              Free during beta. No card needed.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="border-y border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
            <div className="max-w-2xl mb-14">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Three steps. About ten minutes.
              </h2>
              <p className="mt-4 text-[var(--color-muted)] text-lg">
                Built around the way NHS shortlisters actually score: every
                essential criterion answered with a specific example, not a
                one-size-fits-all template.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              <Step
                n="1"
                title="Paste the job advert"
                body="We pull every essential and desirable criterion from the person specification, including band, Trust, and duties."
              />
              <Step
                n="2"
                title="Add your CV"
                body="We compare your experience to each criterion. Where you haven't shown something yet, we ask one focused question to draw out a real example."
              />
              <Step
                n="3"
                title="Get your statement"
                body="A structured statement, one specific example per criterion, weaving NHS values through your actual actions. British English, written in your voice, ready to paste into Trac, NHS Jobs or JobTrain."
              />
            </div>
          </div>
        </section>

        {/* Why different */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-2 items-start">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Built around how shortlisters actually score.
              </h2>
              <p className="mt-4 text-[var(--color-muted)] text-lg leading-relaxed">
                NHS shortlisters don&apos;t score on adjectives. They score on
                whether you&apos;ve evidenced each essential criterion with a
                specific example. Generic AI tools paste your CV into a template
                and hope. ApplySharp maps every criterion, fills the gaps with
                your real stories, and writes in a voice that sounds like you.
              </p>
            </div>
            <div className="space-y-6">
              <Feature
                icon={<FileText />}
                title="Every criterion answered"
                body="Each essential criterion gets its own specific example. Nothing left unanswered, no padding."
              />
              <Feature
                icon={<Sparkles />}
                title="Reads like you, not AI"
                body="Tuned to avoid the over-formal phrasing and giveaway words shortlisters now spot in seconds. British English, varied rhythm, your real stories."
              />
              <Feature
                icon={<ShieldCheck />}
                title="Your data stays yours"
                body="Statements are stored privately to your account. We never train on your CV or share it."
              />
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="border-t border-[var(--color-border)]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Your next NHS application starts here.
            </h2>
            <p className="mt-4 text-[var(--color-muted)] text-lg">
              Free during beta. Sign in with your email — no password to remember.
            </p>
            <div className="mt-8 flex justify-center">
              <Button size="lg" asChild>
                <Link href="/login">
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--color-muted)]">
          <Logo />
          <p>© {new Date().getFullYear()} ApplySharp. Not affiliated with the NHS.</p>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand)] text-white text-sm font-semibold">
        {n}
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-[var(--color-muted)] leading-relaxed">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-brand-soft)] text-[var(--color-brand)] [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-[var(--color-muted)] mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
