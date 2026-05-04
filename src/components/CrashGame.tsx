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
import { useSettings, playBeep, getSettings } from "@/lib/settings";

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
  const [showResultModal, setShowResultModal] = useState(false);

  // Round-active bet snapshot (so changing inputs mid-flight doesn't affect payout)
  const liveBetRef = useRef(0);
  const liveTargetRef = useRef(0);
  const cashedRef = useRef(false);
  const finalizedRef = useRef(false);

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
    console.log('Place bet clicked:', { phase, bet, balance, target, serverSeed: !!serverSeed, serverSeedHash: !!serverSeedHash, canBet });
    if (!canBet) {
      console.log('Cannot place bet - conditions not met');
      return;
    }
    
    try {
      console.log('Starting bet execution...');
      const nonce = bumpNonce();
      const crash = await computeCrashPoint(serverSeed, clientSeed, nonce);
      console.log('Crash point computed:', crash);
      
            
      setCrashAt(crash);
      setMultiplier(1.0);
      liveBetRef.current = bet;
      liveTargetRef.current = target;
      cashedRef.current = false;
      finalizedRef.current = false; // Reset finalized flag for new bet
      setPhase("running");
      phaseRef.current = "running"; // Update ref immediately
      startTsRef.current = performance.now();
      console.log('Game started, phase set to running');

      const tick = (now: number) => {
        console.log('Animation tick called, phaseRef:', phaseRef.current, 'phase:', phase, 'cashed:', cashedRef.current);
        // Check if we should still be running - use ref to get current phase
        if (phaseRef.current !== "running" || cashedRef.current) {
          console.log('Animation stopped - phaseRef:', phaseRef.current, 'cashed:', cashedRef.current);
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          return;
        }
        
        const t = (now - startTsRef.current) / 1000; // seconds
        const m = Math.max(1, Math.pow(Math.E, 0.18 * t));
        console.log('Animation progress:', { t, m, crash, target: liveTargetRef.current, mCrash: m >= crash });
        
        if (m >= crash) {
          console.log('Crash condition met:', { m, crash, target: liveTargetRef.current, won: crash > liveTargetRef.current });
          setMultiplier(crash);
          // Clean up animation frame
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          // If user already manually cashed, finalize was handled then.
          if (!cashedRef.current) {
            const won = crash > liveTargetRef.current;
            console.log('Calling finalize with won:', won);
            finalize(crash, nonce, liveTargetRef.current, won);
          }
          return;
        }
        
        // Throttle updates to reduce DOM manipulation
        const roundedMultiplier = Math.round(m * 100) / 100;
        
        // Only update if multiplier changed significantly to reduce DOM updates
        if (Math.abs(roundedMultiplier - multiplier) > 0.01) {
          setMultiplier(roundedMultiplier);
        }
        
        // Auto cash-out at target
        // if (!cashedRef.current && m >= liveTargetRef.current) {
        //   cashedRef.current = true;
        //   // Continue animation until crash, but lock the win now.
        //   finalize(crash, nonce, liveTargetRef.current, true);
        //   // For auto cash-out, we should continue animation until crash
        //   if (phaseRef.current === "running") {
        //     rafRef.current = requestAnimationFrame(tick);
        //   }
        //   return;
        // }

        if (phaseRef.current === "running") {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      // Start animation immediately
      console.log('Starting animation frame...');
      // Test immediate call to see if tick function works
      console.log('Testing immediate tick call...');
      try {
        tick(performance.now());
      } catch (error) {
        console.error('Error in immediate tick call:', error);
      }
      rafRef.current = requestAnimationFrame(tick);
      console.log('Animation frame requested:', rafRef.current);
    } catch (error) {
      console.error('Error placing bet:', error);
      toast.error('Failed to place bet');
    }
  }, [canBet, bet, target, serverSeed, clientSeed, multiplier]);

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
    // Prevent duplicate finalize calls
    if (finalizedRef.current) {
      console.log('Finalize already called - skipping duplicate');
      return;
    }
    
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
      nonce: -1,
      type: 'bet' as const
    };

    // Mark as finalized to prevent duplicates
    finalizedRef.current = true;

    // Save history and update balance when animation stops
    console.log('Saving history and updating balance when animation stopped');
    recordBet(rec, delta);
    if (onBalanceChange) onBalanceChange(delta);
    setLastResult(rec);
    
    // Show result modal only if enabled in settings
    const settings = getSettings();
    if (settings.resultModal) {
      setShowResultModal(true);
    }
    
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

  // Ensure finalize is called when phase changes to crashed (safety mechanism)
  useEffect(() => {
    if (phase === "crashed" && crashAt && !cashedRef.current && !finalizedRef.current) {
      // Check if we've already finalized this round
      const lastBetId = lastResult?.id;
      const currentBetId = `${crashAt}-${liveBetRef.current}-${liveTargetRef.current}`;
      
      if (lastBetId !== currentBetId) {
        console.log('Phase changed to crashed - ensuring finalize is called');
        const won = crashAt > liveTargetRef.current;
        finalize(crashAt, -1, liveTargetRef.current, won);
      }
    }
  }, [phase, crashAt, lastResult, finalize]);

  // Safety timeout to prevent game from getting stuck and ensure finalize is called
  useEffect(() => {
    if (phase === "running" && crashAt) {
      const timeout = setTimeout(() => {
        if (phaseRef.current === "running" && !finalizedRef.current) {
          console.log('Safety timeout reached - forcing finalize');
          const won = crashAt > liveTargetRef.current;
          finalize(crashAt, -1, liveTargetRef.current, won);
          setPhase("crashed");
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        }
      }, 30000); // 30 second timeout
      return () => clearTimeout(timeout);
    }
  }, [phase, crashAt, finalize]);

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
              {/* Grid lines */}
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
              {/* Axis lines */}
              <line x1="0" x2="600" y1="320" y2="320" stroke="hsl(var(--border))" strokeWidth="2" />
              <line x1="0" x2="0" y1="0" y2="320" stroke="hsl(var(--border))" strokeWidth="2" />
              {/* X-axis labels */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <text key={i} x={i * 100} y="335" fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="middle">
                  {i * 2}x
                </text>
              ))}
              {/* Y-axis labels */}
              {[1, 2, 3, 4].map((i) => (
                <text key={i} x="-10" y={320 - i * 64} fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="end">
                  {i}x
                </text>
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
                className={`font-mono-num text-7xl font-bold tabular-nums md:text-8xl transition-all duration-300 ${
                  phase === "running"
                    ? cashedRef.current
                      ? "text-primary scale-110"
                      : "text-accent animate-pulse scale-105"
                    : phase === "crashed" && lastResult && !lastResult.won
                    ? "text-destructive scale-95"
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
              className="w-full bg-gradient-accent text-accent-foreground transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              <Hand className="mr-2 h-5 w-5 animate-pulse" />
              {cashedRef.current
                ? `Locked +${liveProfit}` 
                : `Cash out @ ${multiplier.toFixed(2)}× (+${liveProfit})`}
            </Button>
          ) : (
            <Button
              onClick={place}
              disabled={!canBet}
              size="lg"
              className={`w-full bg-gradient-primary text-primary-foreground transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                canBet ? "shadow-lg hover:shadow-xl" : "opacity-50 cursor-not-allowed"
              }`}
            >
              <Play className={`mr-2 h-5 w-5 ${canBet ? "animate-bounce" : ""}`} />
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
              {history.slice(0, 15).map((h, index) => (
                <div
                  key={h.id}
                  className={`rounded border px-1.5 py-1 text-center font-mono-num text-[10px] leading-tight transition-all duration-300 transform hover:scale-110 ${
                    h.won
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-lg"
                      : "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:shadow-lg"
                  }`}
                  style={{
                    animation: index === 0 ? 'slideIn 0.3s ease-out' : undefined
                  }}
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
    {/* Win/Lose Result Modal */}
      {showResultModal && lastResult && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowResultModal(false)}
        >
          <div 
            className="relative mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative bg-card/90 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-border/50 ${
                lastResult.won 
                  ? 'animate-modal-win' 
                  : 'animate-modal-lose'
              }`}
              style={{
                animation: lastResult.won 
                  ? 'modalFadeInBounce 0.6s ease-out forwards'
                  : 'modalFadeInShake 0.6s ease-out forwards',
                boxShadow: lastResult.won 
                  ? '0 0 60px rgba(34, 197, 94, 0.6), 0 0 120px rgba(34, 197, 94, 0.3)'
                  : '0 0 60px rgba(239, 68, 68, 0.6), 0 0 120px rgba(239, 68, 68, 0.3)',
                borderColor: lastResult.won 
                  ? 'rgba(34, 197, 94, 0.5)'
                  : 'rgba(239, 68, 68, 0.5)'
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowResultModal(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Result Image - Much Larger */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <img
                    src={lastResult.won ? "/win.png" : "/lose.png"}
                    alt={lastResult.won ? "Win" : "Lose"}
                    className={`h-64 w-64 md:h-80 md:w-80 lg:h-[28rem] lg:w-[28rem] object-contain`}
                  />
                </div>
              </div>

              {/* Result Text - Simplified */}
              <div className="text-center">
                <h3 className={`text-4xl font-bold mb-6 ${
                  lastResult.won ? 'text-primary' : 'text-destructive'
                }`}>
                  {lastResult.won ? 'You Won!' : 'You Lost!'}
                </h3>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setShowResultModal(false)}
                className={`w-full mt-8 py-4 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                  lastResult.won
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                }`}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
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
