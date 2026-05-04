import { useEffect, useState } from "react";

const KEY = "demo_profile_v1";

export type Profile = {
  name: string;
  avatarSeed: string; // used to deterministically render avatar
  createdAt: number;
};

const ADJ = ["Lucky", "Brave", "Cosmic", "Neon", "Silent", "Turbo", "Wild", "Solar"];
const NOUN = ["Falcon", "Comet", "Tiger", "Rocket", "Phoenix", "Nova", "Wolf", "Drake"];

function randomName() {
  return `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUN[Math.floor(Math.random() * NOUN.length)]}${Math.floor(
    Math.random() * 90 + 10,
  )}`;
}

function read(): Profile {
  if (typeof window === "undefined") return { name: "Player", avatarSeed: "x", createdAt: Date.now() };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const fresh: Profile = {
    name: randomName(),
    avatarSeed: Math.random().toString(36).slice(2, 10),
    createdAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

let listeners: Array<(p: Profile) => void> = [];
let current: Profile = read();

export function getProfile(): Profile {
  return current;
}

export function updateProfile(patch: Partial<Profile>) {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l(current));
}

export function useProfile(): [Profile, (p: Partial<Profile>) => void] {
  const [p, setP] = useState<Profile>(current);
  useEffect(() => {
    const fn = (next: Profile) => setP(next);
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);
  return [p, updateProfile];
}

/** Deterministic SVG-style "blocky" avatar from a seed. */
export function avatarGradient(seed: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 60 + (h % 90)) % 360;
  return { from: `hsl(${h1} 80% 55%)`, to: `hsl(${h2} 80% 45%)` };
}