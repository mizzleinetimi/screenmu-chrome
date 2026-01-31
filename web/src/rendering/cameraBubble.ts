// Camera bubble rendering utilities for Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { NormalizedCoord } from '../types';
import type { Size } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Camera bubble shape options.
 *
 * Validates: Requirement 4.4
 */
export type CameraBubbleShape = 'circle' | 'rounded-rect';

/**
 * Configuration for camera bubble rendering.
 * Controls position, size, shape, border, and shadow.
 */
export interface CameraBubbleConfig {
  /** Center position as normalized coordinates (0-1) */
  position: NormalizedCoord;
  /** Diameter/width as fraction of canvas (0.1-0.4) */
  size: number;
  /** Shape of the camera bubble */
  shape: CameraBubbleShape;
  /** Border width in pixels */
  borderWidth: number;
  /** Border color as CSS color string */
  borderColor: string;
  /** Whether drop shadow is enabled */
  shadowEnabled: boolean;
  /** Background blur radius (0 = disabled, 1-20 = blur radius) */
  backgroundBlur: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default camera bubble configuration.
 *
 * Validates: Requirements 4.4, 4.6, 4.7
 */
export const DEFAULT_CAMERA_BUBBLE_CONFIG: CameraBubbleConfig = {
  position: { x: 0.9, y: 0.85 },
  size: 0.2,
  shape: 'circle',
  borderWidth: 3,
  borderColor: '#ffffff',
  shadowEnabled: true,
  backgroundBlur: 0,
};

// ============================================================================
// Size Constraints
// ============================================================================

/** Minimum camera bubble size as fraction of canvas */
export const MIN_CAMERA_BUBBLE_SIZE = 0.1;

/** Maximum camera bubble size as fraction of canvas */
export const MAX_CAMERA_BUBBLE_SIZE = 0.4;

// ============================================================================
// Shadow Configuration (matches screen frame style)
// ============================================================================

/** Shadow blur radius in pixels (matches screen frame) */
const SHADOW_BLUR = 16;

/** Shadow vertical offset in pixels */
const SHADOW_OFFSET_Y = 4;

/** Shadow opacity (matches screen frame style) */
const SHADOW_OPACITY = 0.3;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clamps a value between min and max bounds.
 *
 * @param value - Value to clamp
 * @param min - Minimum bound
 * @param max - Maximum bound
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps the camera bubble size to valid range.
 *
 * @param size - Size as fraction of canvas
 * @returns Clamped size within [0.1, 0.4]
 */
export function clampCameraBubbleSize(size: number): number {
  return clamp(size, MIN_CAMERA_BUBBLE_SIZE, MAX_CAMERA_BUBBLE_SIZE);
}

/**
 * Calculates the pixel dimensions and position of the camera bubble.
 *
 * Property 3 (Camera Bubble Bounds):
 * For any camera bubble position (cx, cy) and size S, the bubble SHALL be
 * clamped to remain fully within canvas bounds.
 *
 * @param config - Camera bubble configuration
 * @param canvasSize - Canvas dimensions in pixels
 * @returns Object with x, y, width, height in pixels
 *
 * Validates: Requirements 4.1, 4.2
 */
export function calculateCameraBubbleBounds(
  config: CameraBubbleConfig,
  canvasSize: Size
): { x: number; y: number; width: number; height: number } {
  const { width: canvasWidth, height: canvasHeight } = canvasSize;

  // Clamp size to valid range
  const clampedSize = clampCameraBubbleSize(config.size);

  // Calculate pixel dimensions (use smaller canvas dimension for consistent sizing)
  const minDimension = Math.min(canvasWidth, canvasHeight);
  const bubbleWidth = minDimension * clampedSize;
  const bubbleHeight = config.shape === 'circle' ? bubbleWidth : bubbleWidth * 0.75;

  // Calculate center position in pixels
  const centerX = config.position.x * canvasWidth;
  const centerY = config.position.y * canvasHeight;

  // Calculate top-left position
  let x = centerX - bubbleWidth / 2;
  let y = centerY - bubbleHeight / 2;

  // Clamp position to keep bubble within canvas bounds
  x = clamp(x, 0, canvasWidth - bubbleWidth);
  y = clamp(y, 0, canvasHeight - bubbleHeight);

  return { x, y, width: bubbleWidth, height: bubbleHeight };
}

// ============================================================================
// Path Creation Functions
// ============================================================================

/**
 * Creates a circle path on the canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param centerX - Center X coordinate
 * @param centerY - Center Y coordinate
 * @param radius - Circle radius
 */
function createCirclePath(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
}

/**
 * Creates a rounded rectangle path on the canvas context.
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - Top-left X coordinate
 * @param y - Top-left Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param radius - Corner radius
 */
function createRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  // Clamp radius to half of the smallest dimension
  const maxRadius = Math.min(width / 2, height / 2);
  const r = Math.max(0, Math.min(radius, maxRadius));

