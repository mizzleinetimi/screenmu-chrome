// Canvas compositor for Phase 1 Core Rendering + Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { Effect, NormalizedCoord, Viewport, EditSettings } from '../types';
import type { CanvasRect, Size } from './types';
import { getSourceRect } from './viewport';
import { renderAllClickRings } from './effects';
import { renderCursor, DEFAULT_CURSOR_SCALE } from './cursor';
import { renderBackgroundById, DEFAULT_GRADIENT_PRESET_ID } from './background';
import {
  calculateInsetRect,
  DEFAULT_SCREEN_FRAME_CONFIG,
  type ScreenFrameConfig,
} from './screenFrame';
import {
  renderDeviceFrame,
  calculateContentRectForFrame,
  DEFAULT_DEVICE_FRAME_CONFIG,
  type DeviceFrameConfig,
} from './deviceFrame';
import {
  renderCameraBubble,
  DEFAULT_CAMERA_BUBBLE_CONFIG,
  type CameraBubbleConfig,
} from './cameraBubble';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for the CanvasCompositor.
 * Controls canvas dimensions and rendering options.
 */
export interface CompositorConfig {
  /** Canvas width in pixels */
  canvasWidth: number;
  /** Canvas height in pixels */
  canvasHeight: number;
  /** Cursor scale factor (default 1.5 for enlarged cursor) */
  cursorScale: number;
  /** Whether cursor smoothing is enabled */
  cursorSmoothingEnabled: boolean;
  /** Click ring color (default 'rgba(59, 130, 246, 0.6)') */
  clickRingColor: string;
  /** Click ring maximum radius at 1080p (default 40 pixels) */
  clickRingMaxRadius: number;
  /** Optional cursor sprite image (uses default arrow if not provided) */
  cursorSprite?: ImageBitmap;

  // Phase 2 Visual Polish settings
  /** Background gradient preset ID */
  backgroundGradient: string;
  /** Screen frame configuration */
  screenFrame: ScreenFrameConfig;
  /** Device frame configuration */
  deviceFrame: DeviceFrameConfig;
  /** Camera bubble configuration */
  cameraBubble: CameraBubbleConfig;
}

/**
 * Context for rendering a single frame.
 * Contains all data needed to render one complete frame.
 */
