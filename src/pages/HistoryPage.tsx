import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLedger } from "@/lib/ledger";
import { Download } from "lucide-react";

type Filter = "all" | "wins" | "losses";

const HistoryPage = () => {
  const { history } = useLedger();
  const [filter, setFilter] = useState<Filter>("all");
  const [minMult, setMinMult] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const min = parseFloat(minMult);
    return history.filter((h) => {
      if (filter === "wins" && !h.won) return false;
      if (filter === "losses" && h.won) return false;
      if (!Number.isNaN(min) && h.crash < min) return false;
      if (search && !h.serverSeedHash.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [history, filter, minMult, search]);

  const exportCsv = () => {
    const header = ["time", "bet", "target", "crash", "cashedOutAt", "won", "payout", "nonce", "serverSeed", "clientSeed"];
    const lines = [header.join(",")];
    for (const h of rows) {
      lines.push([
        new Date(h.ts).toISOString(),
        h.bet, h.target, h.crash, h.cashedOutAt ?? "", h.won, h.payout, h.nonce,
        h.serverSeed, h.clientSeed,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skycrash-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bet history</h1>
        <p className="text-xs text-muted-foreground">Every round, with the seeds needed to verify it.</p>
      </header>

      <Card className="flex flex-col gap-3 border-border/60 bg-card/60 p-4 shadow-card backdrop-blur md:flex-row md:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="search" className="text-xs uppercase tracking-widest text-muted-foreground">Search server-seed hash</Label>
          <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="paste full or partial hash…" className="font-mono-num" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minMult" className="text-xs uppercase tracking-widest text-muted-foreground">Min multiplier</Label>
          <Input id="minMult" type="number" step="0.1" value={minMult} onChange={(e) => setMinMult(e.target.value)} placeholder="e.g. 2" className="w-32 font-mono-num" />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="wins">Wins</TabsTrigger>
            <TabsTrigger value="losses">Losses</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
        </Button>
      </Card>

      <Card className="overflow-hidden border-border/60 bg-card/60 shadow-card backdrop-blur">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No rounds match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-secondary/30 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Bet</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">Crash</th>
                  <th className="px-4 py-2 font-medium">Result</th>
                  <th className="px-4 py-2 font-medium">Nonce</th>
                  <th className="px-4 py-2 font-medium">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((h) => (
                  <tr key={h.id} className="font-mono-num text-xs md:text-sm">
                    <td className="px-4 py-2 text-muted-foreground">{new Date(h.ts).toLocaleString()}</td>
                    <td className="px-4 py-2">{h.bet}</td>
                    <td className="px-4 py-2">{h.target.toFixed(2)}×</td>
                    <td className="px-4 py-2">{h.crash.toFixed(2)}×</td>
                    <td className={`px-4 py-2 ${h.won ? "text-primary" : "text-destructive"}`}>
                      {h.won ? `+${(h.payout - h.bet).toFixed(2)}` : `−${h.bet}`}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{h.nonce}</td>
                    <td className="px-4 py-2 text-muted-foreground" title={h.serverSeedHash}>
                      {h.serverSeedHash.slice(0, 10)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default HistoryPage;