import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSettings, playBeep } from "@/lib/settings";
import { getClientSeed, rotateClientSeed, useLedger } from "@/lib/ledger";
import { toast } from "sonner";
import { Volume2, Sparkles, Shuffle, Trash2 } from "lucide-react";

const SettingsPage = () => {
  const [settings, setSettings] = useSettings();
  const { reset } = useLedger();
  const [seedInput, setSeedInput] = useState("");
  const [currentSeed, setCurrentSeed] = useState(getClientSeed());

  const rotate = (custom?: string) => {
    const next = rotateClientSeed(custom);
    setCurrentSeed(next);
    setSeedInput("");
    toast.success("Client seed rotated. Nonce reset to 0.");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">All settings are stored locally in your browser.</p>
      </header>

      <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
        <h2 className="text-sm font-semibold">Experience</h2>
        <div className="mt-4 space-y-4">
          <Toggle
            icon={<Volume2 className="h-4 w-4 text-accent" />}
            label="Sound effects"
            description="Tiny beeps on cash-out and bust."
            checked={settings.sound}
            onChange={(v) => { setSettings({ sound: v }); if (v) playBeep("win"); }}
          />
          <Toggle
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            label="Animations & glow"
            description="Pulsing multiplier, crash flash, button glow."
            checked={settings.animations}
            onChange={(v) => setSettings({ animations: v })}
          />
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-5 shadow-card backdrop-blur">
        <h2 className="text-sm font-semibold">Provably-fair: client seed</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The client seed feeds into every crash calculation. Rotate it whenever you like — your influence on
          the result means the server can't have pre-computed it for you.
        </p>
        <div className="mt-3 space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Current client seed</Label>
          <div className="font-mono-num rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-sm">{currentSeed}</div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="custom seed (optional)"
            maxLength={64}
            className="font-mono-num"
          />
          <Button onClick={() => rotate(seedInput || undefined)} className="bg-gradient-primary text-primary-foreground shadow-glow-primary">
            <Shuffle className="mr-2 h-4 w-4" /> Rotate seed
          </Button>
        </div>
      </Card>

      <Card className="border-destructive/40 bg-destructive/5 p-5 shadow-card backdrop-blur">
        <h2 className="text-sm font-semibold text-destructive">Reset</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Clears your bet history. Balance requires real USDT deposits. Profile and settings stay.
        </p>
        <Button
          variant="destructive"
          className="mt-3"
          onClick={() => { reset(); toast.success("History reset."); }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Reset history
        </Button>
      </Card>
    </div>
  );
};

const Toggle = ({ icon, label, description, checked, onChange }: {
  icon: React.ReactNode; label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-secondary/30 px-3 py-3">
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/60">{icon}</div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default SettingsPage;