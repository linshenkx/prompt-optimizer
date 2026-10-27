// Documents receive every token. This bounded, shared queue schedules only the
// visible projections, so adding columns cannot multiply animation-frame work.
const pending = new Map<object, () => void>()
let timer: ReturnType<typeof setTimeout> | undefined
let frame: number | undefined
const request = () => {
  if (timer !== undefined || frame !== undefined || !pending.size) return
  timer = setTimeout(() => {
    timer = undefined
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (document.visibilityState === 'hidden') return
      const start = performance.now()
      let count = 0
      while (pending.size && count < 2 && performance.now() - start < 4) {
        const [owner, project] = pending.entries().next().value!
        pending.delete(owner)
        project()
        count++
      }
      request()
    })
  }, 32)
}
export function scheduleOutputView(owner: object, project: () => void) {
  pending.set(owner, project)
  request()
}
export function cancelOutputView(owner: object) {
  pending.delete(owner)
  if (!pending.size) {
    if (timer !== undefined) clearTimeout(timer)
    if (frame !== undefined) cancelAnimationFrame(frame)
    timer = frame = undefined
  }
}
