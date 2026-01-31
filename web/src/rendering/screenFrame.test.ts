// Tests for screen frame rendering utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  DEFAULT_SCREEN_FRAME_CONFIG,
  calculateInsetRect,
  renderScreenFrame,
  createScreenFrameConfig,
} from './screenFrame';
import type { Size } from './types';
import type { Viewport } from '../types';

// ============================================================================
// Unit Tests for DEFAULT_SCREEN_FRAME_CONFIG
// ============================================================================

describe('DEFAULT_SCREEN_FRAME_CONFIG', () => {
  it('should have default corner radius of 12', () => {
    // Validates: Requirement 2.1
    expect(DEFAULT_SCREEN_FRAME_CONFIG.cornerRadius).toBe(12);
  });

  it('should have default shadow blur of 32', () => {
    // Validates: Requirement 2.3
    expect(DEFAULT_SCREEN_FRAME_CONFIG.shadowBlur).toBe(32);
  });

  it('should have default shadow offset Y of 8', () => {
    expect(DEFAULT_SCREEN_FRAME_CONFIG.shadowOffsetY).toBe(8);
  });

  it('should have default shadow opacity of 0.3', () => {
    expect(DEFAULT_SCREEN_FRAME_CONFIG.shadowOpacity).toBe(0.3);
  });

  it('should have default padding of 0.05 (5%)', () => {
    // Validates: Requirement 2.4
    expect(DEFAULT_SCREEN_FRAME_CONFIG.padding).toBe(0.05);
  });

  it('should have shadow enabled by default', () => {
    expect(DEFAULT_SCREEN_FRAME_CONFIG.shadowEnabled).toBe(true);
  });
});

// ============================================================================
// Unit Tests for calculateInsetRect
// ============================================================================

