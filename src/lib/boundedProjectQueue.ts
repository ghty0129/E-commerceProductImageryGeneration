export type QueueResult<T, R> =
  | { item: T; status: 'fulfilled'; value: R }
  | { item: T; status: 'rejected'; error: string }

export async function runBoundedProjectQueue<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency = 2): Promise<QueueResult<T, R>[]> {
  const limit = Math.max(1, Math.min(items.length || 1, Math.trunc(concurrency) || 1))
  const results = new Array<QueueResult<T, R>>(items.length)
  let nextIndex = 0
  async function runner() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index]
      try { results[index] = { item, status: 'fulfilled', value: await worker(item) } }
      catch (error) { results[index] = { item, status: 'rejected', error: error instanceof Error ? error.message : String(error) } }
    }
  }
  await Promise.all(Array.from({ length: limit }, () => runner()))
  return results
}
