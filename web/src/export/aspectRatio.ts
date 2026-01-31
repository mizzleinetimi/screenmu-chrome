// Aspect ratio handling for export pipeline
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import type { Size } from './resolutions';

/**
 * Aspect ratio handling mode
 * - letterbox: Add black bars to preserve full source content
 * - crop: Center crop to fill target, may lose content at edges
 */
export type AspectRatioMode = 'letterbox' | 'crop';

/**
 * Rectangle defining position and size within a canvas
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Result of aspect ratio calculation
 * - sourceRect: Region of source to sample from
 * - destRect: Region of destination to draw to
 */
export interface AspectRatioResult {
  sourceRect: Rect;
  destRect: Rect;
}

/**
 * Calculate source and destination rectangles for aspect ratio handling
 *
 * @param sourceSize - Original video dimensions
 * @param targetSize - Target output dimensions
 * @param mode - How to handle aspect ratio mismatch
 * @returns Source and destination rectangles for drawing
 */
export function calculateAspectRatio(
  sourceSize: Size,
  targetSize: Size,
  mode: AspectRatioMode
): AspectRatioResult {
  const sourceAspect = sourceSize.width / sourceSize.height;
  const targetAspect = targetSize.width / targetSize.height;

  if (mode === 'letterbox') {
    return calculateLetterbox(sourceSize, targetSize, sourceAspect, targetAspect);
  } else {
    return calculateCrop(sourceSize, targetSize, sourceAspect, targetAspect);
  }
}

/**
 * Letterbox mode: Scale source to fit within target, add black bars
 */
function calculateLetterbox(
  sourceSize: Size,
  targetSize: Size,
  sourceAspect: number,
  targetAspect: number
): AspectRatioResult {
  // Source rect is always the full source
  const sourceRect: Rect = {
    x: 0,
    y: 0,
    width: sourceSize.width,
    height: sourceSize.height,
  };

  let destWidth: number;
  let destHeight: number;

  if (sourceAspect > targetAspect) {
    // Source is wider than target: fit to width, add bars top/bottom
    destWidth = targetSize.width;
    destHeight = Math.round(targetSize.width / sourceAspect);
  } else {
    // Source is taller than target: fit to height, add bars left/right
    destHeight = targetSize.height;
    destWidth = Math.round(targetSize.height * sourceAspect);
  }

  // Center the destination rectangle
  const destRect: Rect = {
    x: Math.round((targetSize.width - destWidth) / 2),
    y: Math.round((targetSize.height - destHeight) / 2),
    width: destWidth,
    height: destHeight,
  };

  return { sourceRect, destRect };
}

/**
 * Crop mode: Scale source to fill target, crop edges
 */
function calculateCrop(
  sourceSize: Size,
  targetSize: Size,
  sourceAspect: number,
  targetAspect: number
): AspectRatioResult {
  // Destination rect is always the full target
  const destRect: Rect = {
    x: 0,
    y: 0,
    width: targetSize.width,
    height: targetSize.height,
  };

  let srcWidth: number;
  let srcHeight: number;

  if (sourceAspect > targetAspect) {
    // Source is wider: crop left/right
    srcHeight = sourceSize.height;
    srcWidth = Math.round(sourceSize.height * targetAspect);
  } else {
    // Source is taller: crop top/bottom
    srcWidth = sourceSize.width;
    srcHeight = Math.round(sourceSize.width / targetAspect);
  }

  // Center the source rectangle (crop from center)
  const sourceRect: Rect = {
    x: Math.round((sourceSize.width - srcWidth) / 2),
    y: Math.round((sourceSize.height - srcHeight) / 2),
    width: srcWidth,
    height: srcHeight,
  };

  return { sourceRect, destRect };
}