describe('calculateInsetRect', () => {
  const canvasSize: Size = { width: 1920, height: 1080 };

  it('should calculate correct inset for 5% padding', () => {
    // Validates: Requirement 2.4
    const padding = 0.05;
    const result = calculateInsetRect(padding, canvasSize);

    expect(result.x).toBe(1920 * 0.05);
    expect(result.y).toBe(1080 * 0.05);
    expect(result.width).toBe(1920 * (1 - 2 * 0.05));
    expect(result.height).toBe(1080 * (1 - 2 * 0.05));
  });

  it('should calculate correct inset for 10% padding', () => {
    const padding = 0.1;
    const result = calculateInsetRect(padding, canvasSize);

    expect(result.x).toBe(192); // 1920 * 0.1
    expect(result.y).toBe(108); // 1080 * 0.1
    expect(result.width).toBe(1536); // 1920 * 0.8
    expect(result.height).toBe(864); // 1080 * 0.8
  });

  it('should return full canvas for 0% padding', () => {
    const padding = 0;
    const result = calculateInsetRect(padding, canvasSize);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('should clamp negative padding to 0', () => {
    const padding = -0.1;
    const result = calculateInsetRect(padding, canvasSize);

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });

  it('should clamp padding above 0.49 to prevent negative dimensions', () => {
    const padding = 0.6;
    const result = calculateInsetRect(padding, canvasSize);

    // Should be clamped to 0.49
    expect(result.x).toBeCloseTo(1920 * 0.49);
    expect(result.y).toBeCloseTo(1080 * 0.49);
    expect(result.width).toBeCloseTo(1920 * (1 - 2 * 0.49));
    expect(result.height).toBeCloseTo(1080 * (1 - 2 * 0.49));
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('should handle small canvas sizes', () => {
    const smallCanvas: Size = { width: 100, height: 100 };
    const padding = 0.1;
    const result = calculateInsetRect(padding, smallCanvas);

    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    expect(result.width).toBe(80);
    expect(result.height).toBe(80);
  });

  it('should handle non-square canvas', () => {
    const wideCanvas: Size = { width: 1920, height: 800 };
    const padding = 0.05;
    const result = calculateInsetRect(padding, wideCanvas);

    expect(result.x).toBe(96); // 1920 * 0.05
    expect(result.y).toBe(40); // 800 * 0.05
    expect(result.width).toBe(1728); // 1920 * 0.9
    expect(result.height).toBe(720); // 800 * 0.9
  });
});

// ============================================================================
// Unit Tests for createScreenFrameConfig
// ============================================================================

describe('createScreenFrameConfig', () => {
  it('should return default config when no overrides provided', () => {
    const config = createScreenFrameConfig();
    expect(config).toEqual(DEFAULT_SCREEN_FRAME_CONFIG);
  });

  it('should override specific values while keeping defaults', () => {
    const config = createScreenFrameConfig({ cornerRadius: 20 });

    expect(config.cornerRadius).toBe(20);
    expect(config.shadowBlur).toBe(DEFAULT_SCREEN_FRAME_CONFIG.shadowBlur);
    expect(config.padding).toBe(DEFAULT_SCREEN_FRAME_CONFIG.padding);
  });

  it('should allow overriding multiple values', () => {
    const config = createScreenFrameConfig({
      cornerRadius: 24,
      shadowBlur: 48,
      shadowEnabled: false,
    });

    expect(config.cornerRadius).toBe(24);
    expect(config.shadowBlur).toBe(48);
    expect(config.shadowEnabled).toBe(false);
    expect(config.padding).toBe(DEFAULT_SCREEN_FRAME_CONFIG.padding);
  });
});

// ============================================================================
// Mock Canvas Context for Rendering Tests
// ============================================================================

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
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
// Unit Tests for renderScreenFrame
// ============================================================================

describe('renderScreenFrame', () => {
  let ctx: CanvasRenderingContext2D;
  const canvasSize: Size = { width: 1920, height: 1080 };
  const defaultViewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 1.0 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should render video frame with clipping', () => {
    const video = createMockVideo(1920, 1080);
    const config = DEFAULT_SCREEN_FRAME_CONFIG;

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    // Should save/restore context for clipping
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    // Should create clip path
    expect(ctx.clip).toHaveBeenCalled();
    // Should draw the video
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('should render drop shadow when enabled', () => {
    const video = createMockVideo(1920, 1080);
    const config = createScreenFrameConfig({ shadowEnabled: true });

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    // Shadow should be rendered (fill is called for shadow)
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('should not render drop shadow when disabled', () => {
    const video = createMockVideo(1920, 1080);
    const config = createScreenFrameConfig({ shadowEnabled: false });

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    // Shadow fill should not be called
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('should skip rendering for zero-dimension canvas', () => {
    const video = createMockVideo(1920, 1080);
    const config = DEFAULT_SCREEN_FRAME_CONFIG;
    const zeroCanvas: Size = { width: 0, height: 0 };

    renderScreenFrame(ctx, video, defaultViewport, config, zeroCanvas);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('should skip rendering for zero-dimension video', () => {
    const video = createMockVideo(0, 0);
    const config = DEFAULT_SCREEN_FRAME_CONFIG;

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('should skip rendering for negative canvas dimensions', () => {
    const video = createMockVideo(1920, 1080);
    const config = DEFAULT_SCREEN_FRAME_CONFIG;
    const negativeCanvas: Size = { width: -100, height: -100 };

    renderScreenFrame(ctx, video, defaultViewport, config, negativeCanvas);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('should draw video at inset position', () => {
    const video = createMockVideo(1920, 1080);
    const config = createScreenFrameConfig({ padding: 0.1 });

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    // drawImage should be called with inset destination coordinates
    const drawImageCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
    // Destination x, y should be at inset position (192, 108 for 10% padding)
    expect(drawImageCall[5]).toBe(192); // dest x
    expect(drawImageCall[6]).toBe(108); // dest y
    expect(drawImageCall[7]).toBe(1536); // dest width
    expect(drawImageCall[8]).toBe(864); // dest height
  });

  it('should create rounded rectangle path for clipping', () => {
    const video = createMockVideo(1920, 1080);
    const config = createScreenFrameConfig({ cornerRadius: 20 });

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    // Should use arcTo for rounded corners
    expect(ctx.arcTo).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalled();
  });

  it('should handle zero corner radius', () => {
    const video = createMockVideo(1920, 1080);
    const config = createScreenFrameConfig({ cornerRadius: 0 });

    renderScreenFrame(ctx, video, defaultViewport, config, canvasSize);

    // Should use rect instead of arcTo for zero radius
    expect(ctx.rect).toHaveBeenCalled();
    expect(ctx.arcTo).not.toHaveBeenCalled();
  });

  it('should apply viewport transformation to source rect', () => {
    const video = createMockVideo(1920, 1080);
    const config = DEFAULT_SCREEN_FRAME_CONFIG;
    const zoomedViewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 2.0 };

    renderScreenFrame(ctx, video, zoomedViewport, config, canvasSize);

    // drawImage should be called with cropped source coordinates
    const drawImageCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
    // Source width/height should be half of video (zoom 2x)
    expect(drawImageCall[3]).toBe(960); // source width = 1920 / 2
    expect(drawImageCall[4]).toBe(540); // source height = 1080 / 2
  });
});


// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * Property 2: Screen Frame Inset
 * **Validates: Requirements 2.4**
 *
 * For any padding value P and canvas size (W, H), the screen frame SHALL be positioned at:
 * - x = W * P
 * - y = H * P
 * - width = W * (1 - 2P)
 * - height = H * (1 - 2P)
 */
describe('Property 2: Screen Frame Inset', () => {
  /**
   * Arbitrary for positive canvas dimensions.
   * Using reasonable bounds for canvas sizes (1 to 4096 pixels).
   */
  const positiveCanvasSize = fc.record({
    width: fc.integer({ min: 1, max: 4096 }),
    height: fc.integer({ min: 1, max: 4096 }),
  });

  /**
   * Arbitrary for valid padding values.
   * Padding is a fraction from 0 to just under 0.5 (exclusive).
   * Values >= 0.5 would result in zero or negative dimensions.
   */
  const validPadding = fc.double({ min: 0, max: 0.49, noNaN: true });

  it('inset x position equals W * P for any valid padding and canvas size', () => {
    fc.assert(
      fc.property(validPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);
        const expectedX = canvasSize.width * padding;

        expect(result.x).toBeCloseTo(expectedX, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('inset y position equals H * P for any valid padding and canvas size', () => {
    fc.assert(
      fc.property(validPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);
        const expectedY = canvasSize.height * padding;

        expect(result.y).toBeCloseTo(expectedY, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('inset width equals W * (1 - 2P) for any valid padding and canvas size', () => {
    fc.assert(
      fc.property(validPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);
        const expectedWidth = canvasSize.width * (1 - 2 * padding);

        expect(result.width).toBeCloseTo(expectedWidth, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('inset height equals H * (1 - 2P) for any valid padding and canvas size', () => {
    fc.assert(
      fc.property(validPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);
        const expectedHeight = canvasSize.height * (1 - 2 * padding);

        expect(result.height).toBeCloseTo(expectedHeight, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('inset rectangle always has positive dimensions for valid padding', () => {
    fc.assert(
      fc.property(validPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);

        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('inset rectangle stays within canvas bounds for any valid padding', () => {
    fc.assert(
      fc.property(validPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);

        // Left edge should be >= 0
        expect(result.x).toBeGreaterThanOrEqual(0);
        // Top edge should be >= 0
        expect(result.y).toBeGreaterThanOrEqual(0);
        // Right edge should be <= canvas width
        expect(result.x + result.width).toBeLessThanOrEqual(canvasSize.width + 0.0001);
        // Bottom edge should be <= canvas height
        expect(result.y + result.height).toBeLessThanOrEqual(canvasSize.height + 0.0001);
      }),
      { numRuns: 100 }
    );
  });

  it('padding is clamped for out-of-range values', () => {
    /**
     * Arbitrary for invalid padding values (negative or >= 0.5).
     */
    const invalidPadding = fc.oneof(
      fc.double({ min: -1, max: -0.001, noNaN: true }),
      fc.double({ min: 0.5, max: 1, noNaN: true })
    );

    fc.assert(
      fc.property(invalidPadding, positiveCanvasSize, (padding, canvasSize) => {
        const result = calculateInsetRect(padding, canvasSize);

        // Result should always have positive dimensions due to clamping
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
        // Result should stay within canvas bounds
        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.y).toBeGreaterThanOrEqual(0);
        expect(result.x + result.width).toBeLessThanOrEqual(canvasSize.width + 0.0001);
        expect(result.y + result.height).toBeLessThanOrEqual(canvasSize.height + 0.0001);
      }),
      { numRuns: 50 }
    );
  });
});
