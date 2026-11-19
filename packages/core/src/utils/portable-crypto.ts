import { sha256 } from '@noble/hashes/sha2.js'
import { hmac } from '@noble/hashes/hmac.js'

export const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
export const hashText = (value: string) => hex(sha256(new TextEncoder().encode(value)))
export const signText = (key: Uint8Array, value: string) => hex(hmac(sha256, key, new TextEncoder().encode(value)))
