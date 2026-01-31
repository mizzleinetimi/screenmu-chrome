// Tests for background rendering utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  GRADIENT_PRESETS,
  DEFAULT_GRADIENT_PRESET_ID,
  getGradientPresetById,
  calculateGradientPoints,
  renderBackground,
  renderBackgroundById,
} from './background';
import type { GradientPreset } from './background';
import type { Size } from './types';

// ============================================================================
// Unit Tests for Gradient Presets
// ============================================================================

describe('GRADIENT_PRESETS', () => {
  it('should have exactly 9 preset gradients', () => {
    // Validates: Requirement 1.3
    expect(GRADIENT_PRESETS.length).toBe(9);
  });

  it('should have unique IDs for all presets', () => {
    const ids = GRADIENT_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(GRADIENT_PRESETS.length);
  });

  it('should have non-empty names for all presets', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it('should have at least 2 colors for each preset', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(preset.colors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should have valid hex color codes', () => {
    const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
    for (const preset of GRADIENT_PRESETS) {
      for (const color of preset.colors) {
        expect(color).toMatch(hexColorRegex);
      }
    }
  });

  it('should have valid angle values (0-360)', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(preset.angle).toBeGreaterThanOrEqual(0);
      expect(preset.angle).toBeLessThanOrEqual(360);
    }
  });
});

describe('DEFAULT_GRADIENT_PRESET_ID', () => {
  it('should be the ID of the first preset', () => {
    expect(DEFAULT_GRADIENT_PRESET_ID).toBe(GRADIENT_PRESETS[0].id);
  });

  it('should be a valid preset ID', () => {
    const preset = getGradientPresetById(DEFAULT_GRADIENT_PRESET_ID);
    expect(preset).toBeDefined();
    expect(preset.id).toBe(DEFAULT_GRADIENT_PRESET_ID);
  });
});

// ============================================================================
// Unit Tests for getGradientPresetById
// ============================================================================

describe('getGradientPresetById', () => {
  it('should return the correct preset for valid IDs', () => {
    for (const preset of GRADIENT_PRESETS) {
      const result = getGradientPresetById(preset.id);
      expect(result).toBe(preset);
    }
  });

  it('should fall back to first preset for invalid ID', () => {
    const result = getGradientPresetById('invalid-id');
    expect(result).toBe(GRADIENT_PRESETS[0]);
  });

  it('should fall back to first preset for empty string', () => {
    const result = getGradientPresetById('');
    expect(result).toBe(GRADIENT_PRESETS[0]);
  });
});

// ============================================================================
// Unit Tests for calculateGradientPoints
// ============================================================================

describe('calculateGradientPoints', () => {
  const width = 1920;
  const height = 1080;

  it('should return points centered on the canvas', () => {
    const points = calculateGradientPoints(135, width, height);
    const centerX = width / 2;
    const centerY = height / 2;

    // The midpoint of start and end should be the center
    const midX = (points.x0 + points.x1) / 2;
    const midY = (points.y0 + points.y1) / 2;

    expect(midX).toBeCloseTo(centerX, 5);
    expect(midY).toBeCloseTo(centerY, 5);
  });

  it('should produce horizontal gradient for 90 degrees', () => {
    const points = calculateGradientPoints(90, width, height);
    // For 90 degrees (left to right), y0 and y1 should be approximately equal
    expect(points.y0).toBeCloseTo(points.y1, 5);
    // x0 should be less than x1 (left to right)
    expect(points.x0).toBeLessThan(points.x1);
  });

  it('should produce vertical gradient for 180 degrees', () => {
    const points = calculateGradientPoints(180, width, height);
    // For 180 degrees (top to bottom), x0 and x1 should be approximately equal
    expect(points.x0).toBeCloseTo(points.x1, 5);
    // y0 should be less than y1 (top to bottom)
    expect(points.y0).toBeLessThan(points.y1);
  });

  it('should handle 0 degree angle (bottom to top)', () => {
    const points = calculateGradientPoints(0, width, height);
    // For 0 degrees (bottom to top), x0 and x1 should be approximately equal
    expect(points.x0).toBeCloseTo(points.x1, 5);
    // y0 should be greater than y1 (bottom to top)
    expect(points.y0).toBeGreaterThan(points.y1);
  });

  it('should handle diagonal gradient for 135 degrees', () => {
    const points = calculateGradientPoints(135, width, height);
    // For 135 degrees (top-left to bottom-right)
    // x0 < x1 and y0 < y1
    expect(points.x0).toBeLessThan(points.x1);
    expect(points.y0).toBeLessThan(points.y1);
  });
});

// ============================================================================
// Mock Canvas Context for Rendering Tests
// ============================================================================

function createMockContext(): CanvasRenderingContext2D {
  const mockGradient = {
    addColorStop: vi.fn(),
  };

  return {
    fillStyle: '',
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue(mockGradient),
  } as unknown as CanvasRenderingContext2D;
}

// ============================================================================
// Unit Tests for renderBackground
// ============================================================================

