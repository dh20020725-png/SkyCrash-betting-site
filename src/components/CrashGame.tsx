import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  computeCrashPoint,
  generateServerSeed,
  hashServerSeed,
  HOUSE_EDGE_PCT,
} from "@/lib/provablyFair";
import { bumpNonce, getClientSeed, useLedger, type BetRecord } from "@/lib/ledger";
import { toast } from "sonner";
import { RotateCcw, Shield, Sparkles, Play, Hand, Repeat, Trophy, Flame } from "lucide-react";
import { useSettings, playBeep } from "@/lib/settings";

type Phase = "idle" | "committed" | "running" | "crashed";

const COUNTDOWN_MS = 4000;

interface CrashGameProps {
  balance?: number;
  onBalanceChange?: (amount: number) => void;
}

const CrashGameComponent = ({ balance: externalBalance, onBalanceChange }: CrashGameProps = {}) => {
  const { history, recordBet, reset } = useLedger();
  const [internalBalance, setInternalBalance] = useState(externalBalance || 0);
  const [hasError, setHasError] = useState(false);
  
  // Sync internal balance when external balance changes
  useEffect(() => {
    if (externalBalance !== undefined && externalBalance !== internalBalance) {
      setInternalBalance(externalBalance);
    }
  }, [externalBalance, internalBalance]);
  
  // Use external balance if provided, otherwise use internal state
  const balance = externalBalance !== undefined ? externalBalance : internalBalance;
  const [settings] = useSettings();
  const [bet, setBet] = useState(10);
  const [target, setTarget] = useState(2.0);
  const [phase, setPhase] = useState<Phase>("committed");

  // Error boundary fallback
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error && event.error.message.includes('insertBefore')) {
        setHasError(true);
        // Reset game state
        setPhase("committed");
        setMultiplier(1.0);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Recovery mechanism
  const recoverFromError = () => {
    setHasError(false);
    setPhase("committed");
    setMultiplier(1.0);
    setCrashAt(null);
    cashedRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  if (hasError) {
    return (
      <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
        <div className="text-center py-8">
          <div className="text-lg font-semibold text-destructive mb-4">Game Error</div>
          <p className="text-muted-foreground mb-4">The game encountered an error and needs to be reset.</p>
          <Button onClick={recoverFromError} className="bg-primary text-primary-foreground">
            Reset Game
          </Button>
        </div>
      </Card>
    );
  }
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashAt, setCrashAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<BetRecord | null>(null);

  // Round-active bet snapshot (so changing inputs mid-flight doesn't affect payout)
  const liveBetRef = useRef(0);
  const liveTargetRef = useRef(0);
  const cashedRef = useRef(false);

  // Pre-committed seed for next round
  const [serverSeed, setServerSeed] = useState<string>("");
  const [serverSeedHash, setServerSeedHash] = useState<string>("");
  const clientSeed = getClientSeed();

  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number>(0);
  const phaseRef = useRef<Phase>(phase);

  // Commit a fresh server seed on mount and after every round.
  useEffect(() => {
    if (phase === "idle" || phase === "crashed") {
      const s = generateServerSeed();
      hashServerSeed(s).then((h) => {
        setServerSeed(s);
        setServerSeedHash(h);
        setPhase("committed");
      });
    }
  }, [phase]);

  // Initialize server seed on mount if not present
  useEffect(() => {
    if (!serverSeed || !serverSeedHash) {
      const s = generateServerSeed();
      hashServerSeed(s).then((h) => {
        setServerSeed(s);
        setServerSeedHash(h);
        setPhase("committed");
      });
    }
  }, []);

  // Update phase ref when phase changes
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const canBet = phase === "committed" && bet > 0 && bet <= balance && target >= 1.01 && serverSeed && serverSeedHash;

  const place = useCallback(async () => {
    if (!canBet) return;
    
    try {
      const nonce = bumpNonce();
      const crash = await computeCrashPoint(serverSeed, clientSeed, nonce);
      
      // Determine win/lose immediately
      const won = crash > target;
      const payout = won ? +(bet * target).toFixed(2) : 0;
      const delta = won ? payout - bet : -bet;
      
      // Create bet record
      const rec: BetRecord = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        bet,
        target,
        crash,
        won,
        payout,
        cashedOutAt: won ? target : undefined,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce: nonce >= 0 ? nonce : (lastResult?.nonce ?? 0) + 1,
      };

      // Save history and update balance immediately
      recordBet(rec, delta);
      if (onBalanceChange) onBalanceChange(delta);
      setLastResult(rec);
      
      // Show result toast
      if (won) {
        toast.success(`Won @ ${target.toFixed(2)}×  ·  bust was ${crash.toFixed(2)}×`);
        playBeep("win");
      } else {
        toast.error(`Bust @ ${crash.toFixed(2)}×`);
        playBeep("lose");
      }
      
      // Animate the result
      setCrashAt(crash);
      setMultiplier(crash);
      setPhase("crashed");
      
      // Reset for next bet after delay
      setTimeout(() => {
        setPhase("committed");
      }, 2000);
      
    } catch (error) {
      console.error('Error placing bet:', error);
      toast.error('Failed to place bet');
    }
  }, [canBet, bet, target, serverSeed, clientSeed, onBalanceChange, recordBet, setLastResult]);

  const cashOutNow = useCallback(() => {
    if (phase !== "running" || cashedRef.current) return;
    cashedRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    finalize(crashAt ?? multiplier, -1, multiplier, true);
    setPhase("crashed");
  }, [phase, multiplier, crashAt]);

  const finalize = useCallback((
    crash: number,
    nonce: number,
    cashedAt: number,
    won: boolean
  ) => {
    console.log('Finalize called:', { crash, nonce, cashedAt, won, liveBet: liveBetRef.current, liveTarget: liveTargetRef.current });
    const lockedBet = liveBetRef.current;
    const lockedTarget = liveTargetRef.current;
    const payout = won ? +(lockedBet * lockedTarget).toFixed(2) : 0;
    const delta = won ? payout - lockedBet : -lockedBet;
    
    const rec: BetRecord = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      bet: lockedBet,
      target: liveTargetRef.current,
      crash,
      won,
      payout,
      cashedOutAt: won ? lockedTarget : undefined,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce: nonce >= 0 ? nonce : (lastResult?.nonce ?? 0) + 1,
    };

    console.log('Recording bet:', rec, 'delta:', delta);
    recordBet(rec, delta);
    console.log('After recordBet, history length:', history.length);
    if (onBalanceChange) onBalanceChange(delta);
    setLastResult(rec);

    // Bust toast & phase transition only when the curve actually finishes.
    if (!won) {
      toast.error(`Bust @ ${crash.toFixed(2)}×`);
      playBeep("lose");
      setPhase("crashed");
    } else if (cashedAt >= crash - 1e-9) {
      // Cashed exactly at crash (won by tick) — round done.
      setPhase("crashed");
    } else {
      // Auto cash-out before crash - continue animation but mark as crashed when it hits crash
      // Phase will be set to crashed when animation reaches crash point
    }

    // Force aggressive cleanup after finalize
    setTimeout(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      cashedRef.current = false;
    }, 100);
  }, [serverSeed, serverSeedHash, clientSeed, lastResult, recordBet, onBalanceChange]);

  // When animation reaches crash AFTER a manual/auto cashout, flip phase.
  useEffect(() => {
    if (phase === "running" && crashAt && multiplier >= crashAt) {
      setPhase("crashed");
    }
  }, [multiplier, crashAt, phase]);

  
  // Safety timeout to prevent game from getting stuck
  useEffect(() => {
    if (phase === "running" && crashAt) {
      const timeout = setTimeout(() => {
        if (phaseRef.current === "running") {
          setPhase("crashed");
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        }
      }, 30000); // 30 second timeout
      return () => clearTimeout(timeout);
    }
  }, [phase, crashAt]);

  // Aggressive cleanup on phase changes
  useEffect(() => {
    return () => {
      // Clean up all animation frames and timers
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Force cleanup on every phase change
  useEffect(() => {
    // Cancel all pending animations when phase changes
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [phase]);

  const stats = useMemo(() => {
    const wins = history.filter(h => h.won).length;
    const losses = history.length - wins;
    const net = history.reduce((acc, h) => acc + (h.won ? h.payout - h.bet : -h.bet), 0);
    const best = history.reduce((m, h) => Math.max(m, h.crash), 0);
    return { wins, losses, net, best, total: history.length };
  }, [history]);

  const liveProfit = phase === "running" && cashedRef.current
    ? +(liveBetRef.current * liveTargetRef.current - liveBetRef.current).toFixed(2)
    : phase === "running"
    ? +(liveBetRef.current * multiplier - liveBetRef.current).toFixed(2)
    : 0;

  const getPhaseLabel = () => {
    switch (phase) {
      case "running": return "Round · live";
      case "betting": return "Round · ready";
      case "crashed": return "Round · ended";
      default: return "Round · —";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Game Canvas */}
      <Card className="relative overflow-hidden border-border/60 bg-card/60 backdrop-blur shadow-card min-h-[320px]">
        <div className="aspect-[16/10] w-full p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              {getPhaseLabel()}
            </div>
            <div className="text-xs text-muted-foreground">
              House edge {HOUSE_EDGE_PCT.toFixed(0)}%
            </div>
          </div>

          <div className="relative mt-2 h-full">
            <svg viewBox="0 0 600 320" className="h-full w-full">
              <defs>
                <linearGradient id="curveGrad" x1="0" x2="1" y1="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="fillGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1="0"
                  x2="600"
                  y1={i * 64}
                  y2={i * 64}
                  stroke="hsl(var(--border))"
                  strokeDasharray="4 6"
                  opacity="0.4"
                />
              ))}
              {/* Build proper rising curve */}
              {(() => {
                const W = 600;
                const H = 320;
                const maxM = Math.max(2, multiplier * 1.5);
                const maxT = Math.log(maxM) / 0.18;
                const tNow = Math.log(Math.max(1, multiplier)) / 0.18;
                
                // Generate curve points
                const points: string[] = [];
                const steps = 50;
                for (let i = 0; i <= steps; i++) {
                  const t = (i / steps) * tNow;
                  const m = Math.exp(0.18 * t);
                  const x = (t / maxT) * W;
                  const y = H - ((m - 1) / (maxM - 1)) * H;
                  points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                }
                
                // Add bottom points for fill
                points.push(`${W.toFixed(1)},${H.toFixed(1)}`);
                points.push(`0,${H.toFixed(1)}`);
                
                return (
                  <>
                    <path
                      d={`M ${points.join(' L ')}`}
                      fill="url(#fillGrad)"
                    />
                    <path
                      d={`M ${points.slice(0, -2).join(' L ')}`}
                      fill="none"
                      stroke="url(#curveGrad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </>
                );
              })()}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={`font-mono-num text-7xl font-bold tabular-nums md:text-8xl ${
                  phase === "running"
                    ? cashedRef.current
                      ? "text-primary"
                      : "text-accent"
                    : phase === "crashed" && lastResult && !lastResult.won
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {multiplier.toFixed(2)}×
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {phase === "running" && !cashedRef.current && "in flight — cash out!"}
                {phase === "running" && cashedRef.current && `locked +${liveProfit}`}
                {phase === "betting" && "ready — place your bet"}
                {phase === "crashed" && lastResult &&
                  (lastResult.won
                    ? `cashed @ ${lastResult.cashedOutAt?.toFixed(2)}×  ·  bust was ${crashAt?.toFixed(2)}×`
                    : `crashed @ ${crashAt?.toFixed(2)}×`)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Controls */}
      <div className="space-y-4">
        {/* Balance Card */}
        <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Balance</span>
            <button
              onClick={() => { reset(); toast.success("History reset."); }}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-smooth hover:text-foreground"
            >
              <Repeat className="h-3 w-3" /> Reset
            </button>
          </div>
          <div className="font-mono-num text-3xl font-semibold text-primary">
            {balance.toFixed(2)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">credits</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <Stat label="Net" value={`${stats.net >= 0 ? "+" : ""}${stats.net.toFixed(2)}`} tone={stats.net >= 0 ? "win" : "loss"} />
            <Stat label="W / L" value={`${stats.wins} / ${stats.losses}`} />
            <Stat label="Best" value={stats.best ? `${stats.best.toFixed(2)}×` : "—"} icon={<Flame className="h-3 w-3" />} />
          </div>
        </Card>

        {/* Betting Card */}
        <Card className="space-y-4 border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
          <div className="space-y-2">
            <Label htmlFor="bet" className="text-xs uppercase tracking-widest text-muted-foreground">Bet</Label>
            <div className="flex gap-2">
              <Input
                id="bet"
                type="number"
                min={1}
                step={1}
                value={bet}
                onChange={(e) => setBet(Math.max(0, +e.target.value || 0))}
                disabled={phase === "running"}
                className="font-mono-num text-lg"
              />
              <Button variant="secondary" size="sm" disabled={phase === "running"} onClick={() => setBet(Math.max(1, Math.floor(bet / 2)))}>½</Button>
              <Button variant="secondary" size="sm" disabled={phase === "running"} onClick={() => setBet(Math.min(balance, bet * 2))}>2×</Button>
            </div>
            <div className="flex gap-1">
              {[10, 50, 100, 250].map((v) => (
                <Button key={v} variant="ghost" size="sm" disabled={phase === "running"} onClick={() => setBet(Math.min(balance, v))} className="flex-1 text-xs">
                  {v}
                </Button>
              ))}
              <Button variant="ghost" size="sm" disabled={phase === "running"} onClick={() => setBet(Math.floor(balance))} className="flex-1 text-xs">Max</Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="target" className="text-xs uppercase tracking-widest text-muted-foreground">
              Auto cash-out
            </Label>
            <Input
              id="target"
              type="number"
              min={1.01}
              max={1000}
              step={0.01}
              value={target}
              onChange={(e) => setTarget(Math.max(1.01, +e.target.value || 1.01))}
              disabled={phase === "running"}
              className="font-mono-num text-lg"
            />
            <div className="flex gap-2">
              {[1.5, 2, 5, 10].map((v) => (
                <Button key={v} variant="secondary" size="sm" disabled={phase === "running"} onClick={() => setTarget(v)} className="flex-1">
                  {v.toFixed(2)}×
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Potential payout: <span className="font-mono-num text-accent">{(bet * target).toFixed(2)}</span>
              <span className="ml-1">(+{(bet * target - bet).toFixed(2)})</span>
            </p>
          </div>

          {/* Action Button */}
          {phase === "running" ? (
            <Button
              onClick={cashOutNow}
              disabled={cashedRef.current}
              size="lg"
              className="w-full bg-gradient-accent text-accent-foreground"
            >
              <Hand className="mr-2 h-5 w-5" />
              {cashedRef.current
                ? `Locked +${liveProfit}`
                : `Cash out @ ${multiplier.toFixed(2)}× (+${liveProfit})`}
            </Button>
          ) : (
            <Button
              onClick={place}
              disabled={!canBet}
              size="lg"
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              <Play className="mr-2 h-5 w-5" />
              Place bet
            </Button>
          )}

                  </Card>

        {/* Recent Rounds */}
        <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-accent" /> Recent rounds
          </div>
          <div className="mb-2 text-xs text-muted-foreground">{stats.total} played - History length: {history.length}</div>
          {history.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No bets yet — place your first one above.</div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {history.slice(0, 15).map((h) => (
                <div
                  key={h.id}
                  className={`rounded border px-1.5 py-1 text-center font-mono-num text-[10px] leading-tight ${
                    h.won
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                  title={`bet ${h.bet} @ ${h.target}× → crash ${h.crash}×${h.won ? ` · cashed ${h.cashedOutAt?.toFixed(2)}×` : ""}`}
                >
                  {h.crash.toFixed(2)}×
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Provably Fair */}
        <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" /> Provably fair
          </div>
          <div className="space-y-2 text-xs">
            <Row label="Server seed (hash)" value={serverSeedHash} mono />
            <Row label="Client seed" value={clientSeed} mono />
            {lastResult && (
              <>
                <div className="my-2 border-t border-border/60" />
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Last round revealed</div>
                <Row label="Server seed" value={lastResult.serverSeed} mono />
                <Row label="Nonce" value={String(lastResult.nonce)} mono />
                <Row label="Crash" value={`${lastResult.crash.toFixed(2)}×`} />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone, icon }: { label: string; value: string; tone?: "win" | "loss"; icon?: React.ReactNode }) => (
  <div className="rounded-md border border-border/60 bg-secondary/40 px-2 py-2">
    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
      {icon} {label}
    </div>
    <div className={`font-mono-num text-sm font-semibold ${tone === "win" ? "text-primary" : tone === "loss" ? "text-destructive" : "text-foreground"}`}>
      {value}
    </div>
  </div>
);

const Row = memo(({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className={`min-w-0 truncate text-right ${mono ? "font-mono-num" : ""}`}>{value || "—"}</span>
  </div>
));

export const CrashGame = memo(CrashGameComponent);