  ctx.beginPath();

  if (r === 0) {
    ctx.rect(x, y, width, height);
  } else {
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

/**
 * Creates the appropriate shape path based on configuration.
 *
 * @param ctx - Canvas 2D rendering context
 * @param bounds - Bubble bounds (x, y, width, height)
 * @param shape - Shape type ('circle' or 'rounded-rect')
 *
 * Validates: Requirement 4.4
 */
function createBubbleShapePath(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  shape: CameraBubbleShape
): void {
  const { x, y, width, height } = bounds;

  if (shape === 'circle') {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) / 2;
    createCirclePath(ctx, centerX, centerY, radius);
  } else {
    // rounded-rect with corner radius of 20% of smaller dimension
    const cornerRadius = Math.min(width, height) * 0.2;
    createRoundedRectPath(ctx, x, y, width, height, cornerRadius);
  }
}

// ============================================================================
// Shadow Rendering
// ============================================================================

/**
 * Renders a drop shadow behind the camera bubble.
 *
 * @param ctx - Canvas 2D rendering context
 * @param bounds - Bubble bounds
 * @param shape - Shape type
 *
 * Validates: Requirement 4.7
 */
function renderCameraBubbleShadow(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  shape: CameraBubbleShape
): void {
  ctx.save();

  // Set shadow properties (matching screen frame style)
  ctx.shadowColor = `rgba(0, 0, 0, ${SHADOW_OPACITY})`;
  ctx.shadowBlur = SHADOW_BLUR;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = SHADOW_OFFSET_Y;

  // Create shape path and fill to generate shadow
  createBubbleShapePath(ctx, bounds, shape);
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// Border Rendering
// ============================================================================

/**
 * Renders the border around the camera bubble.
 *
 * @param ctx - Canvas 2D rendering context
 * @param bounds - Bubble bounds
 * @param shape - Shape type
 * @param borderWidth - Border width in pixels
 * @param borderColor - Border color as CSS string
 *
 * Validates: Requirement 4.6
 */
function renderCameraBubbleBorder(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  shape: CameraBubbleShape,
  borderWidth: number,
  borderColor: string
): void {
  if (borderWidth <= 0) {
    return;
  }

  ctx.save();

  createBubbleShapePath(ctx, bounds, shape);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// Background Blur Rendering
// ============================================================================

/**
 * Minimum blur radius to apply (values below this are treated as disabled).
 */
const MIN_BLUR_RADIUS = 1;

/**
 * Maximum blur radius to apply.
 */
const MAX_BLUR_RADIUS = 20;

/** Exported minimum blur radius for UI validation */
export const MIN_BACKGROUND_BLUR = MIN_BLUR_RADIUS;

/** Exported maximum blur radius for UI validation */
export const MAX_BACKGROUND_BLUR = MAX_BLUR_RADIUS;

/**
 * Clamps the blur radius to valid range.
 *
 * @param blur - Blur radius value
 * @returns Clamped blur radius (0 if disabled, 1-20 if enabled)
 */
export function clampBackgroundBlur(blur: number): number {
  if (blur < MIN_BLUR_RADIUS) {
    return 0; // Disabled
  }
  return Math.min(blur, MAX_BLUR_RADIUS);
}

/**
 * Checks if background blur is supported in the current environment.
 *
 * Background blur requires OffscreenCanvas support.
 *
 * @returns true if background blur is supported
 */
export function isBackgroundBlurSupported(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

/**
 * Applies blur filter to a video frame using OffscreenCanvas.
 *
 * This function creates an OffscreenCanvas, draws the video frame with a blur
 * filter applied, and returns the blurred canvas for use in rendering.
 *
 * Note: This applies a uniform blur to the entire camera feed (soft focus effect).
 * True background blur would require ML-based segmentation which is more complex.
 *
 * @param cameraVideo - Camera video element
 * @param blurRadius - Blur radius in pixels (1-20)
 * @param targetWidth - Target width for the blurred output
 * @param targetHeight - Target height for the blurred output
 * @returns OffscreenCanvas with blurred video, or null if blur cannot be applied
 *
 * Validates: Requirements 5.1, 5.2
 */
function createBlurredVideoCanvas(
  cameraVideo: HTMLVideoElement,
  blurRadius: number,
  targetWidth: number,
  targetHeight: number
): OffscreenCanvas | null {
  // Skip if video has no dimensions
  if (cameraVideo.videoWidth === 0 || cameraVideo.videoHeight === 0) {
    return null;
  }

  // Skip if target dimensions are invalid
  if (targetWidth <= 0 || targetHeight <= 0) {
    return null;
  }

  // Check if OffscreenCanvas is supported
  if (typeof OffscreenCanvas === 'undefined') {
    console.warn('[CameraBubble] OffscreenCanvas not supported, blur disabled');
    return null;
  }

  try {
    // Create OffscreenCanvas for blur processing
    const offscreen = new OffscreenCanvas(
      Math.ceil(targetWidth),
      Math.ceil(targetHeight)
    );
    const offCtx = offscreen.getContext('2d');

    if (offCtx === null) {
      return null;
    }

    // Apply blur filter
    offCtx.filter = `blur(${blurRadius}px)`;

    // Calculate source crop to maintain aspect ratio (center crop)
    const videoWidth = cameraVideo.videoWidth;
    const videoHeight = cameraVideo.videoHeight;
    const videoAspect = videoWidth / videoHeight;
    const targetAspect = targetWidth / targetHeight;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = videoWidth;
    let sourceHeight = videoHeight;

    if (videoAspect > targetAspect) {
      // Video is wider - crop sides
      sourceWidth = videoHeight * targetAspect;
      sourceX = (videoWidth - sourceWidth) / 2;
    } else {
      // Video is taller - crop top/bottom
      sourceHeight = videoWidth / targetAspect;
      sourceY = (videoHeight - sourceHeight) / 2;
    }

    // Draw video with blur filter applied
    // Extend drawing area to avoid blur edge artifacts
    const blurPadding = blurRadius * 2;
    offCtx.drawImage(
      cameraVideo,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -blurPadding,
      -blurPadding,
      targetWidth + blurPadding * 2,
      targetHeight + blurPadding * 2
    );

    // Reset filter for any subsequent operations
    offCtx.filter = 'none';

    return offscreen;
  } catch (error) {
    console.warn('[CameraBubble] Error creating blurred canvas:', error);
    return null;
  }
}

// ============================================================================
// Video Rendering
// ============================================================================

/**
 * Renders the camera video within the bubble shape.
 *
 * @param ctx - Canvas 2D rendering context
 * @param cameraVideo - Camera video element
 * @param bounds - Bubble bounds
 * @param shape - Shape type
 * @param backgroundBlur - Background blur radius (0 = disabled, 1-20 = blur radius)
 *
 * Validates: Requirements 5.1, 5.2
 */
function renderCameraVideo(
  ctx: CanvasRenderingContext2D,
  cameraVideo: HTMLVideoElement,
  bounds: { x: number; y: number; width: number; height: number },
  shape: CameraBubbleShape,
  backgroundBlur: number = 0
): void {
  const { x, y, width, height } = bounds;
  const videoWidth = cameraVideo.videoWidth;
  const videoHeight = cameraVideo.videoHeight;

  // Skip if video has no dimensions
  if (videoWidth === 0 || videoHeight === 0) {
    return;
  }

  ctx.save();

  // Create clip path for the bubble shape
  createBubbleShapePath(ctx, bounds, shape);
  ctx.clip();

  // Clamp blur radius to valid range
  const clampedBlur = clampBackgroundBlur(backgroundBlur);

  // If blur is enabled, use OffscreenCanvas approach
  if (clampedBlur > 0) {
    const blurredCanvas = createBlurredVideoCanvas(
      cameraVideo,
      clampedBlur,
      width,
      height
    );

    if (blurredCanvas !== null) {
      // Draw the blurred canvas
      ctx.drawImage(blurredCanvas, x, y, width, height);
      ctx.restore();
      return;
    }
    // Fall through to non-blurred rendering if blur failed
  }

  // Calculate source crop to maintain aspect ratio (center crop)
  const videoAspect = videoWidth / videoHeight;
  const bubbleAspect = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;

  if (videoAspect > bubbleAspect) {
    // Video is wider - crop sides
    sourceWidth = videoHeight * bubbleAspect;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    // Video is taller - crop top/bottom
    sourceHeight = videoWidth / bubbleAspect;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  // Draw the video within the clipped area
  ctx.drawImage(
    cameraVideo,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  );

  ctx.restore();
}

// ============================================================================
// Main Rendering Function
// ============================================================================

/**
 * Renders the camera bubble with shape, border, and shadow.
 *
 * This function:
 * 1. Calculates the bubble bounds based on position and size
 * 2. Renders a drop shadow behind the bubble (if enabled)
 * 3. Clips to the bubble shape (circle or rounded-rect)
 * 4. Draws the camera video within the clipped area
 * 5. Renders the border around the bubble
 *
 * @param ctx - Canvas 2D rendering context
 * @param cameraVideo - Camera video element to render
 * @param config - Camera bubble configuration
 * @param canvasSize - Canvas dimensions in pixels
 *
 * Validates: Requirements 4.4, 4.6, 4.7
 */
export function renderCameraBubble(
  ctx: CanvasRenderingContext2D,
  cameraVideo: HTMLVideoElement,
  config: CameraBubbleConfig,
  canvasSize: Size
): void {
  // Skip if canvas has no dimensions
  if (canvasSize.width <= 0 || canvasSize.height <= 0) {
    return;
  }

  // Skip if video has no dimensions (not loaded yet)
  if (cameraVideo.videoWidth === 0 || cameraVideo.videoHeight === 0) {
    return;
  }

  // Calculate bubble bounds with clamping
  const bounds = calculateCameraBubbleBounds(config, canvasSize);

  // Skip if bounds have no dimensions
  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  // Render drop shadow first (behind the bubble)
  if (config.shadowEnabled) {
    renderCameraBubbleShadow(ctx, bounds, config.shape);
  }

  // Render the camera video within the bubble shape
  renderCameraVideo(ctx, cameraVideo, bounds, config.shape, config.backgroundBlur);

  // Render the border on top
  renderCameraBubbleBorder(
    ctx,
    bounds,
    config.shape,
    config.borderWidth,
    config.borderColor
  );
}

/**
 * Creates a CameraBubbleConfig with custom values merged with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete camera bubble configuration
 */
export function createCameraBubbleConfig(
  overrides: Partial<CameraBubbleConfig> = {}
): CameraBubbleConfig {
  return {
    ...DEFAULT_CAMERA_BUBBLE_CONFIG,
    ...overrides,
  };
}