export interface RenderContext {
  /** Current timestamp in microseconds */
  timestamp_us: number;
  /** Current viewport (defines visible area and zoom) */
  viewport: Viewport;
  /** Active effects to render (click rings, etc.) */
  activeEffects: ReadonlyArray<Effect>;
  /** Cursor position in normalized coordinates, or null if hidden */
  cursorPosition: NormalizedCoord | null;
  /** Cursor opacity (0-1) */
  cursorOpacity: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default click ring color (blue with transparency).
 */
export const DEFAULT_CLICK_RING_COLOR = 'rgba(59, 130, 246, 0.6)';

/**
 * Default click ring maximum radius at 1080p.
 */
export const DEFAULT_CLICK_RING_MAX_RADIUS = 40;

/**
 * Creates a default CompositorConfig with sensible defaults.
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @returns Default compositor configuration
 */
export function createDefaultConfig(
  canvasWidth: number,
  canvasHeight: number
): CompositorConfig {
  return {
    canvasWidth,
    canvasHeight,
    cursorScale: DEFAULT_CURSOR_SCALE,
    cursorSmoothingEnabled: true,
    clickRingColor: DEFAULT_CLICK_RING_COLOR,
    clickRingMaxRadius: DEFAULT_CLICK_RING_MAX_RADIUS,
    // Phase 2 defaults
    backgroundGradient: DEFAULT_GRADIENT_PRESET_ID,
    screenFrame: { ...DEFAULT_SCREEN_FRAME_CONFIG },
    deviceFrame: { ...DEFAULT_DEVICE_FRAME_CONFIG },
    cameraBubble: { ...DEFAULT_CAMERA_BUBBLE_CONFIG },
  };
}

/**
 * Creates a CompositorConfig from EditSettings.
 * Maps the project's edit settings to compositor configuration.
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param editSettings - Project edit settings
 * @returns Compositor configuration based on edit settings
 */
export function createConfigFromEditSettings(
  canvasWidth: number,
  canvasHeight: number,
  editSettings: EditSettings
): CompositorConfig {
  return {
    canvasWidth,
    canvasHeight,
    cursorScale: DEFAULT_CURSOR_SCALE,
    cursorSmoothingEnabled: true,
    clickRingColor: DEFAULT_CLICK_RING_COLOR,
    clickRingMaxRadius: DEFAULT_CLICK_RING_MAX_RADIUS,
    // Phase 2 settings from EditSettings
    backgroundGradient: editSettings.backgroundGradient,
    screenFrame: {
      cornerRadius: editSettings.screenCornerRadius,
      shadowBlur: editSettings.screenShadowBlur,
      shadowOffsetY: DEFAULT_SCREEN_FRAME_CONFIG.shadowOffsetY,
      shadowOpacity: DEFAULT_SCREEN_FRAME_CONFIG.shadowOpacity,
      padding: editSettings.padding,
      shadowEnabled: editSettings.screenShadowEnabled,
    },
    deviceFrame: {
      type: editSettings.deviceFrame,
      showTrafficLights: true,
    },
    cameraBubble: {
      position: editSettings.cameraBubblePosition,
      size: editSettings.cameraBubbleSize,
      shape: editSettings.cameraBubbleShape,
      borderWidth: editSettings.cameraBubbleBorderWidth,
      borderColor: editSettings.cameraBubbleBorderColor,
      shadowEnabled: editSettings.screenShadowEnabled, // Use same shadow setting
      backgroundBlur: editSettings.cameraBackgroundBlur,
    },
  };
}

// ============================================================================
// CanvasCompositor Class
// ============================================================================

/**
 * CanvasCompositor handles rendering of complete frames with all visual layers.
 *
 * Layer ordering (bottom to top) - Phase 2 Visual Polish:
 * 1. Background Layer - gradient/image filling the canvas
 * 2. Screen Shadow Layer - drop shadow behind the screen frame
 * 3. Device Frame Layer - optional browser/macbook frame
 * 4. Screen Frame Layer - video with rounded corners, viewport applied
 * 5. Effects Layer - click rings and other visual effects
 * 6. Cursor Layer - cursor sprite with opacity
 * 7. Camera Bubble Layer - picture-in-picture with shape, shadow, blur
 *
 * Validates: Requirements 1.2, 2.3, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5
 * Phase 2 Validates: All Phase 2 requirements
 */
export class CanvasCompositor {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly config: CompositorConfig;
  private readonly canvasSize: Size;

  /**
   * Creates a new CanvasCompositor.
   *
   * @param ctx - Canvas 2D rendering context to draw on
   * @param config - Compositor configuration
   */
  constructor(ctx: CanvasRenderingContext2D, config: CompositorConfig) {
    this.ctx = ctx;
    this.config = config;
    this.canvasSize = {
      width: config.canvasWidth,
      height: config.canvasHeight,
    };
  }

