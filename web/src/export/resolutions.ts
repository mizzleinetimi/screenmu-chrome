// Resolution presets for export pipeline
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

/**
 * Size dimensions in pixels
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Named resolution preset identifiers
 */
export type PresetName = '1080p' | '4k' | 'vertical' | 'square';

/**
 * Resolution preset - either a named preset or native (source) resolution
 */
export type ResolutionPreset =
  | { type: 'preset'; name: PresetName }
  | { type: 'native' };

/**
 * Dimension constants for each named preset
 * - 1080p: Standard HD (16:9)
 * - 4k: Ultra HD (16:9)
 * - vertical: Mobile/TikTok format (9:16)
 * - square: Instagram/Twitter square (1:1)
 */
export const RESOLUTION_DIMENSIONS: Record<PresetName, Size> = {
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
  'vertical': { width: 1080, height: 1920 },
  'square': { width: 1080, height: 1080 },
};

/**
 * Human-readable labels for UI display
 */
export const PRESET_LABELS: Record<PresetName, string> = {
  '1080p': '1080p (1920×1080)',
  '4k': '4K (3840×2160)',
  'vertical': 'Vertical (1080×1920)',
  'square': 'Square (1080×1080)',
};

/**
 * Get the target dimensions for a resolution preset
 * @param preset - The resolution preset
 * @param sourceSize - The source video dimensions (used for native preset)
 * @returns The target dimensions
 */
export function getTargetDimensions(preset: ResolutionPreset, sourceSize: Size): Size {
  if (preset.type === 'native') {
    return { width: sourceSize.width, height: sourceSize.height };
  }
  return RESOLUTION_DIMENSIONS[preset.name];
}

/**
 * Calculate the aspect ratio of a size
 */
export function getAspectRatio(size: Size): number {
  return size.width / size.height;
}

/**
 * List of all available preset names for iteration
 */
export const ALL_PRESETS: PresetName[] = ['1080p', '4k', 'vertical', 'square'];
