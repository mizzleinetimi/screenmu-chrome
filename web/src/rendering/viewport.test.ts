// Unit tests for viewport transformation utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  toCanvas,
  getSourceRect,
  sanitizeViewport,
  isDefaultViewport,
  DEFAULT_VIEWPORT,
} from './viewport';
import type { NormalizedCoord, Viewport } from '../types';
import type { Size } from './types';

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

// Use Math.fround to ensure 32-bit float compatibility with fast-check
const normalizedCoord = fc.record({
  x: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
  y: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
});

// Zoom is restricted to >= 1.0 because zoom < 1.0 (zoom out) is not supported.
// The viewport represents a crop region, and zoom < 1.0 would require showing
// more than the full video, which is not a valid use case.
const viewport = fc.record({
  center: normalizedCoord,
  zoom: fc.float({ min: Math.fround(1.0), max: Math.fround(10), noNaN: true }),
});

const videoSize = fc.record({
  width: fc.integer({ min: 1, max: 7680 }),  // Up to 8K resolution
  height: fc.integer({ min: 1, max: 4320 }),
});

// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * Property 1: Viewport Transform Correctness
 * **Validates: Requirements 1.2, 1.3, 2.7, 3.7, 4.2**
 *
 * For any viewport with center (cx, cy) and zoom z, and any source video dimensions (sw, sh),
 * the calculated source crop rectangle SHALL have:
 * - width = sw / z
 * - height = sh / z
 * - x = (cx * sw) - (width / 2), clamped to [0, sw - width]
 * - y = (cy * sh) - (height / 2), clamped to [0, sh - height]
 */
describe('Property 1: Viewport Transform Correctness', () => {
  it('crop width equals source width divided by zoom', () => {
    fc.assert(
      fc.property(viewport, videoSize, (vp, size) => {
        const result = getSourceRect(vp, size);
        const expectedWidth = size.width / vp.zoom;
        
        expect(result.width).toBeCloseTo(expectedWidth, 5);
      }),
      { numRuns: 20 }
    );
  });

  it('crop height equals source height divided by zoom', () => {
    fc.assert(
      fc.property(viewport, videoSize, (vp, size) => {
        const result = getSourceRect(vp, size);
        const expectedHeight = size.height / vp.zoom;
        
        expect(result.height).toBeCloseTo(expectedHeight, 5);
      }),
      { numRuns: 20 }
    );
  });

  it('crop x is correctly calculated and clamped', () => {
    fc.assert(
      fc.property(viewport, videoSize, (vp, size) => {
        const result = getSourceRect(vp, size);
        const cropWidth = size.width / vp.zoom;
        
        // Calculate expected x before clamping
        const rawX = (vp.center.x * size.width) - (cropWidth / 2);
        // Clamp to [0, sw - width]
        const maxX = Math.max(0, size.width - cropWidth);
        const expectedX = Math.max(0, Math.min(maxX, rawX));
        
        expect(result.x).toBeCloseTo(expectedX, 5);
      }),
      { numRuns: 20 }
    );
  });

  it('crop y is correctly calculated and clamped', () => {
    fc.assert(
      fc.property(viewport, videoSize, (vp, size) => {
        const result = getSourceRect(vp, size);
        const cropHeight = size.height / vp.zoom;
        
        // Calculate expected y before clamping
        const rawY = (vp.center.y * size.height) - (cropHeight / 2);
        // Clamp to [0, sh - height]
        const maxY = Math.max(0, size.height - cropHeight);
        const expectedY = Math.max(0, Math.min(maxY, rawY));
        
        expect(result.y).toBeCloseTo(expectedY, 5);
      }),
      { numRuns: 20 }
    );
  });

  it('crop rectangle stays within video bounds', () => {
    fc.assert(
      fc.property(viewport, videoSize, (vp, size) => {
        const result = getSourceRect(vp, size);
        
        // x must be >= 0
        expect(result.x).toBeGreaterThanOrEqual(0);
        // y must be >= 0
        expect(result.y).toBeGreaterThanOrEqual(0);
        // x + width must be <= source width
        expect(result.x + result.width).toBeLessThanOrEqual(size.width + 0.0001);
        // y + height must be <= source height
        expect(result.y + result.height).toBeLessThanOrEqual(size.height + 0.0001);
      }),
      { numRuns: 20 }
    );
  });

  it('all properties hold together for complete viewport transform', () => {
    fc.assert(
      fc.property(viewport, videoSize, (vp, size) => {
        const result = getSourceRect(vp, size);
        
        // Property: width = sw / z
        const expectedWidth = size.width / vp.zoom;
        expect(result.width).toBeCloseTo(expectedWidth, 5);
        
        // Property: height = sh / z
        const expectedHeight = size.height / vp.zoom;
        expect(result.height).toBeCloseTo(expectedHeight, 5);
        
        // Property: x = (cx * sw) - (width / 2), clamped to [0, sw - width]
        const rawX = (vp.center.x * size.width) - (expectedWidth / 2);
        const maxX = Math.max(0, size.width - expectedWidth);
        const expectedX = Math.max(0, Math.min(maxX, rawX));
        expect(result.x).toBeCloseTo(expectedX, 5);
        
        // Property: y = (cy * sh) - (height / 2), clamped to [0, sh - height]
        const rawY = (vp.center.y * size.height) - (expectedHeight / 2);
        const maxY = Math.max(0, size.height - expectedHeight);
        const expectedY = Math.max(0, Math.min(maxY, rawY));
        expect(result.y).toBeCloseTo(expectedY, 5);
      }),
      { numRuns: 20 }
    );
  });
});

