import { Link, NavLink, Outlet } from "react-router-dom";
import { Rocket, Home, Gamepad2, Trophy, User, History, ShieldCheck, Settings as SettingsIcon, LogOut, LogIn, ChevronDown } from "lucide-react";
import { useProfile, avatarGradient } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

const NAV = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/play", label: "Play", icon: Gamepad2 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/history", label: "History", icon: History },
  { to: "/verify", label: "Verify", icon: ShieldCheck },
];

export const AppShell = () => {
  const [profile] = useProfile();
  const grad = avatarGradient(profile.avatarSeed);
  const { user, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      return user.avatar_url;
    }
    // Generate a simple avatar based on username
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const colorIndex = (user?.username?.length || 0) % colors.length;
    return `https://ui-avatars.com/api/?name=${user?.username || user?.email?.split('@')[0] || 'User'}&background=${colors[colorIndex].replace('#', '')}&color=fff&size=32`;
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-gradient-primary">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">SkyCrash</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">USDT Betting</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-smooth ${
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-2 py-1 transition-smooth hover:bg-secondary"
                >
                  <img
                    src={getAvatarUrl()}
                    alt="Profile"
                    className="h-7 w-7 rounded-full"
                  />
                  <span className="hidden pr-1 text-xs font-medium text-foreground sm:inline">
                    {user.username || user.email?.split("@")[0]}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border/60 bg-background/95 backdrop-blur-md shadow-lg">
                    <div className="p-2">
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {user.email}
                      </div>
                      <div className="px-2 py-1.5 text-sm font-medium">
                        Balance: ${user.balance?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <div className="border-t border-border/60">
                      <Link
                        to="/profile"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60"
                      >
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60"
                      >
                        <SettingsIcon className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={async () => {
                          setIsDropdownOpen(false);
                          await signOut();
                          toast.success("Signed out");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary/60 text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button asChild variant="secondary" size="sm" className="hidden md:inline-flex">
                <Link to="/auth">
                  <LogIn className="h-3.5 w-3.5" /> Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-t border-border/60 px-2 py-1.5 md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-smooth ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-3 w-3" /> {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-border/60 bg-background/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <span className="font-semibold text-foreground">SkyCrash</span> — real-money
            crash game betting platform. Play with USDT. Real deposits. Real withdrawals.
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <div className="flex gap-4">
              <Link to="/verify" className="hover:text-foreground">Provably fair</Link>
              <Link to="/settings" className="hover:text-foreground">Settings</Link>
              <a
                href="https://en.wikipedia.org/wiki/Problem_gambling"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                Gambling help
              </a>
            </div>
            <div className="text-xs text-muted-foreground">
              Powered by <img src="/logo2.png" alt="21st DreamDev" className="h-32 inline-block align-middle" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};