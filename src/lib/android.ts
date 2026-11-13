/** Android-only JSON bridge. Only the packaged, CSP-restricted app page hosts it. */
declare global {
  interface Window {
    LumaNative?: { request: (id: string, command: string, payload: string) => void };
    __lumaResolve?: (id: string, response: { value?: unknown; error?: string }) => void;
  }
}
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
export const isAndroidNative = () => typeof window !== 'undefined' && Boolean(window.LumaNative);
if (typeof window !== 'undefined') window.__lumaResolve = (id, response) => {
  const request = pending.get(id);
  if (!request) return;
  clearTimeout(request.timer); pending.delete(id);
  if (response.error) request.reject(new Error(response.error)); else request.resolve(response.value);
};
export function androidInvoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!isAndroidNative()) return Promise.reject(new Error('Android app bridge unavailable'));
  const id = `r_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Android request timed out. Check your connection and retry.')); }, 90000);
    pending.set(id, { resolve: value => resolve(value as T), reject, timer });
    try { window.LumaNative!.request(id, command, JSON.stringify(args)); }
    catch (err) { clearTimeout(timer); pending.delete(id); reject(err); }
  });
}
export async function onAndroidEvent<T>(name: string, callback: (value: T) => void) {
  const listener = (event: Event) => { callback((event as CustomEvent<T>).detail); };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
