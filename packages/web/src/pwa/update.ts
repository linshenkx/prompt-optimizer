export type UpdatePreparation = 'ready' | 'busy' | 'save-failed'
export type UpdateOutcome = UpdatePreparation | 'other-tabs' | 'unavailable' | 'failed'
export type PrepareForUpdate = () => Promise<UpdatePreparation>

/** Public UI adapter; the web shell must never read the workspace's internal stores. */
export interface WorkspaceUpdateHost {
  prepareForUpdate(): Promise<UpdatePreparation>
}

export async function prepareUpdate(prepare: PrepareForUpdate | undefined, timeoutMs = 15000): Promise<UpdatePreparation> {
  if (!prepare) return 'save-failed'
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      prepare(),
      new Promise<UpdatePreparation>(resolve => { timer = setTimeout(() => resolve('save-failed'), timeoutMs) }),
    ])
  } catch { return 'save-failed' }
  finally { if (timer) clearTimeout(timer) }
}

export function requestWorkerUpdate(worker: ServiceWorker, timeoutMs = 5000): Promise<UpdateOutcome> {
  return new Promise(resolve => {
    const channel = new MessageChannel()
    const finish = (outcome: UpdateOutcome) => {
      clearTimeout(timeout)
      channel.port1.close()
      resolve(outcome)
    }
    const timeout = setTimeout(() => finish('failed'), timeoutMs)
    channel.port1.onmessage = event => {
      finish(event.data?.accepted === true ? 'ready' : event.data?.reason === 'other-tabs' ? 'other-tabs' : 'failed')
    }
    try { worker.postMessage({ type: 'PROMPT_OPTIMIZER_APPLY_UPDATE' }, [channel.port2]) }
    catch { finish('failed') }
  })
}
