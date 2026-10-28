/** Shared Lucide defaults for web and extension surfaces.
 * Use 14px for inline hints, 16px for actions, 18px for toolbar entries.
 * Larger illustrations/empty states keep their explicit size.
 * NIcon owns the size of wrapped icons; direct icons use Lucide's size prop.
 * Navigation emoji and third-party brand marks are intentionally independent.
 */
export const APP_ICON_DEFAULTS = {
  size: 16,
  strokeWidth: 1.75,
  nonScalingStroke: true,
  class: 'app-icon',
} as const