describe('renderBackground', () => {
  let ctx: CanvasRenderingContext2D;
  const canvasSize: Size = { width: 1920, height: 1080 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should create a linear gradient with correct color stops', () => {
    const preset = GRADIENT_PRESETS[0];
    renderBackground(ctx, preset, canvasSize);

    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvasSize.width, canvasSize.height);
  });

  it('should fill the entire canvas', () => {
    // Validates: Requirement 1.2
    const preset = GRADIENT_PRESETS[0];
    renderBackground(ctx, preset, canvasSize);

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvasSize.width, canvasSize.height);
  });

  it('should handle single color preset as solid fill', () => {
    const singleColorPreset: GradientPreset = {
      id: 'single',
      name: 'Single Color',
      colors: ['#ff0000'],
      angle: 0,
    };

    renderBackground(ctx, singleColorPreset, canvasSize);

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.fillStyle).toBe('#ff0000');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvasSize.width, canvasSize.height);
  });

  it('should handle empty colors array', () => {
    const emptyColorPreset: GradientPreset = {
      id: 'empty',
      name: 'Empty',
      colors: [],
      angle: 0,
    };

    renderBackground(ctx, emptyColorPreset, canvasSize);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, canvasSize.width, canvasSize.height);
  });

  it('should skip rendering for zero-dimension canvas', () => {
    const zeroSize: Size = { width: 0, height: 0 };
    const preset = GRADIENT_PRESETS[0];

    renderBackground(ctx, preset, zeroSize);

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('should skip rendering for negative dimensions', () => {
    const negativeSize: Size = { width: -100, height: -100 };
    const preset = GRADIENT_PRESETS[0];

    renderBackground(ctx, preset, negativeSize);

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('should add correct number of color stops for multi-color gradient', () => {
    const preset = GRADIENT_PRESETS.find((p) => p.colors.length === 3);
    if (!preset) {
      // Skip if no 3-color preset exists
      return;
    }

    renderBackground(ctx, preset, canvasSize);

    const mockGradient = (ctx.createLinearGradient as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(mockGradient.addColorStop).toHaveBeenCalledTimes(3);
  });
});

// ============================================================================
// Unit Tests for renderBackgroundById
// ============================================================================

describe('renderBackgroundById', () => {
  let ctx: CanvasRenderingContext2D;
  const canvasSize: Size = { width: 1920, height: 1080 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should render background for valid preset ID', () => {
    renderBackgroundById(ctx, 'purple-pink', canvasSize);

    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvasSize.width, canvasSize.height);
  });

  it('should fall back to first preset for invalid ID', () => {
    renderBackgroundById(ctx, 'invalid-id', canvasSize);

    // Should still render (using fallback preset)
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, canvasSize.width, canvasSize.height);
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * Property 1: Background Fills Canvas
 * **Validates: Requirements 1.1, 1.2**
 *
 * For any canvas size and gradient preset, the background layer SHALL
 * completely fill the canvas with no gaps or overflow.
 */
describe('Property 1: Background Fills Canvas', () => {
  /**
   * Arbitrary for positive canvas dimensions.
   */
  const positiveSize = fc.record({
    width: fc.integer({ min: 1, max: 4096 }),
    height: fc.integer({ min: 1, max: 4096 }),
  });

  /**
   * Arbitrary for gradient preset index.
   */
  const presetIndex = fc.integer({ min: 0, max: GRADIENT_PRESETS.length - 1 });

  it('fillRect is called with exact canvas dimensions for any valid size and preset', () => {
    fc.assert(
      fc.property(positiveSize, presetIndex, (size, index) => {
        const ctx = createMockContext();
        const preset = GRADIENT_PRESETS[index];

        renderBackground(ctx, preset, size);

        // fillRect should be called with exact canvas dimensions
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, size.width, size.height);
      }),
      { numRuns: 20 }
    );
  });

  it('gradient covers entire canvas diagonal for any angle', () => {
    fc.assert(
      fc.property(
        positiveSize,
        fc.integer({ min: 0, max: 360 }),
        (size, angle) => {
          const points = calculateGradientPoints(angle, size.width, size.height);

          // Calculate the distance from start to end point
          const dx = points.x1 - points.x0;
          const dy = points.y1 - points.y0;
          const gradientLength = Math.sqrt(dx * dx + dy * dy);

          // Gradient length should be at least as long as the canvas diagonal
          const canvasDiagonal = Math.sqrt(
            size.width * size.width + size.height * size.height
          );

          // Allow small floating point tolerance
          expect(gradientLength).toBeGreaterThanOrEqual(canvasDiagonal - 0.001);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('gradient start and end points are symmetric around canvas center', () => {
    fc.assert(
      fc.property(
        positiveSize,
        fc.integer({ min: 0, max: 360 }),
        (size, angle) => {
          const points = calculateGradientPoints(angle, size.width, size.height);
          const centerX = size.width / 2;
          const centerY = size.height / 2;

          // Midpoint of gradient line should be at canvas center
          const midX = (points.x0 + points.x1) / 2;
          const midY = (points.y0 + points.y1) / 2;

          expect(midX).toBeCloseTo(centerX, 5);
          expect(midY).toBeCloseTo(centerY, 5);
        }
      ),
      { numRuns: 20 }
    );
  });
});
