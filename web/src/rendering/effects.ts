// Effect rendering utilities for Phase 1 Core Rendering
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { Effect, Viewport } from '../types';
import type { CanvasPoint, ClickRingAnimationState, Size } from './types';
import { toCanvas } from './viewport';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default click ring color (blue with transparency).
 * Matches the design document specification.
 */
export const DEFAULT_CLICK_RING_COLOR = 'rgba(59, 130, 246, 0.6)';

/**
 * Default maximum radius for click ring at 1080p resolution.
 * Scales proportionally for other resolutions.
 */
export const DEFAULT_CLICK_RING_MAX_RADIUS = 40;

/**
 * Default starting radius for click ring animation.
 * Ring expands from this size to max radius.
 */
export const DEFAULT_CLICK_RING_START_RADIUS = 5;

/**
 * Default starting opacity for click ring animation.
 */
export const DEFAULT_CLICK_RING_START_OPACITY = 1.0;

/**
 * Default ending opacity for click ring animation (fully transparent).
 */
export const DEFAULT_CLICK_RING_END_OPACITY = 0.0;

/**
 * Reference height for scaling click ring radius.
 * At 1080p, the max radius is DEFAULT_CLICK_RING_MAX_RADIUS.
 */
const REFERENCE_HEIGHT = 1080;

// ============================================================================
// Effect Filtering Functions
// ============================================================================

/**
 * Filters effects to find those active at a given timestamp.
 *
 * Property 2 (Active Effect Filtering):
 * For any list of effects and any timestamp T, this function SHALL return
 * exactly those effects where:
 * - effect.timestamp <= T AND T < effect.timestamp + effect.duration_us
 *
 * No effects outside this range shall be included, and no matching effects
 * shall be excluded.
 *
 * @param effects - Array of effects to filter
 * @param timestamp - Current timestamp in microseconds
 * @returns Array of effects that are active at the given timestamp
 *
 * Validates: Requirements 2.2, 2.6
 */
export function findActiveEffects(
  effects: ReadonlyArray<Effect>,
  timestamp: number
): Effect[] {
  return effects.filter((effect) => {
    const effectStart = effect.timestamp;
    const effectEnd = effect.timestamp + effect.duration_us;
    // Effect is active when: effectStart <= timestamp < effectEnd
    return effectStart <= timestamp && timestamp < effectEnd;
  });
}

// ============================================================================
// Click Ring Animation Functions
// ============================================================================

/**
 * Calculates the animation state configuration for a click ring effect.
 *
 * This function returns the animation parameters (start/end radius and opacity)
 * that define how the click ring animates. The actual progress-based values
 * are calculated separately using calculateClickRingProgress, calculateClickRingRadius,
 * and calculateClickRingOpacity.
 *
 * Property 3 (Click Ring Animation State):
 * For any click ring effect with duration D, and any timestamp T within the
 * effect's active period, the animation state SHALL have:
 * - progress = (T - effect.timestamp) / D, in range [0, 1]
 * - radius = startRadius + (endRadius - startRadius) * progress
 * - opacity = startOpacity * (1 - progress)
 *
 * @param effect - The click ring effect
 * @param canvasHeight - Canvas height for scaling radius (optional, defaults to 1080)
 * @returns Animation state configuration with start/end radius and opacity
 *
 * Validates: Requirements 2.4, 2.5
 */
export function calculateClickRingState(
  effect: Effect,
  canvasHeight: number = REFERENCE_HEIGHT
): ClickRingAnimationState {
  // Scale radius based on canvas height relative to 1080p reference
  const scaleFactor = canvasHeight / REFERENCE_HEIGHT;
  const startRadius = DEFAULT_CLICK_RING_START_RADIUS * scaleFactor;
  const endRadius = DEFAULT_CLICK_RING_MAX_RADIUS * scaleFactor;

  return {
    effect,
    startRadius,
    endRadius,
    startOpacity: DEFAULT_CLICK_RING_START_OPACITY,
    endOpacity: DEFAULT_CLICK_RING_END_OPACITY,
  };
}