  /**
   * Renders a complete frame with all layers.
   *
   * This is the main entry point for rendering. It draws all layers in the
   * correct order following the Phase 2 layer architecture:
   * background → screen shadow → device frame → screen frame → effects → cursor → camera PiP.
   *
   * @param sourceVideo - Source video element to render
   * @param context - Render context with viewport, effects, and cursor data
   * @param cameraVideo - Optional camera video for PiP overlay
   *
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
   * Phase 2 Validates: All Phase 2 requirements
   */
  renderFrame(
    sourceVideo: HTMLVideoElement,
    context: RenderContext,
    cameraVideo?: HTMLVideoElement
  ): void {
    // Clear the canvas before rendering
    this.ctx.clearRect(0, 0, this.canvasSize.width, this.canvasSize.height);

    // Layer 1: Background (gradient)
    // Validates: Requirements 1.1, 1.2
    this.renderBackgroundLayer();

    // Calculate the content rect for the screen frame
    // This accounts for padding and device frame requirements
    const contentRect = this.calculateContentRect();

    // Layer 2 & 3: Device Frame (rendered before screen frame so it appears behind)
    // The device frame is drawn around where the content will be
    // Validates: Requirements 3.1, 3.2, 3.3, 3.4
    this.renderDeviceFrameLayer(contentRect);

    // Layer 4: Screen Frame (video with rounded corners and shadow)
    // Shadow is rendered as part of this layer (behind the video)
    // Validates: Requirements 2.1, 2.2, 2.3, 2.4, 1.2, 4.2
    this.renderScreenFrameLayer(sourceVideo, context.viewport, contentRect);

    // Layer 5: Effects (click rings on top of video)
    // Validates: Requirements 2.3, 4.3
    this.renderEffectsLayer(
      context.activeEffects,
      context.viewport,
      context.timestamp_us,
      contentRect
    );

    // Layer 6: Cursor (on top of effects)
    // Validates: Requirements 3.3, 4.4
    if (context.cursorPosition !== null) {
      this.renderCursorLayer(
        context.cursorPosition,
        context.cursorOpacity,
        context.viewport,
        contentRect
      );
    }

    // Layer 7: Camera PiP overlay (on top of everything)
    // Validates: Requirement 4.5, Phase 2 Requirements 4.4, 4.6, 4.7, 5.1, 5.2
    if (cameraVideo !== undefined) {
      this.renderCameraBubbleLayer(cameraVideo);
    }
  }

  /**
   * Renders the background layer with gradient.
   *
   * The background fills the entire canvas with the configured gradient preset.
   *
   * Validates: Requirements 1.1, 1.2
   */
  private renderBackgroundLayer(): void {
    renderBackgroundById(
      this.ctx,
      this.config.backgroundGradient,
      this.canvasSize
    );
  }

  /**
   * Calculates the content rectangle for the screen frame.
   *
   * This takes into account:
   * - Screen frame padding (inset from canvas edges)
   * - Device frame requirements (additional space for frame elements)
   *
   * @returns Rectangle defining where the screen content should be rendered
   */
  private calculateContentRect(): CanvasRect {
    // First calculate the inset rect based on padding
    const insetRect = calculateInsetRect(
      this.config.screenFrame.padding,
      this.canvasSize
    );

    // Then adjust for device frame if needed
    const contentRect = calculateContentRectForFrame(
      this.config.deviceFrame.type,
      insetRect
    );

    return contentRect;
  }

  /**
   * Renders the device frame layer.
   *
   * The device frame (browser chrome, macbook bezel) is rendered around
   * the content area. This is drawn before the screen frame so it appears
   * behind the video content.
   *
   * @param contentRect - Rectangle where the screen content will be rendered
   *
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  private renderDeviceFrameLayer(contentRect: CanvasRect): void {
    // Skip if no device frame
    if (this.config.deviceFrame.type === 'none') {
      return;
    }

    renderDeviceFrame(this.ctx, contentRect, this.config.deviceFrame);
  }

  /**
   * Renders the screen frame layer with video, rounded corners, and shadow.
   *
   * This layer includes:
   * - Drop shadow behind the frame (if enabled)
   * - Rounded corner clipping
   * - Video content transformed by viewport
   *
   * @param video - Source video element
   * @param viewport - Current viewport defining visible area
   * @param contentRect - Rectangle where the content should be rendered
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 1.2, 1.3, 4.2
   */
  private renderScreenFrameLayer(
    video: HTMLVideoElement,
    viewport: Viewport,
    contentRect: CanvasRect
  ): void {
    // Get video dimensions
    const videoSize: Size = {
      width: video.videoWidth,
      height: video.videoHeight,
    };

    // Skip if video has no dimensions (not loaded yet)
    if (videoSize.width === 0 || videoSize.height === 0) {
      return;
    }

    // Create a custom screen frame config that uses the content rect
    // instead of calculating from padding (since we already did that)
    const screenFrameConfig: ScreenFrameConfig = {
      ...this.config.screenFrame,
      // Set padding to 0 since we're providing the exact content rect
      padding: 0,
    };

    // We need to render the screen frame at the content rect position
    // The renderScreenFrame function calculates its own inset, so we need
    // to work around that by temporarily adjusting the canvas size
    this.renderScreenFrameAtRect(video, viewport, contentRect, screenFrameConfig);
  }

