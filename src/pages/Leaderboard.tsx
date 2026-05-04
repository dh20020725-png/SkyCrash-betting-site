import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useLedger } from "@/lib/ledger";
import { useProfile, avatarGradient } from "@/lib/profile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Flame, TrendingUp, User as UserIcon } from "lucide-react";

type LocalMode = "payout" | "multiplier" | "streak";

const Leaderboard = () => {
  const { history } = useLedger();
  const [profile] = useProfile();
  const [localMode, setLocalMode] = useState<LocalMode>("payout");

  const localRows = useMemo(() => {
    if (localMode === "payout") {
      return [...history]
        .filter((h) => h.won)
        .sort((a, b) => b.payout - b.bet - (a.payout - a.bet))
        .slice(0, 20)
        .map((h) => ({
          id: h.id,
          ts: h.ts,
          primary: `+${(h.payout - h.bet).toFixed(2)}`,
          secondary: `${h.bet} @ ${h.cashedOutAt?.toFixed(2) ?? h.target.toFixed(2)}×`,
        }));
    }
    if (localMode === "multiplier") {
      return [...history]
        .sort((a, b) => b.crash - a.crash)
        .slice(0, 20)
        .map((h) => ({
          id: h.id,
          ts: h.ts,
          primary: `${h.crash.toFixed(2)}×`,
          secondary: h.won ? `cashed ${h.cashedOutAt?.toFixed(2)}×` : "busted",
        }));
    }
    // streaks: scan chronological, surface top streaks
    const chrono = [...history].reverse();
    const streaks: { length: number; endTs: number }[] = [];
    let cur = 0;
    let endTs = 0;
    for (const h of chrono) {
      if (h.won) {
        cur++;
        endTs = h.ts;
      } else if (cur > 0) {
        streaks.push({ length: cur, endTs });
        cur = 0;
      }
    }
    if (cur > 0) streaks.push({ length: cur, endTs });
    return streaks
      .sort((a, b) => b.length - a.length)
      .slice(0, 20)
      .map((s, i) => ({
        id: `s-${i}-${s.endTs}`,
        ts: s.endTs,
        primary: `${s.length} wins`,
        secondary: "in a row",
      }));
  }, [history, localMode]);

  const grad = avatarGradient(profile.avatarSeed);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-xs text-muted-foreground">
            Local-only stats. Your data lives in your browser.
          </p>
        </div>
      </header>

      <Tabs value={localMode} onValueChange={(v) => setLocalMode(v as LocalMode)}>
        <TabsList>
          <TabsTrigger value="payout">
            <Trophy className="mr-1.5 h-3.5 w-3.5" /> Best payouts
          </TabsTrigger>
          <TabsTrigger value="multiplier">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Highest multipliers
          </TabsTrigger>
          <TabsTrigger value="streak">
            <Flame className="mr-1.5 h-3.5 w-3.5" /> Win streaks
          </TabsTrigger>
        </TabsList>

        <TabsContent value={localMode} className="mt-4">
          <Card className="border-border/60 bg-card/60 p-2 shadow-card backdrop-blur">
            {localRows.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No rounds played yet. Start playing to see your stats!
              </div>
            ) : (
              <ol className="divide-y divide-border/60">
                {localRows.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="w-6 text-center font-mono-num text-sm text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 truncate text-sm font-medium">
                        {r.primary}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.secondary}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Leaderboard;
