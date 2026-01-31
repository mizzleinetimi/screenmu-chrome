// Device frame rendering utilities for Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.
// See steering.md: TypeScript Rules - No any, no type casting with as.

import type { CanvasRect, Size } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Device frame type options.
 * - 'none': No device frame, just the screen content
 * - 'browser': Chrome-style browser window with title bar and traffic lights
 * - 'macbook': MacBook laptop bezel with keyboard area
 *
 * Validates: Requirement 3.1
 */
export type DeviceFrameType = 'none' | 'browser' | 'macbook';

/**
 * Configuration for device frame rendering.
 */
export interface DeviceFrameConfig {
  /** Type of device frame to render */
  type: DeviceFrameType;
  /** Optional title for browser frame title bar */
  browserTitle?: string;
  /** Optional URL for browser frame URL bar */
  browserUrl?: string;
  /** Whether to show traffic light buttons (close, minimize, maximize) */
  showTrafficLights: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Height of the browser title bar in pixels */
const BROWSER_TITLE_BAR_HEIGHT = 40;

/** Traffic light button radius */
const TRAFFIC_LIGHT_RADIUS = 6;

/** Traffic light button spacing */
const TRAFFIC_LIGHT_SPACING = 20;

/** Traffic light left margin */
const TRAFFIC_LIGHT_LEFT_MARGIN = 16;

/** Browser frame corner radius */
const BROWSER_CORNER_RADIUS = 10;

/** Browser title bar background color */
const BROWSER_TITLE_BAR_COLOR = '#e8e8e8';

/** Traffic light colors */
const TRAFFIC_LIGHT_COLORS = {
  close: '#ff5f57',
  minimize: '#febc2e',
  maximize: '#28c840',
};

/** MacBook bezel color */
const MACBOOK_BEZEL_COLOR = '#1d1d1f';

/** MacBook bezel thickness */
const MACBOOK_BEZEL_THICKNESS = 12;

/** MacBook bottom bezel (chin) height */
const MACBOOK_CHIN_HEIGHT = 24;

/** MacBook keyboard area height */
const MACBOOK_KEYBOARD_HEIGHT = 80;

/** MacBook keyboard area color */
const MACBOOK_KEYBOARD_COLOR = '#2d2d2d';

/** MacBook trackpad color */
const MACBOOK_TRACKPAD_COLOR = '#1a1a1a';

/** MacBook corner radius */
const MACBOOK_CORNER_RADIUS = 16;

/** MacBook screen corner radius */
const MACBOOK_SCREEN_CORNER_RADIUS = 8;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default device frame configuration.
 */
export const DEFAULT_DEVICE_FRAME_CONFIG: DeviceFrameConfig = {
  type: 'none',
  showTrafficLights: true,
};

// ============================================================================
// Browser Frame Rendering
// ============================================================================

/**
 * Renders traffic light buttons (close, minimize, maximize).
 *
 * @param ctx - Canvas 2D rendering context
 * @param x - X position of the first button center
 * @param y - Y position of the button centers
 *
 * Validates: Requirement 3.3
 */
function renderTrafficLights(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  const colors = [
    TRAFFIC_LIGHT_COLORS.close,
    TRAFFIC_LIGHT_COLORS.minimize,
    TRAFFIC_LIGHT_COLORS.maximize,
  ];

  colors.forEach((color, index) => {
    ctx.beginPath();
    ctx.arc(x + index * TRAFFIC_LIGHT_SPACING, y, TRAFFIC_LIGHT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
  });
}

/**
 * Renders a browser-style device frame around the content area.
 * Includes a title bar with traffic light buttons and optional URL bar.
 *
 * @param ctx - Canvas 2D rendering context
 * @param contentRect - Rectangle where the screen content will be rendered
 * @param config - Device frame configuration
 *
 * Validates: Requirements 3.2, 3.3
 */
function renderBrowserFrame(
  ctx: CanvasRenderingContext2D,
  contentRect: CanvasRect,
  config: DeviceFrameConfig
): void {
  const { x, y, width, height } = contentRect;

  // Calculate frame bounds (title bar is above content)
  const frameX = x;
  const frameY = y - BROWSER_TITLE_BAR_HEIGHT;
  const frameWidth = width;
  const frameHeight = height + BROWSER_TITLE_BAR_HEIGHT;

  ctx.save();

  // Draw frame background with rounded corners
  ctx.beginPath();
  ctx.roundRect(frameX, frameY, frameWidth, frameHeight, BROWSER_CORNER_RADIUS);
  ctx.fillStyle = BROWSER_TITLE_BAR_COLOR;
  ctx.fill();

  // Draw title bar
  ctx.beginPath();
  ctx.roundRect(
    frameX,
    frameY,
    frameWidth,
    BROWSER_TITLE_BAR_HEIGHT,
    [BROWSER_CORNER_RADIUS, BROWSER_CORNER_RADIUS, 0, 0]
  );
  ctx.fillStyle = BROWSER_TITLE_BAR_COLOR;
  ctx.fill();

  // Draw subtle border at bottom of title bar
  ctx.beginPath();
  ctx.moveTo(frameX, frameY + BROWSER_TITLE_BAR_HEIGHT);
  ctx.lineTo(frameX + frameWidth, frameY + BROWSER_TITLE_BAR_HEIGHT);
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw traffic lights
  if (config.showTrafficLights) {
    renderTrafficLights(
      ctx,
      frameX + TRAFFIC_LIGHT_LEFT_MARGIN + TRAFFIC_LIGHT_RADIUS,
      frameY + BROWSER_TITLE_BAR_HEIGHT / 2
    );
  }

  // Draw title text if provided
  if (config.browserTitle) {
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      config.browserTitle,
      frameX + frameWidth / 2,
      frameY + BROWSER_TITLE_BAR_HEIGHT / 2
    );
  }

  // Draw URL bar if provided
  if (config.browserUrl) {
    const urlBarWidth = Math.min(400, frameWidth * 0.5);
    const urlBarHeight = 24;
    const urlBarX = frameX + (frameWidth - urlBarWidth) / 2;
    const urlBarY = frameY + (BROWSER_TITLE_BAR_HEIGHT - urlBarHeight) / 2;

    // URL bar background
    ctx.beginPath();
    ctx.roundRect(urlBarX, urlBarY, urlBarWidth, urlBarHeight, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // URL text
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Truncate URL if too long
    const maxUrlLength = Math.floor(urlBarWidth / 7);
    const displayUrl =
      config.browserUrl.length > maxUrlLength
        ? config.browserUrl.substring(0, maxUrlLength - 3) + '...'
        : config.browserUrl;

    ctx.fillText(displayUrl, urlBarX + urlBarWidth / 2, urlBarY + urlBarHeight / 2);
  }

  ctx.restore();
}

// ============================================================================
// MacBook Frame Rendering
// ============================================================================

/**
 * Renders a MacBook-style device frame around the content area.
 * Includes the laptop bezel and keyboard area.
 *
 * @param ctx - Canvas 2D rendering context
 * @param contentRect - Rectangle where the screen content will be rendered
 * @param _config - Device frame configuration (unused for MacBook but kept for consistency)
 *
 * Validates: Requirements 3.2, 3.4
 */
function renderMacbookFrame(
  ctx: CanvasRenderingContext2D,
  contentRect: CanvasRect,
  _config: DeviceFrameConfig
): void {
  const { x, y, width, height } = contentRect;

  // Calculate screen bezel bounds
  const bezelX = x - MACBOOK_BEZEL_THICKNESS;
  const bezelY = y - MACBOOK_BEZEL_THICKNESS;
  const bezelWidth = width + MACBOOK_BEZEL_THICKNESS * 2;
  const bezelHeight = height + MACBOOK_BEZEL_THICKNESS + MACBOOK_CHIN_HEIGHT;

  // Calculate keyboard area bounds
  const keyboardX = bezelX - 20; // Keyboard extends slightly beyond screen
  const keyboardY = bezelY + bezelHeight;
  const keyboardWidth = bezelWidth + 40;
  const keyboardHeight = MACBOOK_KEYBOARD_HEIGHT;

  ctx.save();

  // Draw screen bezel (outer frame)
  ctx.beginPath();
  ctx.roundRect(bezelX, bezelY, bezelWidth, bezelHeight, MACBOOK_CORNER_RADIUS);
  ctx.fillStyle = MACBOOK_BEZEL_COLOR;
  ctx.fill();

  // Draw screen area (inner cutout effect - slightly darker)
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, MACBOOK_SCREEN_CORNER_RADIUS);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // Draw camera notch at top center
  const notchWidth = 8;
  const notchHeight = 8;
  const notchX = x + width / 2 - notchWidth / 2;
  const notchY = bezelY + 4;

  ctx.beginPath();
  ctx.arc(notchX + notchWidth / 2, notchY + notchHeight / 2, notchWidth / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();

  // Draw keyboard base
  ctx.beginPath();
  ctx.roundRect(
    keyboardX,
    keyboardY,
    keyboardWidth,
    keyboardHeight,
    [0, 0, MACBOOK_CORNER_RADIUS, MACBOOK_CORNER_RADIUS]
  );
  ctx.fillStyle = MACBOOK_KEYBOARD_COLOR;
  ctx.fill();

  // Draw hinge line
  ctx.beginPath();
  ctx.moveTo(keyboardX + 10, keyboardY);
  ctx.lineTo(keyboardX + keyboardWidth - 10, keyboardY);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw trackpad
  const trackpadWidth = keyboardWidth * 0.4;
  const trackpadHeight = keyboardHeight * 0.6;
  const trackpadX = keyboardX + (keyboardWidth - trackpadWidth) / 2;
  const trackpadY = keyboardY + (keyboardHeight - trackpadHeight) / 2 + 5;

  ctx.beginPath();
  ctx.roundRect(trackpadX, trackpadY, trackpadWidth, trackpadHeight, 4);
  ctx.fillStyle = MACBOOK_TRACKPAD_COLOR;
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// Main Rendering Function
// ============================================================================

/**
 * Renders a device frame around the content area.
 *
 * This function renders the appropriate device frame based on the configuration:
 * - 'none': No frame is rendered
 * - 'browser': Chrome-style browser window with title bar and traffic lights
 * - 'macbook': MacBook laptop bezel with keyboard area
 *
 * The contentRect parameter defines where the actual screen content will be
 * rendered. The device frame is drawn around this area.
 *
 * @param ctx - Canvas 2D rendering context
 * @param contentRect - Rectangle where the screen content will be rendered
 * @param config - Device frame configuration
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */
export function renderDeviceFrame(
  ctx: CanvasRenderingContext2D,
  contentRect: CanvasRect,
  config: DeviceFrameConfig
): void {
  // Skip if content rect has no dimensions
  if (contentRect.width <= 0 || contentRect.height <= 0) {
    return;
  }

  switch (config.type) {
    case 'browser':
      renderBrowserFrame(ctx, contentRect, config);
      break;
    case 'macbook':
      renderMacbookFrame(ctx, contentRect, config);
      break;
    case 'none':
    default:
      // No frame to render
      break;
  }
}

/**
 * Calculates the content area adjustment needed for a device frame.
 * When a device frame is applied, the content area may need to be
 * adjusted to make room for the frame elements.
 *
 * @param frameType - Type of device frame
 * @param availableRect - Available rectangle for content and frame
 * @returns Adjusted content rectangle that accounts for frame elements
 *
 * Validates: Requirement 3.5
 */
export function calculateContentRectForFrame(
  frameType: DeviceFrameType,
  availableRect: CanvasRect
): CanvasRect {
  const { x, y, width, height } = availableRect;

  switch (frameType) {
    case 'browser':
      // Browser frame needs space above for title bar
      return {
        x,
        y: y + BROWSER_TITLE_BAR_HEIGHT,
        width,
        height: height - BROWSER_TITLE_BAR_HEIGHT,
      };

    case 'macbook':
      // MacBook frame needs space around for bezel and below for keyboard
      const totalVerticalPadding =
        MACBOOK_BEZEL_THICKNESS * 2 + MACBOOK_CHIN_HEIGHT + MACBOOK_KEYBOARD_HEIGHT;
      const totalHorizontalPadding = MACBOOK_BEZEL_THICKNESS * 2 + 40; // 40 for keyboard overhang

      return {
        x: x + MACBOOK_BEZEL_THICKNESS + 20,
        y: y + MACBOOK_BEZEL_THICKNESS,
        width: width - totalHorizontalPadding,
        height: height - totalVerticalPadding,
      };

    case 'none':
    default:
      // No adjustment needed
      return { ...availableRect };
  }
}

/**
 * Gets the frame dimensions needed for a given content size.
 * This is useful for calculating how much space a device frame will occupy.
 *
 * @param frameType - Type of device frame
 * @param contentSize - Size of the content area
 * @returns Total size including the device frame
 */
export function getFrameDimensions(
  frameType: DeviceFrameType,
  contentSize: Size
): Size {
  const { width, height } = contentSize;

  switch (frameType) {
    case 'browser':
      return {
        width,
        height: height + BROWSER_TITLE_BAR_HEIGHT,
      };

    case 'macbook':
      return {
        width: width + MACBOOK_BEZEL_THICKNESS * 2 + 40,
        height:
          height +
          MACBOOK_BEZEL_THICKNESS * 2 +
          MACBOOK_CHIN_HEIGHT +
          MACBOOK_KEYBOARD_HEIGHT,
      };

    case 'none':
    default:
      return { width, height };
  }
}

/**
 * Creates a DeviceFrameConfig with custom values merged with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete device frame configuration
 */
export function createDeviceFrameConfig(
  overrides: Partial<DeviceFrameConfig> = {}
): DeviceFrameConfig {
  return {
    ...DEFAULT_DEVICE_FRAME_CONFIG,
    ...overrides,
  };
}
