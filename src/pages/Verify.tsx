import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { computeCrashPoint, hashServerSeed } from "@/lib/provablyFair";

type Result = {
  ok: boolean;
  hashMatches: boolean;
  computedHash: string;
  computedCrash: number;
  expectedHash?: string;
  expectedCrash?: number;
};

const Verify = () => {
  const [serverSeed, setServerSeed] = useState("");
  const [serverHash, setServerHash] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState("");
  const [expectedCrash, setExpectedCrash] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    if (!serverSeed.trim() || !clientSeed.trim() || !nonce.trim()) return;
    setBusy(true);
    try {
      const computedHash = await hashServerSeed(serverSeed.trim());
      const computedCrash = await computeCrashPoint(
        serverSeed.trim(),
        clientSeed.trim(),
        Number(nonce),
      );
      const hashMatches = !serverHash.trim() || serverHash.trim().toLowerCase() === computedHash;
      const crashMatches = !expectedCrash.trim() || Math.abs(Number(expectedCrash) - computedCrash) < 0.011;
      setResult({
        ok: hashMatches && crashMatches,
        hashMatches,
        computedHash,
        computedCrash,
        expectedHash: serverHash.trim() || undefined,
        expectedCrash: expectedCrash ? Number(expectedCrash) : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="border-border/60 bg-card/60 p-6 shadow-card backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">Provably-fair verifier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste any round's seeds and nonce. We'll re-hash the server seed and re-compute the crash point — purely in
          your browser. Works for SkyCrash rounds and any other crash game using the same algorithm:
          <br />
          <code className="font-mono-num text-xs">crash = f(HMAC-SHA256(serverSeed, clientSeed:nonce))</code>
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ss">Server seed (revealed)</Label>
            <Textarea
              id="ss"
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              placeholder="hex string from a finished round"
              className="font-mono-num"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh">Server seed hash <span className="text-muted-foreground">(optional — to confirm commitment)</span></Label>
            <Input id="sh" value={serverHash} onChange={(e) => setServerHash(e.target.value)} className="font-mono-num" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cs">Client seed</Label>
              <Input id="cs" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} className="font-mono-num" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nn">Nonce</Label>
              <Input id="nn" type="number" value={nonce} onChange={(e) => setNonce(e.target.value)} className="font-mono-num" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec">Expected crash <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="ec" type="number" step="0.01" value={expectedCrash} onChange={(e) => setExpectedCrash(e.target.value)} className="font-mono-num" />
          </div>

          <Button onClick={verify} disabled={busy || !serverSeed || !clientSeed || !nonce} className="w-full bg-gradient-primary text-primary-foreground shadow-glow-primary">
            {busy ? "Verifying…" : "Verify round"}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Result</div>
          {!result ? (
            <p className="mt-3 text-sm text-muted-foreground">Fill the form and hit Verify.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                result.ok
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}>
                {result.ok ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                <div>
                  <div className="font-semibold">{result.ok ? "Round is valid." : "Mismatch detected."}</div>
                  <div className="text-xs opacity-80">
                    {result.hashMatches ? "Hash matches commitment." : "Server seed hash does not match the commitment!"}
                  </div>
                </div>
              </div>
              <Row label="Computed hash" value={result.computedHash} mono />
              {result.expectedHash && <Row label="Expected hash" value={result.expectedHash} mono />}
              <Row label="Computed crash" value={`${result.computedCrash.toFixed(2)}×`} />
              {result.expectedCrash !== undefined && <Row label="Expected crash" value={`${result.expectedCrash.toFixed(2)}×`} />}
            </div>
          )}
        </Card>
        <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Algorithm</div>
          <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>1. <code className="font-mono-num">hex = HMAC-SHA256(serverSeed, clientSeed:nonce)</code></li>
            <li>2. House-edge bust check from <code className="font-mono-num">hex[13..21]</code> (4%).</li>
            <li>3. Crash from <code className="font-mono-num">hex[0..13]</code> via standard crash formula.</li>
            <li>4. <code className="font-mono-num">SHA-256(serverSeed)</code> must match the pre-published hash.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3 text-xs">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className={`min-w-0 break-all text-right ${mono ? "font-mono-num" : ""}`}>{value || "—"}</span>
  </div>
);

export default Verify;