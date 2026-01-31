// Background rendering utilities for Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { Size } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Gradient preset configuration for background rendering.
 * Defines a linear gradient with color stops and angle.
 */
export interface GradientPreset {
  /** Unique identifier for the preset */
  id: string;
  /** Human-readable name for UI display */
  name: string;
  /** CSS gradient color stops (hex colors) */
  colors: string[];
  /** Gradient angle in degrees (0 = top to bottom, 90 = left to right) */
  angle: number;
}

// ============================================================================
// Gradient Presets
// ============================================================================

/**
 * 9 preset gradient options matching the UI mockup.
 * Each gradient has a unique id, display name, color stops, and angle.
 *
 * Validates: Requirement 1.3
 */
export const GRADIENT_PRESETS: ReadonlyArray<GradientPreset> = [
  {
    id: 'purple-pink',
    name: 'Purple Pink',
    colors: ['#667eea', '#764ba2'],
    angle: 135,
  },
  {
    id: 'pink-red',
    name: 'Pink Red',
    colors: ['#f093fb', '#f5576c'],
    angle: 135,
  },
  {
    id: 'orange-yellow',
    name: 'Orange Yellow',
    colors: ['#f5af19', '#f12711'],
    angle: 135,
  },
  {
    id: 'green-teal',
    name: 'Green Teal',
    colors: ['#11998e', '#38ef7d'],
    angle: 135,
  },
  {
    id: 'blue-cyan',
    name: 'Blue Cyan',
    colors: ['#2193b0', '#6dd5ed'],
    angle: 135,
  },
  {
    id: 'dark-purple',
    name: 'Dark Purple',
    colors: ['#1a1a2e', '#4a148c'],
    angle: 135,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#ff6b6b', '#feca57', '#48dbfb'],
    angle: 135,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0f0c29', '#302b63', '#24243e'],
    angle: 135,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: ['#232526', '#414345'],
    angle: 135,
  },
] as const;

/**
 * Default gradient preset ID (first preset).
 */
export const DEFAULT_GRADIENT_PRESET_ID = GRADIENT_PRESETS[0].id;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Finds a gradient preset by its ID.
 * Falls back to the first preset if the ID is not found.
 *
 * @param id - Gradient preset ID to find
 * @returns The matching gradient preset, or the first preset if not found
 */
export function getGradientPresetById(id: string): GradientPreset {
  const preset = GRADIENT_PRESETS.find((p) => p.id === id);
  // Fall back to first preset if ID not found (as per design doc error handling)
  return preset ?? GRADIENT_PRESETS[0];
}

/**
 * Calculates the start and end points for a linear gradient based on angle.
 * The angle is in degrees where:
 * - 0° = bottom to top
 * - 90° = left to right
 * - 135° = top-left to bottom-right (diagonal)
 * - 180° = top to bottom
 *
 * @param angle - Gradient angle in degrees
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns Object with x0, y0 (start) and x1, y1 (end) coordinates
 */
export function calculateGradientPoints(
  angle: number,
  width: number,
  height: number
): { x0: number; y0: number; x1: number; y1: number } {
  // Convert angle to radians
  // CSS gradient angles: 0deg = to top, 90deg = to right, 180deg = to bottom
  // Canvas gradient: we need to calculate start and end points
  const angleRad = ((angle - 90) * Math.PI) / 180;

  // Calculate the diagonal length to ensure gradient covers entire canvas
  const diagonal = Math.sqrt(width * width + height * height);

  // Center of the canvas
  const centerX = width / 2;
  const centerY = height / 2;

  // Calculate start and end points along the gradient direction
  const dx = (Math.cos(angleRad) * diagonal) / 2;
  const dy = (Math.sin(angleRad) * diagonal) / 2;

  return {
    x0: centerX - dx,
    y0: centerY - dy,
    x1: centerX + dx,
    y1: centerY + dy,
  };
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Renders a gradient background on the canvas.
 *
 * The gradient fills the entire canvas with no gaps or overflow.
 * Supports multi-stop gradients with configurable angle.
 *
 * Property 1 (Background Fills Canvas):
 * For any canvas size and gradient preset, the background layer SHALL
 * completely fill the canvas with no gaps or overflow.
 *
 * @param ctx - Canvas 2D rendering context
 * @param preset - Gradient preset to render
 * @param canvasSize - Canvas dimensions in pixels
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */
export function renderBackground(
  ctx: CanvasRenderingContext2D,
  preset: GradientPreset,
  canvasSize: Size
): void {
  const { width, height } = canvasSize;

  // Skip rendering if canvas has no dimensions
  if (width <= 0 || height <= 0) {
    return;
  }

  // Handle edge case of no colors
  if (preset.colors.length === 0) {
    // Fill with transparent (effectively no background)
    ctx.clearRect(0, 0, width, height);
    return;
  }

  // Handle single color (solid fill)
  if (preset.colors.length === 1) {
    ctx.fillStyle = preset.colors[0];
    ctx.fillRect(0, 0, width, height);
    return;
  }

  // Calculate gradient start and end points based on angle
  const points = calculateGradientPoints(preset.angle, width, height);

  // Create linear gradient
  const gradient = ctx.createLinearGradient(
    points.x0,
    points.y0,
    points.x1,
    points.y1
  );

  // Add color stops evenly distributed
  const stopCount = preset.colors.length;
  preset.colors.forEach((color, index) => {
    const stop = index / (stopCount - 1);
    gradient.addColorStop(stop, color);
  });

  // Fill the entire canvas with the gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Renders a background using a gradient preset ID.
 * Convenience function that looks up the preset by ID before rendering.
 *
 * @param ctx - Canvas 2D rendering context
 * @param presetId - Gradient preset ID
 * @param canvasSize - Canvas dimensions in pixels
 *
 * Validates: Requirements 1.1, 1.2
 */
export function renderBackgroundById(
  ctx: CanvasRenderingContext2D,
  presetId: string,
  canvasSize: Size
): void {
  const preset = getGradientPresetById(presetId);
  renderBackground(ctx, preset, canvasSize);
}
