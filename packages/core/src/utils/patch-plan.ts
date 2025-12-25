import type { PatchOperation } from '../services/evaluation/types'

export type ApplyPatchStatus = 'applied' | 'skipped' | 'conflict'

export interface ApplyPatchReportItem {
  op: PatchOperation['op']
  status: ApplyPatchStatus
  reason?: string
}

export interface ApplyPatchResult {
  ok: boolean
  text: string
  report: ApplyPatchReportItem
}

/**
 * 查找文本中第 N 次出现的位置
 * @param haystack 被搜索的文本
 * @param needle 要查找的文本
 * @param occurrence 第几次出现（从 1 开始）
 * @returns 找到的索引，未找到返回 -1
 */
function findNthOccurrence(
  haystack: string,
  needle: string,
  occurrence: number,
): number {
  if (!needle) return -1

  let fromIndex = 0
  for (let i = 1; i <= occurrence; i++) {
    const idx = haystack.indexOf(needle, fromIndex)
    if (idx === -1) return -1
    if (i === occurrence) return idx
    fromIndex = idx + 1
  }
  return -1
}

/**
 * 统计文本在源字符串中出现的次数
 */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let pos = 0
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++
    pos += 1
  }
  return count
}

/**
 * 应用单个补丁操作到文本
 *
 * 简化的 apply 逻辑：
 * - 找到 oldText 在文本中的位置
 * - 用 newText 替换
 *
 * @param input 原始文本
 * @param operation 单个补丁操作
 * @returns 应用结果
 */
export function applyPatchOperationsToText(
  input: string,
  operation: PatchOperation,
): ApplyPatchResult {
  const { oldText, newText, occurrence = 1, op } = operation

  if (!oldText) {
    return {
      ok: false,
      text: input,
      report: { op, status: 'skipped', reason: 'Missing oldText' },
    }
  }

  const occurrenceCount = countOccurrences(input, oldText)
  if (occurrenceCount === 0) {
    return {
      ok: false,
      text: input,
      report: { op, status: 'skipped', reason: 'oldText not found in current text' },
    }
  }

  if (occurrenceCount > 1 && occurrence > occurrenceCount) {
    return {
      ok: false,
      text: input,
      report: {
        op,
        status: 'skipped',
        reason: `oldText appears ${occurrenceCount} times, but occurrence=${occurrence} is out of range`,
      },
    }
  }

  const targetIndex = findNthOccurrence(input, oldText, occurrence)
  if (targetIndex === -1) {
    return {
      ok: false,
      text: input,
      report: { op, status: 'skipped', reason: 'Failed to locate oldText' },
    }
  }

  const text = input.slice(0, targetIndex) + (newText ?? '') + input.slice(targetIndex + oldText.length)

  return {
    text,
    ok: true,
    report: { op, status: 'applied' },
  }
}
