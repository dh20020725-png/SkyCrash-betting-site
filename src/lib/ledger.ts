import { useEffect, useState } from "react";

const BAL_KEY = "demo_balance_v1";
const HIST_KEY = "demo_history_v1";
const SEED_KEY = "demo_clientSeed_v1";
const NONCE_KEY = "demo_nonce_v1";
const STARTING_BALANCE = 1000; // Default starting balance for new users

export type BetRecord = {
  id: string;
  ts: number;
  bet: number;
  target: number;
  crash: number;
  won: boolean;
  payout: number;
  cashedOutAt?: number; // actual multiplier user cashed at (manual or auto)
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  type: 'bet' | 'deposit' | 'withdrawal'; // Transaction type
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function getClientSeed(): string {
  let s = read<string>(SEED_KEY, "");
  if (!s) {
    s = Math.random().toString(36).slice(2, 10);
    write(SEED_KEY, s);
  }
  return s;
}

export function setClientSeed(s: string) {
  write(SEED_KEY, s);
}

export function rotateClientSeed(custom?: string): string {
  const s = (custom && custom.trim()) || Math.random().toString(36).slice(2, 12);
  write(SEED_KEY, s);
  write(NONCE_KEY, 0);
  return s;
}

export function getNonce(): number {
  return read<number>(NONCE_KEY, 0);
}

export function bumpNonce(): number {
  const n = getNonce() + 1;
  write(NONCE_KEY, n);
  return n;
}

export function useLedger() {
  const [history, setHistory] = useState<BetRecord[]>(() => read(HIST_KEY, []));

  useEffect(() => write(HIST_KEY, history), [history]);

  const recordBet = (b: BetRecord, delta: number) => {
    // Update balance in localStorage
    const currentBalance = getBalance();
    const newBalance = currentBalance + delta;
    setBalance(newBalance);
    
    setHistory((h) => [b, ...h].slice(0, 100));
  };

  const recordDeposit = (amount: number) => {
    // Add deposit to history
    const currentBalance = getBalance();
    const newBalance = currentBalance + amount;
    setBalance(newBalance);
    
    const depositRecord: BetRecord = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      bet: 0,
      target: 0,
      crash: 0,
      won: true,
      payout: amount,
      cashedOutAt: undefined,
      serverSeed: '',
      serverSeedHash: '',
      clientSeed: '',
      nonce: -1,
      type: 'deposit'
    };
    
    setHistory((h) => [depositRecord, ...h].slice(0, 100));
  };

  const recordWithdrawal = (amount: number) => {
    // Add withdrawal to history
    const currentBalance = getBalance();
    const newBalance = currentBalance - amount;
    setBalance(newBalance);
    
    const withdrawalRecord: BetRecord = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      bet: 0,
      target: 0,
      crash: 0,
      won: true,
      payout: amount,
      cashedOutAt: undefined,
      serverSeed: '',
      serverSeedHash: '',
      clientSeed: '',
      nonce: -1,
      type: 'withdrawal'
    };
    
    setHistory((h) => [withdrawalRecord, ...h].slice(0, 100));
  };

  const reset = () => {
    setHistory([]);
    setBalance(1000); // Set to correct starting balance
  };

  const getBalance = (): number => {
    return read<number>(BAL_KEY, STARTING_BALANCE);
  };

  const setBalance = (balance: number) => {
    write(BAL_KEY, balance);
  };

  return { 
    balance: getBalance(),
    setBalance,
    history, 
    recordBet, 
    recordDeposit,
    recordWithdrawal,
    reset 
  };
}

export const STARTING = STARTING_BALANCE;