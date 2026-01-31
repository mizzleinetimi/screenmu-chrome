// Camera bubble rendering tests for Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_CAMERA_BUBBLE_CONFIG,
  MIN_CAMERA_BUBBLE_SIZE,
  MAX_CAMERA_BUBBLE_SIZE,
  MIN_BACKGROUND_BLUR,
  MAX_BACKGROUND_BLUR,
  clampCameraBubbleSize,
  clampBackgroundBlur,
  isBackgroundBlurSupported,
  calculateCameraBubbleBounds,
  renderCameraBubble,
  createCameraBubbleConfig,
  type CameraBubbleConfig,
  type CameraBubbleShape,
} from './cameraBubble';
import type { Size } from './types';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createMockVideo(width: number, height: number): HTMLVideoElement {
  return {
    videoWidth: width,
    videoHeight: height,
  } as HTMLVideoElement;
}

// ============================================================================
// Default Configuration Tests
// ============================================================================

describe('DEFAULT_CAMERA_BUBBLE_CONFIG', () => {
  it('should have valid default position', () => {
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.position.x).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.position.x).toBeLessThanOrEqual(1);
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.position.y).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.position.y).toBeLessThanOrEqual(1);
  });

  it('should have valid default size within range', () => {
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.size).toBeGreaterThanOrEqual(MIN_CAMERA_BUBBLE_SIZE);
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.size).toBeLessThanOrEqual(MAX_CAMERA_BUBBLE_SIZE);
  });

  it('should have circle as default shape', () => {
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.shape).toBe('circle');
  });

  it('should have positive border width', () => {
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.borderWidth).toBeGreaterThan(0);
  });

  it('should have shadow enabled by default', () => {
    expect(DEFAULT_CAMERA_BUBBLE_CONFIG.shadowEnabled).toBe(true);
  });
});

// ============================================================================
// Size Clamping Tests
// ============================================================================

describe('clampCameraBubbleSize', () => {
  it('should return value unchanged when within range', () => {
    expect(clampCameraBubbleSize(0.2)).toBe(0.2);
    expect(clampCameraBubbleSize(0.3)).toBe(0.3);
  });

  it('should clamp values below minimum to minimum', () => {
    expect(clampCameraBubbleSize(0.05)).toBe(MIN_CAMERA_BUBBLE_SIZE);
    expect(clampCameraBubbleSize(0)).toBe(MIN_CAMERA_BUBBLE_SIZE);
    expect(clampCameraBubbleSize(-0.1)).toBe(MIN_CAMERA_BUBBLE_SIZE);
  });

  it('should clamp values above maximum to maximum', () => {
    expect(clampCameraBubbleSize(0.5)).toBe(MAX_CAMERA_BUBBLE_SIZE);
    expect(clampCameraBubbleSize(1.0)).toBe(MAX_CAMERA_BUBBLE_SIZE);
  });

  it('should handle boundary values', () => {
    expect(clampCameraBubbleSize(MIN_CAMERA_BUBBLE_SIZE)).toBe(MIN_CAMERA_BUBBLE_SIZE);
    expect(clampCameraBubbleSize(MAX_CAMERA_BUBBLE_SIZE)).toBe(MAX_CAMERA_BUBBLE_SIZE);
  });
});

// ============================================================================
// Background Blur Tests
// ============================================================================

describe('clampBackgroundBlur', () => {
  it('should return 0 for values below minimum (disabled)', () => {
    expect(clampBackgroundBlur(0)).toBe(0);
    expect(clampBackgroundBlur(0.5)).toBe(0);
    expect(clampBackgroundBlur(-1)).toBe(0);
  });

  it('should return value unchanged when within valid range', () => {
    expect(clampBackgroundBlur(1)).toBe(1);
    expect(clampBackgroundBlur(10)).toBe(10);
    expect(clampBackgroundBlur(15)).toBe(15);
  });

  it('should clamp values above maximum to maximum', () => {
    expect(clampBackgroundBlur(21)).toBe(MAX_BACKGROUND_BLUR);
    expect(clampBackgroundBlur(100)).toBe(MAX_BACKGROUND_BLUR);
  });

  it('should handle boundary values', () => {
    expect(clampBackgroundBlur(MIN_BACKGROUND_BLUR)).toBe(MIN_BACKGROUND_BLUR);
    expect(clampBackgroundBlur(MAX_BACKGROUND_BLUR)).toBe(MAX_BACKGROUND_BLUR);
  });
});

