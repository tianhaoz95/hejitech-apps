// Lightweight type-safe bridge to native Tauri v2 IPC

export async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const w = typeof window !== "undefined" ? (window as any) : {};
  if (w.__TAURI__?.core?.invoke) {
    return w.__TAURI__.core.invoke(cmd, args);
  }
  if (w.__TAURI_INTERNALS__?.invoke) {
    return w.__TAURI_INTERNALS__.invoke(cmd, args);
  }
  throw new Error("Tauri runtime not detected (running in web browser preview mode)");
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(w.__TAURI__ || w.__TAURI_INTERNALS__);
}
