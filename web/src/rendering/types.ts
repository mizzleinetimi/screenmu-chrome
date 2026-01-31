// Canvas rendering types for Phase 1 Core Rendering
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { Effect } from '../types';

// ============================================================================
// Canvas Coordinate Types
// ============================================================================

/**
 * Point in canvas pixel coordinates.
 * Used for positioning elements on the canvas after viewport transformation.
 */
export interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * Rectangle in canvas pixel coordinates.
 * Used for defining crop regions and bounding boxes on the canvas.
 */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Size in pixels.
 * Used for canvas dimensions and video frame sizes.
 */
export interface Size {
  width: number;
  height: number;
}

// ============================================================================
// Animation State Types
// ============================================================================

/**
 * Click ring animation state for rendering expanding ring effects.
 * Contains the effect data and animation parameters for a single click ring.
 *
 * Validates: Requirements 2.4, 3.2
 */
export interface ClickRingAnimationState {
  /** The effect instance containing timestamp, duration, and position */
  effect: Effect;
  /** Starting radius in pixels */
  startRadius: number;
  /** Ending radius in pixels (ring expands to this size) */
  endRadius: number;
  /** Starting opacity (typically 1.0 for full visibility) */
  startOpacity: number;
  /** Ending opacity (typically 0 for fade out) */
  endOpacity: number;
}
