import type { XmlNodeModel, XmlRendererParseResult } from '../types/xml-renderer'

const XML_CODE_FENCE_RE = /^```(?:xml)?\s*([\s\S]*?)```$/iu

const ELEMENT_NODE = 1
const TEXT_NODE = 3
const CDATA_SECTION_NODE = 4
const PROCESSING_INSTRUCTION_NODE = 7
const COMMENT_NODE = 8
export function fitsXmlRenderBudget(content: string): boolean {
  if (content.length > 16384 || (content.match(/</g)?.length ?? 0) > 256 || /<!DOCTYPE|<!ENTITY/iu.test(content)) return false
  let depth = 0
  for (const tag of content.match(/<[^>]+>/g) ?? []) {
    if (tag.startsWith('</')) depth = Math.max(0, depth - 1)
    else if (!tag.startsWith('<?') && !tag.startsWith('<!') && !tag.endsWith('/>') && ++depth > 32) return false
  }
  return true
}

function normalizeTextNodeContent(raw: string): string {
  return raw.replace(/\s+/gu, ' ').trim()
}

function parseXmlNode(node: Node): XmlNodeModel | null {
  switch (node.nodeType) {
    case ELEMENT_NODE: {
      const element = node as Element
      const attributes = Array.from(element.attributes).map((attribute) => ({
        name: attribute.name,
        value: attribute.value,
      }))

      const children = Array.from(element.childNodes)
        .map(parseXmlNode)
        .filter((child): child is XmlNodeModel => child !== null)

      return {
        kind: 'element',
        name: element.tagName,
        attributes,
        children,
      }
    }

    case TEXT_NODE: {
      const value = normalizeTextNodeContent(node.textContent || '')
      if (!value) return null
      return {
        kind: 'text',
        value,
      }
    }

    case COMMENT_NODE: {
      const value = (node.textContent || '').trim()
      if (!value) return null
      return {
        kind: 'comment',
        value,
      }
    }

    case CDATA_SECTION_NODE: {
      const value = (node.textContent || '').trim()
      if (!value) return null
      return {
        kind: 'cdata',
        value,
      }
    }

    case PROCESSING_INSTRUCTION_NODE: {
      const instruction = node as ProcessingInstruction
      const value = (instruction.data || '').trim()
      return {
        kind: 'processing',
        name: instruction.target,
        value,
      }
    }

    default:
      return null
  }
}

export function extractXmlCandidate(content: string): string {
  const trimmed = String(content || '').trim()
  if (!trimmed) return ''

  const fencedMatch = trimmed.match(XML_CODE_FENCE_RE)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  return trimmed
}

export function isValidXmlContent(content: string): boolean {
  if (!fitsXmlRenderBudget(content)) return false
  const source = extractXmlCandidate(content)
  if (!source) return false
  if (!source.startsWith('<') || !source.endsWith('>')) return false
  if (!source.includes('</') && !source.includes('/>') && !source.includes('?>')) {
    return false
  }
  if (typeof DOMParser === 'undefined') return false

  const xmlDoc = new DOMParser().parseFromString(source, 'application/xml')
  return !xmlDoc.querySelector('parsererror') && Boolean(xmlDoc.documentElement)
}

export function parseXmlContent(content: string): XmlRendererParseResult {
  if (!fitsXmlRenderBudget(content)) return { source: content, rootNodes: [], error: 'XML display budget exceeded' }
  const source = extractXmlCandidate(content)
  if (!source) {
    return {
      source: '',
      rootNodes: [],
      error: null,
    }
  }

  if (typeof DOMParser === 'undefined') {
    return {
      source,
      rootNodes: [],
      error: 'DOMParser is not available in current runtime.',
    }
  }

  const xmlDoc = new DOMParser().parseFromString(source, 'application/xml')
  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    return {
      source,
      rootNodes: [],
      error: parserError.textContent?.trim() || 'Invalid XML content.',
    }
  }

  const rootNodes = Array.from(xmlDoc.childNodes)
    .map(parseXmlNode)
    .filter((node): node is XmlNodeModel => node !== null)

  return {
    source,
    rootNodes,
    error: null,
  }
}