describe('isBackgroundBlurSupported', () => {
  it('should return a boolean', () => {
    const result = isBackgroundBlurSupported();
    expect(typeof result).toBe('boolean');
  });

  // Note: In Node.js test environment, OffscreenCanvas may not be available
  // The actual support depends on the runtime environment
});

// ============================================================================
// Bounds Calculation Tests
// ============================================================================

describe('calculateCameraBubbleBounds', () => {
  const canvasSize: Size = { width: 1920, height: 1080 };

  it('should calculate correct bounds for circle shape', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      position: { x: 0.5, y: 0.5 },
      size: 0.2,
      shape: 'circle',
    };

    const bounds = calculateCameraBubbleBounds(config, canvasSize);

    // Size should be based on smaller dimension (1080)
    const expectedSize = 1080 * 0.2; // 216
    expect(bounds.width).toBe(expectedSize);
    expect(bounds.height).toBe(expectedSize); // Circle has equal width/height
  });

  it('should calculate correct bounds for rounded-rect shape', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      position: { x: 0.5, y: 0.5 },
      size: 0.2,
      shape: 'rounded-rect',
    };

    const bounds = calculateCameraBubbleBounds(config, canvasSize);

    // Width based on smaller dimension
    const expectedWidth = 1080 * 0.2; // 216
    const expectedHeight = expectedWidth * 0.75; // 162
    expect(bounds.width).toBe(expectedWidth);
    expect(bounds.height).toBe(expectedHeight);
  });

  it('should clamp position to keep bubble within canvas bounds', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      position: { x: 1.0, y: 1.0 }, // Bottom-right corner
      size: 0.2,
      shape: 'circle',
    };

    const bounds = calculateCameraBubbleBounds(config, canvasSize);

    // Bubble should be clamped to stay within canvas
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvasSize.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvasSize.height);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
  });

  it('should clamp position at top-left corner', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      position: { x: 0, y: 0 },
      size: 0.2,
      shape: 'circle',
    };

    const bounds = calculateCameraBubbleBounds(config, canvasSize);

    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
  });

  it('should clamp size to valid range', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      position: { x: 0.5, y: 0.5 },
      size: 0.6, // Above max
      shape: 'circle',
    };

    const bounds = calculateCameraBubbleBounds(config, canvasSize);

    // Size should be clamped to max (0.4)
    const expectedSize = 1080 * MAX_CAMERA_BUBBLE_SIZE;
    expect(bounds.width).toBe(expectedSize);
  });
});

// ============================================================================
// Render Function Tests
// ============================================================================

