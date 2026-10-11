const loads = new Map<string, Promise<void>>();

/** Adds a script tag once; later calls share the same load. A failed load can be retried. */
export function loadScript(src: string): Promise<void> {
  const existing = loads.get(src);
  if (existing) return existing;
  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loads.delete(src);
      reject(new Error(`Couldn’t load ${src}`));
    };
    document.head.append(script);
  });
  loads.set(src, load);
  return load;
}
