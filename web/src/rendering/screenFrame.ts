// Screen frame rendering utilities for Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { Viewport } from '../types';
import type { CanvasRect, Size } from './types';
import { getSourceRect } from './viewport';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for screen frame rendering.
 * Controls rounded corners, drop shadow, and padding.
 */
export interface ScreenFrameConfig {
  /** Corner radius in pixels (default 12) */
  cornerRadius: number;
  /** Shadow blur radius in pixels (default 32) */
  shadowBlur: number;
  /** Shadow vertical offset in pixels (default 8) */
  shadowOffsetY: number;
  /** Shadow opacity from 0 to 1 (default 0.3) */
  shadowOpacity: number;
  /** Padding as fraction of canvas size (default 0.05 = 5%) */
  padding: number;
  /** Whether shadow is enabled */
  shadowEnabled: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default screen frame configuration.
 *
 * Validates: Requirements 2.1, 2.3, 2.4
 */
export const DEFAULT_SCREEN_FRAME_CONFIG: ScreenFrameConfig = {
  cornerRadius: 12,
  shadowBlur: 32,
  shadowOffsetY: 8,
  shadowOpacity: 0.3,
  padding: 0.05,
  shadowEnabled: true,
};

// ============================================================================
// Inset Calculation
// ============================================================================

/**
 * Calculates the inset rectangle for the screen frame based on padding.
 *
 * Property 2 (Screen Frame Inset):
 * For any padding value P and canvas size (W, H), the screen frame SHALL be positioned at:
 * - x = W * P
 * - y = H * P
 * - width = W * (1 - 2P)
 * - height = H * (1 - 2P)
 *
 * @param padding - Padding as fraction of canvas size (0-1)
 * @param canvasSize - Canvas dimensions in pixels
 * @returns Rectangle defining the inset frame position and size
 *
 * Validates: Requirement 2.4
 */
export function calculateInsetRect(
  padding: number,
  canvasSize: Size
): CanvasRect {
  const { width: W, height: H } = canvasSize;

  // Clamp padding to valid range [0, 0.5) to ensure positive dimensions
  const P = Math.max(0, Math.min(padding, 0.49));

  return {
    x: W * P,
    y: H * P,
    width: W * (1 - 2 * P),
    height: H * (1 - 2 * P),
  };
}

// ============================================================================
// Rounded Rectangle Path
// ============================================================================

/**
 * Creates a rounded rectangle path on the canvas context.
 * Does not stroke or fill - just creates the path for clipping or drawing.
 *
 * @param ctx - Canvas 2D rendering context
 * @param rect - Rectangle bounds
 * @param radius - Corner radius in pixels
 */
function createRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  rect: CanvasRect,
  radius: number
): void {
  const { x, y, width, height } = rect;

  // Clamp radius to half of the smallest dimension
  const maxRadius = Math.min(width / 2, height / 2);
  const r = Math.max(0, Math.min(radius, maxRadius));

  ctx.beginPath();

  if (r === 0) {
    // No rounding, just a rectangle
    ctx.rect(x, y, width, height);
  } else {
    // Draw rounded rectangle using arcs
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
  }

  ctx.closePath();
}

// ============================================================================
// Shadow Rendering
// ============================================================================

/**
 * Renders a drop shadow behind the screen frame.
 *
 * @param ctx - Canvas 2D rendering context
 * @param rect - Rectangle bounds for the shadow
 * @param config - Screen frame configuration
 *
 * Validates: Requirements 2.2, 2.3
 */
function renderDropShadow(
  ctx: CanvasRenderingContext2D,
  rect: CanvasRect,
  config: ScreenFrameConfig
): void {
  if (!config.shadowEnabled) {
    return;
  }

  ctx.save();

  // Set shadow properties
  ctx.shadowColor = `rgba(0, 0, 0, ${config.shadowOpacity})`;
  ctx.shadowBlur = config.shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = config.shadowOffsetY;

  // Create rounded rect path and fill to generate shadow
  createRoundedRectPath(ctx, rect, config.cornerRadius);
  ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Solid fill to cast shadow
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// Main Rendering Function
// ============================================================================

/**
 * Renders the screen frame with rounded corners and drop shadow.
 *
 * This function:
 * 1. Calculates the inset rectangle based on padding
 * 2. Renders a drop shadow behind the frame (if enabled)
 * 3. Clips to a rounded rectangle
 * 4. Draws the video frame within the clipped area
 *
 * The video is cropped according to the viewport and scaled to fit
 * the inset rectangle while maintaining the rounded corners.
 *
 * @param ctx - Canvas 2D rendering context
 * @param videoFrame - Video element to render
 * @param viewport - Current viewport defining visible area and zoom
 * @param config - Screen frame configuration
 * @param canvasSize - Canvas dimensions in pixels
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */
export function renderScreenFrame(
  ctx: CanvasRenderingContext2D,
  videoFrame: HTMLVideoElement,
  viewport: Viewport,
  config: ScreenFrameConfig,
  canvasSize: Size
): void {
  // Skip if canvas has no dimensions
  if (canvasSize.width <= 0 || canvasSize.height <= 0) {
    return;
  }

  // Skip if video has no dimensions (not loaded yet)
  if (videoFrame.videoWidth === 0 || videoFrame.videoHeight === 0) {
    return;
  }

  // Calculate the inset rectangle based on padding
  const insetRect = calculateInsetRect(config.padding, canvasSize);

  // Skip if inset rect has no dimensions (padding too large)
  if (insetRect.width <= 0 || insetRect.height <= 0) {
    return;
  }

  // Get video dimensions
  const videoSize: Size = {
    width: videoFrame.videoWidth,
    height: videoFrame.videoHeight,
  };

  // Calculate source crop rectangle based on viewport
  const sourceRect = getSourceRect(viewport, videoSize);

  // Render drop shadow first (behind the frame)
  renderDropShadow(ctx, insetRect, config);

  // Save context state before clipping
  ctx.save();

  // Create rounded rectangle clip path
  createRoundedRectPath(ctx, insetRect, config.cornerRadius);
  ctx.clip();

  // Draw the video frame within the clipped area
  ctx.drawImage(
    videoFrame,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    insetRect.x,
    insetRect.y,
    insetRect.width,
    insetRect.height
  );

  // Restore context state (removes clipping)
  ctx.restore();
}

/**
 * Creates a ScreenFrameConfig with custom values merged with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete screen frame configuration
 */
export function createScreenFrameConfig(
  overrides: Partial<ScreenFrameConfig> = {}
): ScreenFrameConfig {
  return {
    ...DEFAULT_SCREEN_FRAME_CONFIG,
    ...overrides,
  };
}
