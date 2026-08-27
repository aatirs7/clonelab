import "server-only";

/**
 * Per-endpoint-class rate limiting.
 *
 * Kalodata publishes different limits per endpoint: rank endpoints allow 10 requests per
 * 10 seconds, detail endpoints 100. A category sweep is one rank call per category and
 * will exceed the rank limit within the first second if left unthrottled.
 *
 * This is a sliding window rather than a fixed one. A fixed window lets 10 calls land at
 * 9.9s and another 10 at 10.1s, which is 20 inside any real 10 second period and is
 * exactly the burst that gets rate limited.
 */
type Bucket = { limit: number; windowMs: number; hits: number[] };

const buckets: Record<"rank" | "detail", Bucket> = {
  rank: { limit: 10, windowMs: 10_000, hits: [] },
  detail: { limit: 100, windowMs: 10_000, hits: [] },
};

export type EndpointClass = keyof typeof buckets;

export function classOf(endpoint: string): EndpointClass {
  return endpoint.endsWith("/rank") ? "rank" : "detail";
}

/** Resolves when it is safe to make one more call of this class. */
export async function acquire(kind: EndpointClass): Promise<void> {
  const bucket = buckets[kind];

  for (;;) {
    const now = Date.now();
    bucket.hits = bucket.hits.filter((t) => now - t < bucket.windowMs);

    if (bucket.hits.length < bucket.limit) {
      bucket.hits.push(now);
      return;
    }

    // Wait exactly until the oldest hit leaves the window, plus a small margin so a
    // clock difference between us and their edge does not put us one call over.
    const oldest = Math.min(...bucket.hits);
    await new Promise((resolve) => setTimeout(resolve, bucket.windowMs - (now - oldest) + 50));
  }
}