/**
 * Calculates the current progress of a click ring animation.
 *
 * @param effect - The click ring effect
 * @param timestamp - Current timestamp in microseconds
 * @returns Progress value in range [0, 1]
 */
export function calculateClickRingProgress(
  effect: Effect,
  timestamp: number
): number {
  const elapsed = timestamp - effect.timestamp;
  const duration = effect.duration_us;

  // Avoid division by zero
  if (duration <= 0) {
    return 1.0;
  }

  const progress = elapsed / duration;

  // Clamp to [0, 1] range
  return Math.max(0, Math.min(1, progress));
}

/**
 * Calculates the current radius of a click ring based on animation progress.
 *
 * @param state - The click ring animation state
 * @param progress - Animation progress in range [0, 1]
 * @returns Current radius in pixels
 */
export function calculateClickRingRadius(
  state: ClickRingAnimationState,
  progress: number
): number {
  return state.startRadius + (state.endRadius - state.startRadius) * progress;
}

/**
 * Calculates the current opacity of a click ring based on animation progress.
 *
 * @param state - The click ring animation state
 * @param progress - Animation progress in range [0, 1]
 * @returns Current opacity in range [0, 1]
 */
export function calculateClickRingOpacity(
  state: ClickRingAnimationState,
  progress: number
): number {
  return state.startOpacity * (1 - progress);
}

// ============================================================================
// Click Ring Rendering Functions
// ============================================================================

/**
 * Renders a click ring effect on the canvas.
 *
 * The click ring is drawn as an expanding circle that fades out over time.
 * The position is transformed according to the current viewport.
 *
 * @param ctx - Canvas 2D rendering context
 * @param state - Click ring animation state
 * @param viewport - Current viewport for position transformation
 * @param canvasSize - Canvas dimensions in pixels
 * @param timestamp - Current timestamp in microseconds
 * @param color - Ring color (optional, defaults to blue)
 *
 * Validates: Requirements 2.3, 2.4, 2.5, 2.7
 */
export function renderClickRing(
  ctx: CanvasRenderingContext2D,
  state: ClickRingAnimationState,
  viewport: Viewport,
  canvasSize: Size,
  timestamp: number,
  color: string = DEFAULT_CLICK_RING_COLOR
): void {
  // Calculate animation progress
  const progress = calculateClickRingProgress(state.effect, timestamp);

  // Calculate current radius and opacity
  const radius = calculateClickRingRadius(state, progress);
  const opacity = calculateClickRingOpacity(state, progress);

  // Skip rendering if fully transparent
  if (opacity <= 0) {
    return;
  }

  // Transform effect position to canvas coordinates
  const canvasPosition: CanvasPoint = toCanvas(
    state.effect.position,
    viewport,
    canvasSize
  );

  // Save context state
  ctx.save();

  // Set up ring style
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // Draw the ring
  ctx.beginPath();
  ctx.arc(canvasPosition.x, canvasPosition.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Restore context state
  ctx.restore();
}

/**
 * Renders all active click ring effects on the canvas.
 *
 * @param ctx - Canvas 2D rendering context
 * @param effects - Array of active effects to render
 * @param viewport - Current viewport for position transformation
 * @param canvasSize - Canvas dimensions in pixels
 * @param timestamp - Current timestamp in microseconds
 * @param color - Ring color (optional, defaults to blue)
 *
 * Validates: Requirements 2.3, 2.6
 */
export function renderAllClickRings(
  ctx: CanvasRenderingContext2D,
  effects: ReadonlyArray<Effect>,
  viewport: Viewport,
  canvasSize: Size,
  timestamp: number,
  color: string = DEFAULT_CLICK_RING_COLOR
): void {
  for (const effect of effects) {
    // Only render ClickRing effects
    if (effect.effect_type !== 'ClickRing') {
      continue;
    }

    const state = calculateClickRingState(effect, canvasSize.height);
    renderClickRing(ctx, state, viewport, canvasSize, timestamp, color);
  }
}
