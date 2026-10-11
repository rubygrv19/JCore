export function startPolling(task: (signal: AbortSignal) => Promise<unknown>, intervalMs = 10_000, immediate = true): () => void {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  async function tick() {
    try {
      await task(controller.signal)
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => {
        void tick().catch(() => undefined)
      }, intervalMs)
    }
  }
  if (immediate) void tick().catch(() => undefined)
  else timer = setTimeout(() => {
    void tick().catch(() => undefined)
  }, intervalMs)
  return () => {
    controller.abort()
    clearTimeout(timer)
  }
}
