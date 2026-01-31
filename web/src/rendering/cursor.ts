// Cursor rendering utilities for Phase 1 Core Rendering
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { CursorState, CursorTrackPoint, NormalizedCoord, Viewport } from '../types';
import type { CanvasPoint, Size } from './types';
import { toCanvas } from './viewport';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cursor scale factor for improved visibility in zoomed views.
 * Matches the design document specification.
 */
export const DEFAULT_CURSOR_SCALE = 1.5;

/**
 * Confidence threshold for full opacity rendering.
 * Inferred cursors with confidence >= this value render at full opacity.
 */
export const CONFIDENCE_THRESHOLD = 70;

/**
 * Default cursor size in pixels (before scaling).
 * Used when rendering the default cursor shape.
 */
export const DEFAULT_CURSOR_SIZE = 24;

// ============================================================================
// Cursor Interpolation Types
// ============================================================================

/**
 * Result of cursor interpolation at a given timestamp.
 * Contains the interpolated position and visibility information.
 */
export interface InterpolatedCursor {
  /** Interpolated position in normalized coordinates */
  position: NormalizedCoord;
  /** Opacity based on cursor state and confidence */
  opacity: number;
  /** Whether the cursor should be rendered */
  visible: boolean;
}

/**
 * Options for cursor rendering.
 */
export interface CursorRenderOptions {
  /** Scale factor for cursor size (default: 1.5) */
  scale: number;
  /** Opacity for cursor rendering (0-1) */
  opacity: number;
  /** Custom cursor sprite image (optional, uses default if not provided) */
  sprite?: ImageBitmap;
}

// ============================================================================
// Cursor Opacity Calculation
// ============================================================================

/**
 * Calculates cursor opacity based on state and confidence.
 *
 * Property 5 (Cursor Opacity Calculation):
 * For any cursor track point with state S and confidence C:
 * - If S is Hidden: opacity = 0
 * - If S is Visible: opacity = 1.0
 * - If S is Inferred and C >= 70: opacity = 1.0
 * - If S is Inferred and C < 70: opacity = C / 100
 *
 * @param state - Cursor visibility state
 * @param confidence - Confidence value (0-100)
 * @returns Opacity value in range [0, 1]
 *
 * Validates: Requirements 3.4, 3.5, 3.6
 */
export function calculateCursorOpacity(
  state: CursorState,
  confidence: number
): number {
  switch (state) {
    case 'Hidden':
      return 0;
    case 'Visible':
      return 1.0;
    case 'Inferred':
      if (confidence >= CONFIDENCE_THRESHOLD) {
        return 1.0;
      }
      return confidence / 100;
    default:
      // Exhaustive check: TypeScript will error if a case is missing
      return assertNever(state);
  }
}

// ============================================================================
// Cursor Position Interpolation
// ============================================================================

/**
 * Interpolates cursor position at a given timestamp from a cursor track.
 *
 * Property 4 (Cursor Position Interpolation):
 * For any cursor track with at least two points, and any timestamp T between
 * the first and last track points, the interpolated position SHALL be:
 * - If T exactly matches a track point, return that point's position
 * - Otherwise, find adjacent points (p1, p2) where p1.timestamp <= T < p2.timestamp
 * - Return linear interpolation: position = p1.position + (p2.position - p1.position)
 *   * ((T - p1.timestamp) / (p2.timestamp - p1.timestamp))
 *
 * Edge cases:
 * - Empty track: returns null (no cursor to render)
 * - Single point: returns that point
 * - Timestamp before first point: returns first point
 * - Timestamp after last point: returns last point
 *
 * @param track - Array of cursor track points (should be sorted by timestamp)
 * @param timestamp - Target timestamp in microseconds
 * @returns Interpolated cursor data, or null if track is empty
 *
 * Validates: Requirements 3.2, 3.3, 3.9
 */
export function interpolateCursor(
  track: ReadonlyArray<CursorTrackPoint>,
  timestamp: number
): InterpolatedCursor | null {
  // Handle empty track
  if (track.length === 0) {
    return null;
  }

  // Handle single point track
  if (track.length === 1) {
    const point = track[0];
    const opacity = calculateCursorOpacity(point.state, point.confidence);
    return {
      position: point.position,
      opacity,
      visible: opacity > 0,
    };
  }

  // Find the appropriate points for interpolation
  const firstPoint = track[0];
  const lastPoint = track[track.length - 1];

  // Handle timestamp before first point
  if (timestamp <= firstPoint.timestamp) {
    const opacity = calculateCursorOpacity(firstPoint.state, firstPoint.confidence);
    return {
      position: firstPoint.position,
      opacity,
      visible: opacity > 0,
    };
  }

  // Handle timestamp after last point
  if (timestamp >= lastPoint.timestamp) {
    const opacity = calculateCursorOpacity(lastPoint.state, lastPoint.confidence);
    return {
      position: lastPoint.position,
      opacity,
      visible: opacity > 0,
    };
  }

  // Find adjacent points for interpolation
  // We need p1 where p1.timestamp <= timestamp < p2.timestamp
  const { p1, p2 } = findAdjacentPoints(track, timestamp);

  // Check for exact match
  if (p1.timestamp === timestamp) {
    const opacity = calculateCursorOpacity(p1.state, p1.confidence);
    return {
      position: p1.position,
      opacity,
      visible: opacity > 0,
    };
  }

  // Linear interpolation between p1 and p2
  const t = (timestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);

  const interpolatedPosition: NormalizedCoord = {
    x: p1.position.x + (p2.position.x - p1.position.x) * t,
    y: p1.position.y + (p2.position.y - p1.position.y) * t,
  };

  // Interpolate opacity based on the closer point's state
  // Use p1's state and confidence for the interpolated frame
  const opacity = calculateCursorOpacity(p1.state, p1.confidence);

  return {
    position: interpolatedPosition,
    opacity,
    visible: opacity > 0,
  };
}

