import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Rocket, ShieldCheck, Sparkles, TrendingUp, Gauge, Lock } from "lucide-react";

const Home = () => {
  return (
    <div className="space-y-16" style={{ backgroundColor: '#1a1a1a', minHeight: '100vh', padding: '20px' }}>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-8 shadow-card backdrop-blur md:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" /> Real-money betting · USDT deposits
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">
            Watch the rocket climb.
            <br />
            <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              Cash out before it crashes.
            </span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            SkyCrash is a real-money crash betting platform. Every round is provably fair,
            every bet is in USDT, and every result can be independently verified.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow-primary">
              <Link to="/play">
                <Rocket className="mr-2 h-5 w-5" /> Play for real
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/verify">
                <ShieldCheck className="mr-2 h-5 w-5" /> Verify a round
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Deposit USDT to start playing. Real deposits, real withdrawals, real winnings.
          </p>
        </div>
      </section>

      {/* Feature row */}
      <section className="grid gap-4 md:grid-cols-3">
        <Feature
          icon={<TrendingUp className="h-5 w-5 text-accent" />}
          title="Real crash mechanics"
          body="Exponential multiplier curve, manual cash-out, auto cash-out targets, and auto re-bet — the full feel of the genre."
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5 text-primary" />}
          title="Provably fair"
          body="Server seed is committed (hashed) before each round and revealed afterward. Verify any result yourself."
        />
        <Feature
          icon={<Lock className="h-5 w-5 text-accent" />}
          title="Secure deposits. Instant withdrawals."
          body="USDT deposits and withdrawals processed securely. Your funds are safe and accessible anytime."
        />
      </section>

      {/* How crash works */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Gauge className="h-3.5 w-3.5 text-accent" /> How crash works
          </div>
          <h2 className="mt-2 text-2xl font-semibold">A multiplier that climbs — until it doesn't.</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><span className="text-foreground">1.</span> Pick a bet amount and (optionally) an auto cash-out target.</li>
            <li><span className="text-foreground">2.</span> The multiplier starts at <span className="font-mono-num text-foreground">1.00×</span> and rises exponentially.</li>
            <li><span className="text-foreground">3.</span> Cash out at any time to lock in <span className="font-mono-num text-foreground">bet × multiplier</span>.</li>
            <li><span className="text-foreground">4.</span> If the round crashes before you cash out, you lose your bet.</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            SkyCrash applies a 4% house edge for competitive odds and sustainable operations.
          </p>
        </Card>

        <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> How provably fair works
          </div>
          <h2 className="mt-2 text-2xl font-semibold">No "trust us" — verify it yourself.</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><span className="text-foreground">1.</span> Before the round, we generate a random <span className="font-mono-num text-foreground">serverSeed</span> and publish only its <span className="font-mono-num text-foreground">SHA-256</span> hash.</li>
            <li><span className="text-foreground">2.</span> You contribute a <span className="font-mono-num text-foreground">clientSeed</span> (rotate it any time in Settings).</li>
            <li><span className="text-foreground">3.</span> The crash point is <span className="font-mono-num text-foreground">HMAC-SHA256(serverSeed, clientSeed:nonce)</span>.</li>
            <li><span className="text-foreground">4.</span> After the round we reveal the seed. Hash it — it must match. Recompute — it must match.</li>
          </ol>
          <Button asChild variant="link" className="mt-2 px-0 text-accent">
            <Link to="/verify">Open the verifier →</Link>
          </Button>
        </Card>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Frequently asked</h2>
        <Card className="border-border/60 bg-card/60 px-6 py-2 shadow-card backdrop-blur">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger>Is this real money?</AccordionTrigger>
              <AccordionContent>
                Yes. SkyCrash is a real-money betting platform using USDT. All bets are real,
                deposits and withdrawals are processed instantly, and winnings are paid out in USDT.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>What is "provably fair"?</AccordionTrigger>
              <AccordionContent>
                It's a cryptographic commit-reveal scheme. Before each round we publish a hash of the
                server seed; afterwards we reveal the seed itself. Anyone can recompute the result
                and confirm we didn't change it after seeing your bet.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger>Can I lose real money here?</AccordionTrigger>
              <AccordionContent>
                Yes. This is real gambling with USDT. Only bet what you can afford to lose.
                We implement responsible gaming tools and encourage safe betting practices.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger>What is the house edge?</AccordionTrigger>
              <AccordionContent>
                SkyCrash applies a 4% house edge, which is standard for crash games.
                This ensures sustainable operations while maintaining competitive odds.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger>Where is my data stored?</AccordionTrigger>
              <AccordionContent>
                Entirely in your browser's <span className="font-mono-num">localStorage</span>.
                Nothing is sent to a server. Clearing your browser data clears your profile, balance,
                and history.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q6">
              <AccordionTrigger>I think I might have a gambling problem.</AccordionTrigger>
              <AccordionContent>
                Even with play money, the patterns of crash games can be habit-forming. If real-money
                gambling is affecting your life, please reach out for help — for example via{" "}
                <a className="underline" href="https://www.begambleaware.org/" target="_blank" rel="noreferrer">BeGambleAware</a>{" "}
                or your local equivalent.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/40 to-accent/15 p-8 text-center shadow-card backdrop-blur md:p-12">
        <h2 className="text-3xl font-bold tracking-tight">Ready to take off?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Deposit USDT to start playing. Real betting, real winnings, instant withdrawals.
        </p>
        <Button asChild size="lg" className="mt-5 bg-gradient-primary text-primary-foreground shadow-glow-primary">
          <Link to="/play"><Rocket className="mr-2 h-5 w-5" /> Launch SkyCrash</Link>
        </Button>
      </section>
    </div>
  );
};

const Feature = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/60">{icon}</div>
    <h3 className="mt-3 text-base font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
  </Card>
);

export default Home;