// Viewport transformation utilities for Phase 1 Core Rendering
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { NormalizedCoord, Viewport } from '../types';
import type { CanvasPoint, CanvasRect, Size } from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default viewport representing the full source frame with no zoom.
 * Used as fallback when engine returns invalid viewport.
 */
export const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0.5, y: 0.5 },
  zoom: 1.0,
};

// ============================================================================
// Viewport Transform Functions
// ============================================================================

/**
 * Converts a normalized coordinate (0-1) to canvas pixel position,
 * accounting for the current viewport transform.
 *
 * The viewport defines what portion of the source is visible. A point
 * at the viewport center maps to the canvas center. Points outside
 * the viewport's visible area will map to positions outside the canvas bounds.
 *
 * @param coord - Normalized coordinate in source space (0-1)
 * @param viewport - Current viewport with center and zoom
 * @param canvasSize - Canvas dimensions in pixels
 * @returns Canvas pixel position
 *
 * Validates: Requirements 2.7, 3.7
 */
export function toCanvas(
  coord: NormalizedCoord,
  viewport: Viewport,
  canvasSize: Size
): CanvasPoint {
  // Calculate the visible normalized width/height based on zoom
  // zoom=2 means we see half the width/height
  const visibleWidth = 1.0 / viewport.zoom;
  const visibleHeight = 1.0 / viewport.zoom;

  // Calculate the top-left corner of the visible area in normalized coords
  const visibleLeft = viewport.center.x - visibleWidth / 2;
  const visibleTop = viewport.center.y - visibleHeight / 2;

  // Convert the normalized coord to a position relative to the visible area
  // Then scale to canvas pixels
  const relativeX = (coord.x - visibleLeft) / visibleWidth;
  const relativeY = (coord.y - visibleTop) / visibleHeight;

  return {
    x: relativeX * canvasSize.width,
    y: relativeY * canvasSize.height,
  };
}

/**
 * Calculates the source video crop rectangle for a given viewport.
 *
 * The viewport defines what portion of the source video should be visible.
 * This function returns the pixel rectangle to crop from the source video,
 * with clamping to ensure the rectangle stays within video bounds.
 *
 * Property 1 (Viewport Transform Correctness):
 * For any viewport with center (cx, cy) and zoom z, and source video (sw, sh):
 * - width = sw / z
 * - height = sh / z
 * - x = (cx * sw) - (width / 2), clamped to [0, sw - width]
 * - y = (cy * sh) - (height / 2), clamped to [0, sh - height]
 *
 * @param viewport - Current viewport with center and zoom
 * @param videoSize - Source video dimensions in pixels
 * @returns Rectangle defining the crop region in video pixel coordinates
 *
 * Validates: Requirements 1.2, 1.3, 1.6
 */
export function getSourceRect(viewport: Viewport, videoSize: Size): CanvasRect {
  // Validate and sanitize viewport
  const safeViewport = sanitizeViewport(viewport);

  const { width: sw, height: sh } = videoSize;
  const { center, zoom } = safeViewport;

  // Calculate crop dimensions based on zoom
  // zoom=2 means we show half the video, so crop width = sw / 2
  const cropWidth = sw / zoom;
  const cropHeight = sh / zoom;

  // Calculate initial crop position (centered on viewport center)
  let cropX = center.x * sw - cropWidth / 2;
  let cropY = center.y * sh - cropHeight / 2;

  // Clamp to video bounds to prevent showing areas outside the video
  // x must be in [0, sw - cropWidth]
  // y must be in [0, sh - cropHeight]
  cropX = clamp(cropX, 0, Math.max(0, sw - cropWidth));
  cropY = clamp(cropY, 0, Math.max(0, sh - cropHeight));

  return {
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
  };
}

/**
 * Validates a viewport and returns a sanitized version.
 * Invalid viewports are replaced with the default viewport.
 *
 * A viewport is invalid if:
 * - zoom is <= 0 or NaN
 * - center coordinates are outside [0, 1] or NaN
 *
 * @param viewport - Viewport to validate
 * @returns Sanitized viewport (original if valid, default if invalid)
 */
export function sanitizeViewport(viewport: Viewport): Viewport {
  // Check for invalid zoom
  if (
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom <= 0
  ) {
    return DEFAULT_VIEWPORT;
  }

  // Check for invalid center coordinates
  if (
    !Number.isFinite(viewport.center.x) ||
    !Number.isFinite(viewport.center.y) ||
    viewport.center.x < 0 ||
    viewport.center.x > 1 ||
    viewport.center.y < 0 ||
    viewport.center.y > 1
  ) {
    return DEFAULT_VIEWPORT;
  }

  return viewport;
}

/**
 * Checks if a viewport is the default viewport (no transformation).
 *
 * @param viewport - Viewport to check
 * @returns True if viewport represents no transformation
 *
 * Validates: Requirement 1.6
 */
export function isDefaultViewport(viewport: Viewport): boolean {
  return (
    viewport.zoom === 1.0 &&
    viewport.center.x === 0.5 &&
    viewport.center.y === 0.5
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clamps a value to the specified range.
 *
 * @param value - Value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