describe('getSourceRect', () => {
  const videoSize: Size = { width: 1920, height: 1080 };

  describe('default viewport (zoom=1, center=0.5,0.5)', () => {
    it('returns full frame for default viewport', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 1.0 };
      const result = getSourceRect(viewport, videoSize);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });
  });

  describe('zoom behavior', () => {
    it('zoom=2 returns half-size crop centered', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 2.0 };
      const result = getSourceRect(viewport, videoSize);

      // width = 1920 / 2 = 960
      // height = 1080 / 2 = 540
      // x = (0.5 * 1920) - (960 / 2) = 960 - 480 = 480
      // y = (0.5 * 1080) - (540 / 2) = 540 - 270 = 270
      expect(result.width).toBe(960);
      expect(result.height).toBe(540);
      expect(result.x).toBe(480);
      expect(result.y).toBe(270);
    });

    it('very high zoom (10x) produces small source rect', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 10.0 };
      const result = getSourceRect(viewport, videoSize);

      // width = 1920 / 10 = 192
      // height = 1080 / 10 = 108
      expect(result.width).toBe(192);
      expect(result.height).toBe(108);
    });
  });

  describe('clamping to video bounds', () => {
    it('viewport at corner (center=0,0) clamps to top-left', () => {
      const viewport: Viewport = { center: { x: 0, y: 0 }, zoom: 2.0 };
      const result = getSourceRect(viewport, videoSize);

      // width = 960, height = 540
      // x = (0 * 1920) - 480 = -480, clamped to 0
      // y = (0 * 1080) - 270 = -270, clamped to 0
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(960);
      expect(result.height).toBe(540);
    });

    it('viewport at corner (center=1,1) clamps to bottom-right', () => {
      const viewport: Viewport = { center: { x: 1, y: 1 }, zoom: 2.0 };
      const result = getSourceRect(viewport, videoSize);

      // width = 960, height = 540
      // x = (1 * 1920) - 480 = 1440, clamped to 1920 - 960 = 960
      // y = (1 * 1080) - 270 = 810, clamped to 1080 - 540 = 540
      expect(result.x).toBe(960);
      expect(result.y).toBe(540);
      expect(result.width).toBe(960);
      expect(result.height).toBe(540);
    });

    it('viewport at edge (center=0.1,0.1) with high zoom clamps correctly', () => {
      const viewport: Viewport = { center: { x: 0.1, y: 0.1 }, zoom: 4.0 };
      const result = getSourceRect(viewport, videoSize);

      // width = 1920 / 4 = 480
      // height = 1080 / 4 = 270
      // x = (0.1 * 1920) - 240 = 192 - 240 = -48, clamped to 0
      // y = (0.1 * 1080) - 135 = 108 - 135 = -27, clamped to 0
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBe(480);
      expect(result.height).toBe(270);
    });
  });
});

