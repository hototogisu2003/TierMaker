export type ExportImageSource = { url: string; label: string };
export type ExportImageFailure = { url: string; labels: string[] };

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image data"));
    reader.readAsDataURL(blob);
  });
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then((value) => {
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

async function fetchImage(url: string, signal: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    signal.throwIfAborted();
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error("Image request timed out")), 10000);
    try {
      let dataUrl = url;
      if (!url.startsWith("data:")) {
        const response = await fetch(url, { signal: controller.signal, cache: attempt ? "reload" : "default" });
        if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
        dataUrl = await abortable(readDataUrl(await response.blob()), controller.signal);
      }
      const image = new Image();
      image.src = dataUrl;
      await abortable(image.decode(), controller.signal);
      controller.signal.throwIfAborted();
      return dataUrl;
    } catch (error) {
      signal.throwIfAborted();
      if (attempt === 2) throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
    await wait(400 * 2 ** attempt, signal);
  }
  throw new Error("Image request failed");
}

// Fetch each distinct URL once (apart from retries), with at most four requests in flight.
// Only successfully decoded images are cached; failures can be retried on the next preview.
export async function loadExportImages(
  sources: ExportImageSource[],
  cache: Map<string, string>,
  signal: AbortSignal,
  onProgress: (completed: number, total: number) => void,
): Promise<{ images: Map<string, string>; failures: ExportImageFailure[] }> {
  const labelsByUrl = new Map<string, Set<string>>();
  for (const { url, label } of sources) {
    if (!url) continue;
    if (!labelsByUrl.has(url)) labelsByUrl.set(url, new Set());
    labelsByUrl.get(url)!.add(label);
  }
  const urls = [...labelsByUrl.keys()];
  const images = new Map<string, string>();
  const failedUrls = new Set<string>();
  let next = 0;
  let completed = 0;
  onProgress(0, urls.length);
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, async () => {
    while (next < urls.length) {
      signal.throwIfAborted();
      const url = urls[next++];
      try {
        const dataUrl = cache.get(url) ?? await fetchImage(url, signal);
        signal.throwIfAborted();
        cache.set(url, dataUrl);
        images.set(url, dataUrl);
      } catch {
        signal.throwIfAborted();
        failedUrls.add(url);
      }
      onProgress(++completed, urls.length);
    }
  }));
  signal.throwIfAborted();
  return { images, failures: urls.filter((url) => failedUrls.has(url)).map((url) => ({ url, labels: [...labelsByUrl.get(url)!] })) };
}
