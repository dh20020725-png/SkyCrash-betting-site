import type { BetRecord } from "./ledger";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: number; // 0..1
};

export function computeAchievements(history: BetRecord[]): Achievement[] {
  const wins = history.filter((h) => h.won);
  const losses = history.filter((h) => !h.won);
  const best = history.reduce((m, h) => Math.max(m, h.crash), 0);
  const bestWin = wins.reduce((m, h) => Math.max(m, h.cashedOutAt ?? 0), 0);
  const biggestPayout = wins.reduce((m, h) => Math.max(m, h.payout - h.bet), 0);

  // Best win streak
  let streak = 0;
  let bestStreak = 0;
  // history is newest-first; iterate reversed for chronological order
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].won) {
      streak++;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }

  const totalWagered = history.reduce((s, h) => s + h.bet, 0);

  return [
    {
      id: "first-bet",
      title: "First Flight",
      description: "Place your very first bet.",
      unlocked: history.length >= 1,
      progress: Math.min(1, history.length / 1),
    },
    {
      id: "first-win",
      title: "Wheels Up",
      description: "Cash out a winning round.",
      unlocked: wins.length >= 1,
      progress: Math.min(1, wins.length / 1),
    },
    {
      id: "five-streak",
      title: "On Fire",
      description: "Win 5 rounds in a row.",
      unlocked: bestStreak >= 5,
      progress: Math.min(1, bestStreak / 5),
    },
    {
      id: "ten-x",
      title: "Moonshot",
      description: "Cash out at 10× or higher.",
      unlocked: bestWin >= 10,
      progress: Math.min(1, bestWin / 10),
    },
    {
      id: "fifty-x",
      title: "Outer Orbit",
      description: "Survive a round that crashed at 50× or higher (whether you cashed or not).",
      unlocked: best >= 50,
      progress: Math.min(1, best / 50),
    },
    {
      id: "hundred-rounds",
      title: "Centurion",
      description: "Play 100 rounds.",
      unlocked: history.length >= 100,
      progress: Math.min(1, history.length / 100),
    },
    {
      id: "wagered-10k",
      title: "High Roller",
      description: "Wager 10,000 credits in total.",
      unlocked: totalWagered >= 10_000,
      progress: Math.min(1, totalWagered / 10_000),
    },
    {
      id: "big-payout",
      title: "Jackpot Vibes",
      description: "Win 500+ credits in a single round.",
      unlocked: biggestPayout >= 500,
      progress: Math.min(1, biggestPayout / 500),
    },
  ];
}