describe('toCanvas', () => {
  const canvasSize: Size = { width: 1920, height: 1080 };

  describe('default viewport', () => {
    it('normalized center (0.5, 0.5) maps to canvas center', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 1.0 };
      const coord: NormalizedCoord = { x: 0.5, y: 0.5 };
      const result = toCanvas(coord, viewport, canvasSize);

      expect(result.x).toBe(960);
      expect(result.y).toBe(540);
    });

    it('normalized origin (0, 0) maps to canvas origin', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 1.0 };
      const coord: NormalizedCoord = { x: 0, y: 0 };
      const result = toCanvas(coord, viewport, canvasSize);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('normalized corner (1, 1) maps to canvas corner', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 1.0 };
      const coord: NormalizedCoord = { x: 1, y: 1 };
      const result = toCanvas(coord, viewport, canvasSize);

      expect(result.x).toBe(1920);
      expect(result.y).toBe(1080);
    });
  });

  describe('zoomed viewport', () => {
    it('viewport center maps to canvas center when zoomed', () => {
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 2.0 };
      const coord: NormalizedCoord = { x: 0.5, y: 0.5 };
      const result = toCanvas(coord, viewport, canvasSize);

      expect(result.x).toBe(960);
      expect(result.y).toBe(540);
    });

    it('point at viewport edge maps to canvas edge when zoomed', () => {
      // With zoom=2 and center at 0.5, visible range is [0.25, 0.75]
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 2.0 };
      const coord: NormalizedCoord = { x: 0.25, y: 0.25 };
      const result = toCanvas(coord, viewport, canvasSize);

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('point outside visible area maps outside canvas', () => {
      // With zoom=2 and center at 0.5, visible range is [0.25, 0.75]
      // Point at (0, 0) should map to negative canvas coords
      const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 2.0 };
      const coord: NormalizedCoord = { x: 0, y: 0 };
      const result = toCanvas(coord, viewport, canvasSize);

      // (0 - 0.25) / 0.5 * 1920 = -0.5 * 1920 = -960
      expect(result.x).toBe(-960);
      expect(result.y).toBe(-540);
    });
  });

  describe('panned viewport', () => {
    it('viewport center maps to canvas center when panned', () => {
      const viewport: Viewport = { center: { x: 0.3, y: 0.7 }, zoom: 1.0 };
      const coord: NormalizedCoord = { x: 0.3, y: 0.7 };
      const result = toCanvas(coord, viewport, canvasSize);

      expect(result.x).toBe(960);
      expect(result.y).toBe(540);
    });
  });
});

describe('sanitizeViewport', () => {
  it('returns original viewport when valid', () => {
    const viewport: Viewport = { center: { x: 0.3, y: 0.7 }, zoom: 2.5 };
    const result = sanitizeViewport(viewport);

    expect(result).toBe(viewport);
  });

  it('returns default viewport when zoom is zero', () => {
    const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 0 };
    const result = sanitizeViewport(viewport);

    expect(result).toEqual(DEFAULT_VIEWPORT);
  });

  it('returns default viewport when zoom is negative', () => {
    const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: -1 };
    const result = sanitizeViewport(viewport);

    expect(result).toEqual(DEFAULT_VIEWPORT);
  });

  it('returns default viewport when zoom is NaN', () => {
    const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: NaN };
    const result = sanitizeViewport(viewport);

    expect(result).toEqual(DEFAULT_VIEWPORT);
  });

  it('returns default viewport when center.x is outside [0,1]', () => {
    const viewport: Viewport = { center: { x: 1.5, y: 0.5 }, zoom: 1.0 };
    const result = sanitizeViewport(viewport);

    expect(result).toEqual(DEFAULT_VIEWPORT);
  });

  it('returns default viewport when center.y is outside [0,1]', () => {
    const viewport: Viewport = { center: { x: 0.5, y: -0.1 }, zoom: 1.0 };
    const result = sanitizeViewport(viewport);

    expect(result).toEqual(DEFAULT_VIEWPORT);
  });

  it('returns default viewport when center has NaN', () => {
    const viewport: Viewport = { center: { x: NaN, y: 0.5 }, zoom: 1.0 };
    const result = sanitizeViewport(viewport);

    expect(result).toEqual(DEFAULT_VIEWPORT);
  });
});

describe('isDefaultViewport', () => {
  it('returns true for default viewport', () => {
    const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 1.0 };
    expect(isDefaultViewport(viewport)).toBe(true);
  });

  it('returns false when zoom differs', () => {
    const viewport: Viewport = { center: { x: 0.5, y: 0.5 }, zoom: 2.0 };
    expect(isDefaultViewport(viewport)).toBe(false);
  });

  it('returns false when center.x differs', () => {
    const viewport: Viewport = { center: { x: 0.3, y: 0.5 }, zoom: 1.0 };
    expect(isDefaultViewport(viewport)).toBe(false);
  });

  it('returns false when center.y differs', () => {
    const viewport: Viewport = { center: { x: 0.5, y: 0.7 }, zoom: 1.0 };
    expect(isDefaultViewport(viewport)).toBe(false);
  });
});