/**
 * Finds the two adjacent points in a track that bracket the given timestamp.
 * Assumes track has at least 2 points and timestamp is within the track's range.
 *
 * @param track - Array of cursor track points (sorted by timestamp)
 * @param timestamp - Target timestamp in microseconds
 * @returns Object containing p1 and p2 where p1.timestamp <= timestamp < p2.timestamp
 */
function findAdjacentPoints(
  track: ReadonlyArray<CursorTrackPoint>,
  timestamp: number
): { p1: CursorTrackPoint; p2: CursorTrackPoint } {
  // Binary search for efficiency with large tracks
  let low = 0;
  let high = track.length - 1;

  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    if (track[mid].timestamp <= timestamp) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return { p1: track[low], p2: track[high] };
}

// ============================================================================
// Cursor Rendering
// ============================================================================

/**
 * Renders a cursor at the specified position on the canvas.
 *
 * The cursor position is transformed according to the current viewport,
 * so the cursor appears at the correct location when zoomed.
 *
 * @param ctx - Canvas 2D rendering context
 * @param position - Cursor position in normalized coordinates
 * @param viewport - Current viewport for position transformation
 * @param canvasSize - Canvas dimensions in pixels
 * @param options - Cursor rendering options (scale, opacity, sprite)
 *
 * Validates: Requirements 3.3, 3.7, 3.8
 */
export function renderCursor(
  ctx: CanvasRenderingContext2D,
  position: NormalizedCoord,
  viewport: Viewport,
  canvasSize: Size,
  options: CursorRenderOptions
): void {
  // Skip rendering if fully transparent
  if (options.opacity <= 0) {
    return;
  }

  // Transform cursor position to canvas coordinates
  const canvasPosition: CanvasPoint = toCanvas(position, viewport, canvasSize);

  // Save context state
  ctx.save();

  // Apply opacity
  ctx.globalAlpha = options.opacity;

  if (options.sprite) {
    // Render custom sprite
    renderCursorSprite(ctx, canvasPosition, options.sprite, options.scale);
  } else {
    // Render default cursor shape
    renderDefaultCursor(ctx, canvasPosition, options.scale);
  }

  // Restore context state
  ctx.restore();
}

/**
 * Renders a cursor sprite image at the specified position.
 *
 * @param ctx - Canvas 2D rendering context
 * @param position - Canvas position in pixels
 * @param sprite - Cursor sprite image
 * @param scale - Scale factor for cursor size
 */
function renderCursorSprite(
  ctx: CanvasRenderingContext2D,
  position: CanvasPoint,
  sprite: ImageBitmap,
  scale: number
): void {
  const width = sprite.width * scale;
  const height = sprite.height * scale;

  // Draw sprite with hotspot at top-left (standard cursor behavior)
  ctx.drawImage(sprite, position.x, position.y, width, height);
}

/**
 * Renders a default arrow cursor shape at the specified position.
 * The cursor is a simple arrow pointer with white fill and dark outline.
 *
 * @param ctx - Canvas 2D rendering context
 * @param position - Canvas position in pixels (cursor hotspot)
 * @param scale - Scale factor for cursor size
 */
function renderDefaultCursor(
  ctx: CanvasRenderingContext2D,
  position: CanvasPoint,
  scale: number
): void {
  const size = DEFAULT_CURSOR_SIZE * scale;

  // Arrow cursor path (relative to hotspot at top-left)
  // Standard arrow pointer shape
  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(position.x, position.y + size * 0.85);
  ctx.lineTo(position.x + size * 0.25, position.y + size * 0.65);
  ctx.lineTo(position.x + size * 0.45, position.y + size);
  ctx.lineTo(position.x + size * 0.55, position.y + size * 0.95);
  ctx.lineTo(position.x + size * 0.35, position.y + size * 0.6);
  ctx.lineTo(position.x + size * 0.6, position.y + size * 0.6);
  ctx.closePath();

  // White fill for visibility on any background
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Dark outline for contrast
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper function for exhaustive type checking.
 * TypeScript will error if this function is reachable with a non-never type.
 */
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