  /**
   * Renders the screen frame at a specific rectangle position.
   *
   * This is a helper that renders the video with rounded corners and shadow
   * at the specified content rectangle, rather than calculating from padding.
   *
   * @param video - Source video element
   * @param viewport - Current viewport
   * @param rect - Target rectangle for the screen frame
   * @param config - Screen frame configuration
   */
  private renderScreenFrameAtRect(
    video: HTMLVideoElement,
    viewport: Viewport,
    rect: CanvasRect,
    config: ScreenFrameConfig
  ): void {
    // Skip if rect has no dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    // Get video dimensions
    const videoSize: Size = {
      width: video.videoWidth,
      height: video.videoHeight,
    };

    // Skip if video has no dimensions
    if (videoSize.width === 0 || videoSize.height === 0) {
      return;
    }

    // Calculate source crop rectangle based on viewport
    const sourceRect = getSourceRect(viewport, videoSize);

    // Render drop shadow first (behind the frame)
    if (config.shadowEnabled) {
      this.ctx.save();
      this.ctx.shadowColor = `rgba(0, 0, 0, ${config.shadowOpacity})`;
      this.ctx.shadowBlur = config.shadowBlur;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = config.shadowOffsetY;

      // Create rounded rect path and fill to generate shadow
      this.createRoundedRectPath(rect, config.cornerRadius);
      this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      this.ctx.fill();

      this.ctx.restore();
    }

    // Save context state before clipping
    this.ctx.save();

    // Create rounded rectangle clip path
    this.createRoundedRectPath(rect, config.cornerRadius);
    this.ctx.clip();

    // Draw the video frame within the clipped area
    this.ctx.drawImage(
      video,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );

    // Restore context state (removes clipping)
    this.ctx.restore();
  }

  /**
   * Creates a rounded rectangle path on the canvas context.
   *
   * @param rect - Rectangle bounds
   * @param radius - Corner radius in pixels
   */
  private createRoundedRectPath(rect: CanvasRect, radius: number): void {
    const { x, y, width, height } = rect;

    // Clamp radius to half of the smallest dimension
    const maxRadius = Math.min(width / 2, height / 2);
    const r = Math.max(0, Math.min(radius, maxRadius));

    this.ctx.beginPath();

    if (r === 0) {
      this.ctx.rect(x, y, width, height);
    } else {
      this.ctx.moveTo(x + r, y);
      this.ctx.lineTo(x + width - r, y);
      this.ctx.arcTo(x + width, y, x + width, y + r, r);
      this.ctx.lineTo(x + width, y + height - r);
      this.ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
      this.ctx.lineTo(x + r, y + height);
      this.ctx.arcTo(x, y + height, x, y + height - r, r);
      this.ctx.lineTo(x, y + r);
      this.ctx.arcTo(x, y, x + r, y, r);
    }

    this.ctx.closePath();
  }

  /**
   * Renders the effects layer (click rings and other visual effects).
   *
   * Effects are rendered at their viewport-transformed positions so they
   * appear at the correct screen location when zoomed. The positions are
   * mapped to the content rect rather than the full canvas.
   *
   * @param effects - Array of active effects to render
   * @param viewport - Current viewport for position transformation
   * @param timestamp - Current timestamp in microseconds
   * @param contentRect - Rectangle where the screen content is rendered
   *
   * Validates: Requirements 2.3, 2.7, 4.3
   */
  private renderEffectsLayer(
    effects: ReadonlyArray<Effect>,
    viewport: Viewport,
    timestamp: number,
    contentRect: CanvasRect
  ): void {
    // Skip if no effects to render
    if (effects.length === 0) {
      return;
    }

    // Create a size object from the content rect for effects rendering
    const effectsSize: Size = {
      width: contentRect.width,
      height: contentRect.height,
    };

    // Save context and translate to content rect origin
    this.ctx.save();
    this.ctx.translate(contentRect.x, contentRect.y);

    // Render all click ring effects within the content area
    renderAllClickRings(
      this.ctx,
      effects,
      viewport,
      effectsSize,
      timestamp,
      this.config.clickRingColor
    );

    this.ctx.restore();
  }

