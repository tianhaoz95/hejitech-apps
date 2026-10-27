// Lightweight type-safe bridge to native Tauri v2 IPC and event bus
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}

export async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri()) {
    return invoke<T>(cmd, args);
  }
  throw new Error("Tauri runtime not detected (running in web browser preview mode)");
}

export async function listenTauri<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  if (isTauri()) {
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  }
  return () => {};
}
