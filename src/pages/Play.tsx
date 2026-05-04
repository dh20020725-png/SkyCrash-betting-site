import { CrashGame } from "@/components/CrashGame";
import { useAuth } from "@/lib/auth";

const Play = () => {
  const { user } = useAuth();
  
  // Use user's actual balance from database, not local state
  const handleBalanceUpdate = (amount: number) => {
    // Balance updates are handled by the ledger system
    console.log('Balance update:', amount);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SkyCrash</h1>
          <p className="text-xs text-muted-foreground">Provably fair crash · Real USDT betting</p>
        </div>
        <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          REAL · USDT Betting
        </span>
      </div>
      
      <div className="space-y-4">
        <CrashGame balance={user?.balance || 0} onBalanceChange={handleBalanceUpdate} />
        <p className="text-center text-xs text-muted-foreground">
          Verify any round: SHA256(serverSeed) must equal the published hash, then
          HMAC-SHA256(serverSeed, "<code>clientSeed:nonce</code>") deterministically produces the crash point.
        </p>
      </div>
    </div>
  );
};

export default Play;