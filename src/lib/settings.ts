import { useEffect, useState } from "react";

const KEY = "demo_settings_v1";

export type Settings = {
  sound: boolean;
  animations: boolean;
  resultModal: boolean;
};

const DEFAULTS: Settings = { sound: true, animations: true, resultModal: true };

function read(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let listeners: Array<(s: Settings) => void> = [];
let current: Settings = read();

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l(current));
}

export function useSettings(): [Settings, (p: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(current);
  useEffect(() => {
    const fn = (next: Settings) => setS(next);
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((l) => l !== fn);
    };
  }, []);
  return [s, setSettings];
}

/** Tiny WebAudio beep — no asset files needed. */
export function playBeep(kind: "win" | "lose" | "tick") {
  if (!current.sound) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    const freq = kind === "win" ? 880 : kind === "lose" ? 180 : 440;
    o.frequency.value = freq;
    o.type = kind === "lose" ? "sawtooth" : "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start();
    o.stop(ctx.currentTime + 0.26);
    setTimeout(() => ctx.close(), 400);
  } catch {
    /* ignore */
  }
}