  /**
   * Renders the cursor layer.
   *
   * The cursor is rendered at its viewport-transformed position with the
   * specified opacity. The cursor scale from config is applied.
   * Position is mapped to the content rect.
   *
   * @param position - Cursor position in normalized coordinates
   * @param opacity - Cursor opacity (0-1)
   * @param viewport - Current viewport for position transformation
   * @param contentRect - Rectangle where the screen content is rendered
   *
   * Validates: Requirements 3.3, 3.7, 3.8, 4.4
   */
  private renderCursorLayer(
    position: NormalizedCoord,
    opacity: number,
    viewport: Viewport,
    contentRect: CanvasRect
  ): void {
    // Skip if fully transparent
    if (opacity <= 0) {
      return;
    }

    // Create a size object from the content rect for cursor rendering
    const cursorSize: Size = {
      width: contentRect.width,
      height: contentRect.height,
    };

    // Save context and translate to content rect origin
    this.ctx.save();
    this.ctx.translate(contentRect.x, contentRect.y);

    // Render cursor with configured scale and optional sprite
    renderCursor(this.ctx, position, viewport, cursorSize, {
      scale: this.config.cursorScale,
      opacity,
      sprite: this.config.cursorSprite,
    });

    this.ctx.restore();
  }

  /**
   * Renders the camera bubble layer (picture-in-picture).
   *
   * The camera feed is rendered as a bubble (circle or rounded-rect) with
   * configurable position, size, border, shadow, and background blur.
   *
   * @param video - Camera video element
   *
   * Validates: Requirement 4.5, Phase 2 Requirements 4.4, 4.6, 4.7, 5.1, 5.2
   */
  private renderCameraBubbleLayer(video: HTMLVideoElement): void {
    // Skip if video has no dimensions (not loaded yet)
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    // Render the camera bubble with Phase 2 configuration
    renderCameraBubble(
      this.ctx,
      video,
      this.config.cameraBubble,
      this.canvasSize
    );
  }

  /**
   * Gets the current canvas size.
   *
   * @returns Canvas dimensions
   */
  getCanvasSize(): Size {
    return { ...this.canvasSize };
  }

  /**
   * Gets the current configuration.
   *
   * @returns Compositor configuration
   */
  getConfig(): CompositorConfig {
    return { ...this.config };
  }
}


// ============================================================================
// Cursor Sprite Loading
// ============================================================================

/**
 * Loads a cursor sprite from a URL and returns an ImageBitmap.
 * This can be used to load the default cursor.svg or a custom cursor.
 *
 * @param url - URL of the cursor image (SVG or PNG)
 * @returns Promise resolving to ImageBitmap, or null if loading fails
 *
 * Validates: Requirements 3.3, 3.8
 */
export async function loadCursorSprite(url: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[Compositor] Failed to load cursor sprite: ${response.status}`);
      return null;
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return bitmap;
  } catch (error) {
    console.warn('[Compositor] Error loading cursor sprite:', error);
    return null;
  }
}

/**
 * Creates a CompositorConfig with a loaded cursor sprite.
 * This is an async version of createDefaultConfig that loads the cursor sprite.
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 * @param cursorSpriteUrl - Optional URL to cursor sprite (uses default if not provided)
 * @returns Promise resolving to compositor configuration with loaded sprite
 */
export async function createConfigWithCursor(
  canvasWidth: number,
  canvasHeight: number,
  cursorSpriteUrl?: string
): Promise<CompositorConfig> {
  const config = createDefaultConfig(canvasWidth, canvasHeight);

  if (cursorSpriteUrl) {
    const sprite = await loadCursorSprite(cursorSpriteUrl);
    if (sprite) {
      config.cursorSprite = sprite;
    }
  }

  return config;
}