describe('renderCameraBubble', () => {
  let ctx: CanvasRenderingContext2D;
  let video: HTMLVideoElement;
  const canvasSize: Size = { width: 1920, height: 1080 };

  beforeEach(() => {
    ctx = createMockContext();
    video = createMockVideo(1280, 720);
  });

  it('should skip rendering when canvas has no dimensions', () => {
    renderCameraBubble(ctx, video, DEFAULT_CAMERA_BUBBLE_CONFIG, { width: 0, height: 0 });
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('should skip rendering when video has no dimensions', () => {
    const emptyVideo = createMockVideo(0, 0);
    renderCameraBubble(ctx, emptyVideo, DEFAULT_CAMERA_BUBBLE_CONFIG, canvasSize);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('should render shadow when enabled', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      shadowEnabled: true,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    // Shadow rendering should set shadowBlur
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('should not render shadow when disabled', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      shadowEnabled: false,
      borderWidth: 0, // Disable border too
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    // Only video rendering should happen (save/restore for clip)
    // Shadow fill should not be called before video
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.length;
    // With shadow disabled, fill is only called for video clip, not shadow
    expect(fillCalls).toBe(0); // No fill calls since we only clip and drawImage
  });

  it('should render border when borderWidth > 0', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      borderWidth: 5,
      borderColor: '#ff0000',
      shadowEnabled: false,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('should not render border when borderWidth is 0', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      borderWidth: 0,
      shadowEnabled: false,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('should draw video with drawImage', () => {
    renderCameraBubble(ctx, video, DEFAULT_CAMERA_BUBBLE_CONFIG, canvasSize);

    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('should create circle path for circle shape', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      shape: 'circle',
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    expect(ctx.arc).toHaveBeenCalled();
  });

  it('should create rounded rect path for rounded-rect shape', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      shape: 'rounded-rect',
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    expect(ctx.arcTo).toHaveBeenCalled();
  });

  it('should render video without blur when backgroundBlur is 0', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      backgroundBlur: 0,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    // Video should be drawn directly
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('should render video with blur when backgroundBlur > 0 (if supported)', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      backgroundBlur: 10,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    // Video should still be drawn (either blurred or fallback)
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('should handle maximum blur value', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      backgroundBlur: MAX_BACKGROUND_BLUR,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('should treat blur values below 1 as disabled', () => {
    const config: CameraBubbleConfig = {
      ...DEFAULT_CAMERA_BUBBLE_CONFIG,
      backgroundBlur: 0.5,
    };

    renderCameraBubble(ctx, video, config, canvasSize);

    // Should render without blur (fallback to direct draw)
    expect(ctx.drawImage).toHaveBeenCalled();
  });
});

// ============================================================================
// Config Factory Tests
// ============================================================================

describe('createCameraBubbleConfig', () => {
  it('should return default config when no overrides provided', () => {
    const config = createCameraBubbleConfig();
    expect(config).toEqual(DEFAULT_CAMERA_BUBBLE_CONFIG);
  });

  it('should override specific properties', () => {
    const config = createCameraBubbleConfig({
      shape: 'rounded-rect',
      borderWidth: 5,
    });

    expect(config.shape).toBe('rounded-rect');
    expect(config.borderWidth).toBe(5);
    // Other properties should remain default
    expect(config.position).toEqual(DEFAULT_CAMERA_BUBBLE_CONFIG.position);
    expect(config.size).toBe(DEFAULT_CAMERA_BUBBLE_CONFIG.size);
  });

  it('should override position', () => {
    const config = createCameraBubbleConfig({
      position: { x: 0.1, y: 0.1 },
    });

    expect(config.position).toEqual({ x: 0.1, y: 0.1 });
  });

  it('should override all properties', () => {
    const customConfig: CameraBubbleConfig = {
      position: { x: 0.2, y: 0.3 },
      size: 0.25,
      shape: 'rounded-rect',
      borderWidth: 4,
      borderColor: '#000000',
      shadowEnabled: false,
      backgroundBlur: 10,
    };

    const config = createCameraBubbleConfig(customConfig);
    expect(config).toEqual(customConfig);
  });
});


// ============================================================================
// Property-Based Tests: Camera Bubble Bounds
// ============================================================================

/**
 * Property 3: Camera Bubble Bounds
 *
 * For any camera bubble position (cx, cy) and size S, the bubble SHALL be
 * clamped to remain fully within canvas bounds.
 *
 * **Validates: Requirements 4.1, 4.2**
 */
describe('Property 3: Camera Bubble Bounds', () => {
  /**
   * Arbitrary for positive canvas dimensions.
   * Using reasonable bounds for canvas sizes (100 to 4096 pixels).
   * Minimum of 100 ensures the bubble has room to render.
   */
  const positiveCanvasSize = fc.record({
    width: fc.integer({ min: 100, max: 4096 }),
    height: fc.integer({ min: 100, max: 4096 }),
  });

  /**
   * Arbitrary for normalized position coordinates (0-1 range).
   * These represent the center position of the camera bubble.
   * We test the full range including edge cases at 0 and 1.
   */
  const normalizedPosition = fc.record({
    x: fc.double({ min: 0, max: 1, noNaN: true }),
    y: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  /**
   * Arbitrary for camera bubble size.
   * Size is a fraction of the canvas (0.1-0.4 is valid range).
   * We test beyond the valid range to verify clamping behavior.
   */
  const bubbleSize = fc.double({ min: 0, max: 1, noNaN: true });

  /**
   * Arbitrary for camera bubble shape.
   */
  const bubbleShape: fc.Arbitrary<CameraBubbleShape> = fc.constantFrom('circle', 'rounded-rect');

  /**
   * Arbitrary for a complete camera bubble configuration.
   */
  const cameraBubbleConfig = fc.record({
    position: normalizedPosition,
    size: bubbleSize,
    shape: bubbleShape,
    borderWidth: fc.integer({ min: 0, max: 10 }),
    borderColor: fc.constant('#ffffff'),
    shadowEnabled: fc.boolean(),
    backgroundBlur: fc.integer({ min: 0, max: 20 }),
  });

  it('bubble x position is always >= 0 for any position and size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.x).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('bubble y position is always >= 0 for any position and size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.y).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('bubble right edge (x + width) is always <= canvas width for any position and size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvasSize.width + 0.0001);
      }),
      { numRuns: 100 }
    );
  });

  it('bubble bottom edge (y + height) is always <= canvas height for any position and size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvasSize.height + 0.0001);
      }),
      { numRuns: 100 }
    );
  });

  it('bubble remains fully within canvas bounds for any position and size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        // Left edge should be >= 0
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        // Top edge should be >= 0
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        // Right edge should be <= canvas width
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvasSize.width + 0.0001);
        // Bottom edge should be <= canvas height
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvasSize.height + 0.0001);
      }),
      { numRuns: 100 }
    );
  });

  it('bubble size is clamped to valid range [0.1, 0.4] for any input size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);
        const minDimension = Math.min(canvasSize.width, canvasSize.height);

        // Width should be within clamped size range
        const minWidth = minDimension * MIN_CAMERA_BUBBLE_SIZE;
        const maxWidth = minDimension * MAX_CAMERA_BUBBLE_SIZE;

        expect(bounds.width).toBeGreaterThanOrEqual(minWidth - 0.0001);
        expect(bounds.width).toBeLessThanOrEqual(maxWidth + 0.0001);
      }),
      { numRuns: 100 }
    );
  });

  it('bubble dimensions are always positive for any valid canvas size', () => {
    fc.assert(
      fc.property(cameraBubbleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.height).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('circle shape has equal width and height', () => {
    const circleConfig = fc.record({
      position: normalizedPosition,
      size: bubbleSize,
      shape: fc.constant('circle' as CameraBubbleShape),
      borderWidth: fc.integer({ min: 0, max: 10 }),
      borderColor: fc.constant('#ffffff'),
      shadowEnabled: fc.boolean(),
      backgroundBlur: fc.integer({ min: 0, max: 20 }),
    });

    fc.assert(
      fc.property(circleConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.width).toBeCloseTo(bounds.height, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('rounded-rect shape has height = width * 0.75', () => {
    const roundedRectConfig = fc.record({
      position: normalizedPosition,
      size: bubbleSize,
      shape: fc.constant('rounded-rect' as CameraBubbleShape),
      borderWidth: fc.integer({ min: 0, max: 10 }),
      borderColor: fc.constant('#ffffff'),
      shadowEnabled: fc.boolean(),
      backgroundBlur: fc.integer({ min: 0, max: 20 }),
    });

    fc.assert(
      fc.property(roundedRectConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        expect(bounds.height).toBeCloseTo(bounds.width * 0.75, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('extreme positions (corners) still keep bubble within bounds', () => {
    const extremePositions = fc.constantFrom(
      { x: 0, y: 0 },       // Top-left
      { x: 1, y: 0 },       // Top-right
      { x: 0, y: 1 },       // Bottom-left
      { x: 1, y: 1 },       // Bottom-right
      { x: 0.5, y: 0 },     // Top-center
      { x: 0.5, y: 1 },     // Bottom-center
      { x: 0, y: 0.5 },     // Left-center
      { x: 1, y: 0.5 }      // Right-center
    );

    const extremeConfig = fc.record({
      position: extremePositions,
      size: bubbleSize,
      shape: bubbleShape,
      borderWidth: fc.integer({ min: 0, max: 10 }),
      borderColor: fc.constant('#ffffff'),
      shadowEnabled: fc.boolean(),
      backgroundBlur: fc.integer({ min: 0, max: 20 }),
    });

    fc.assert(
      fc.property(extremeConfig, positiveCanvasSize, (config, canvasSize) => {
        const bounds = calculateCameraBubbleBounds(config, canvasSize);

        // Bubble should always be fully within canvas bounds
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvasSize.width + 0.0001);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvasSize.height + 0.0001);
      }),
      { numRuns: 100 }
    );
  });
});
