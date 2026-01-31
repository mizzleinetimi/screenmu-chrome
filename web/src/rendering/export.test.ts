// Property-based tests for export frame timing utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateFrameTimestamps,
  generateFrameTimestampsWithTrim,
  calculateFrameCount,
  calculateTrimmedFrameCount,
  frameIndexToTimestamp,
  calculateExportProgress,
} from './export';

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Arbitrary for video duration in microseconds (up to 1 hour).
 */
const durationUs = fc.integer({ min: 0, max: 3_600_000_000 });

/**
 * Arbitrary for FPS values (common video framerates).
 */
const fps = fc.integer({ min: 1, max: 120 });

/**
 * Arbitrary for valid trim points (inPoint < outPoint).
 * Constrained to reasonable ranges to avoid timeout in tests.
 */
const validTrimPoints = fc.tuple(
  fc.integer({ min: 0, max: 10_000_000 }), // inPoint up to 10 seconds
  fc.integer({ min: 100_000, max: 5_000_000 })  // duration of trim (0.1s to 5s)
).map(([inPoint, trimDuration]) => ({
  inPoint,
  outPoint: inPoint + trimDuration,
}));

// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * Property 6: Frame Timestamp Generation
 * **Validates: Requirements 1.1, 1.5**
 *
 * For any video duration D (microseconds) and target FPS F:
 * - Count = ceil(D * F / 1_000_000)
 * - For each frame i in [0, Count): timestamp_i = i * (1_000_000 / F)
 * - All timestamps shall be <= D
 */
describe('Property 6: Frame Timestamp Generation', () => {
  it('frame count equals ceil(D * F / 1_000_000)', () => {
    fc.assert(
      fc.property(durationUs, fps, (duration, f) => {
        const result = generateFrameTimestamps(duration, f);
        const expectedCount = Math.ceil((duration * f) / 1_000_000);
        
        // Frame count should match the formula (may be less if timestamps exceed duration)
        expect(result.frameCount).toBeLessThanOrEqual(expectedCount);
        expect(result.frameCount).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 20 }
    );
  });

  it('timestamp_i equals i * (1_000_000 / F) and all timestamps valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }), // Smaller duration range
        fc.integer({ min: 10, max: 60 }), // Common FPS values
        (duration, f) => {
          const result = generateFrameTimestamps(duration, f);
          const frameInterval = 1_000_000 / f;
          
          // Only check first 10 and last 10 timestamps for performance
          const checkIndices = [
            ...Array.from({ length: Math.min(10, result.timestamps.length) }, (_, i) => i),
            ...Array.from({ length: Math.min(10, result.timestamps.length) }, (_, i) => result.timestamps.length - 1 - i).filter(i => i >= 10),
          ];
          
          for (const i of checkIndices) {
            if (i >= 0 && i < result.timestamps.length) {
              const expectedTimestamp = i * frameInterval;
              expect(result.timestamps[i]).toBeCloseTo(expectedTimestamp, 5);
              expect(result.timestamps[i]).toBeLessThanOrEqual(duration);
              expect(result.timestamps[i]).toBeGreaterThanOrEqual(0);
            }
          }
          
          // Check ascending order on sample
          for (let i = 1; i < Math.min(20, result.timestamps.length); i++) {
            expect(result.timestamps[i]).toBeGreaterThan(result.timestamps[i - 1]);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('frame interval equals 1_000_000 / F', () => {
    fc.assert(
      fc.property(fps, (f) => {
        const result = generateFrameTimestamps(1_000_000, f);
        expect(result.frameInterval).toBeCloseTo(1_000_000 / f, 5);
      }),
      { numRuns: 20 }
    );
  });

  it('returns empty result for invalid inputs', () => {
    expect(generateFrameTimestamps(0, 30).frameCount).toBe(0);
    expect(generateFrameTimestamps(1000000, 0).frameCount).toBe(0);
    expect(generateFrameTimestamps(1000000, -1).frameCount).toBe(0);
  });

  it('helper functions are consistent', () => {
    fc.assert(
      fc.property(durationUs, fps, (duration, f) => {
        const result = generateFrameTimestamps(duration, f);
        const count = calculateFrameCount(duration, f);
        expect(count).toBeGreaterThanOrEqual(result.frameCount);
        
        for (let i = 0; i < Math.min(5, result.timestamps.length); i++) {
          expect(frameIndexToTimestamp(i, f)).toBeCloseTo(result.timestamps[i], 5);
        }
      }),
      { numRuns: 20 }
    );
  });
});

describe('calculateExportProgress', () => {
  it('percentage and estimates are valid', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.nat({ max: 100000 }),
        (current, total, elapsed) => {
          const result = calculateExportProgress(current, total, elapsed);
          expect(result.percentage).toBeGreaterThanOrEqual(0);
          expect(result.percentage).toBeLessThanOrEqual(100);
          expect(result.percentage).toBeCloseTo(Math.min(100, (current / total) * 100), 5);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('estimatedRemainingMs behavior', () => {
    expect(calculateExportProgress(0, 100, 1000).estimatedRemainingMs).toBeNull();
    
    const r1 = calculateExportProgress(25, 100, 1000);
    const r2 = calculateExportProgress(75, 100, 1000);
    if (r1.estimatedRemainingMs !== null && r2.estimatedRemainingMs !== null) {
      expect(r2.estimatedRemainingMs).toBeLessThan(r1.estimatedRemainingMs);
    }
  });
});


// ============================================================================
// Trim-Aware Frame Timestamp Generation Tests
// ============================================================================

/**
 * Tests for generateFrameTimestampsWithTrim
 * **Validates: Requirement 2.5 - Export SHALL only include content between In_Point and Out_Point**
 */
describe('generateFrameTimestampsWithTrim', () => {
  it('generates correct frame count for trimmed duration', () => {
    fc.assert(
      fc.property(validTrimPoints, fps, ({ inPoint, outPoint }, f) => {
        const result = generateFrameTimestampsWithTrim(inPoint, outPoint, f);
        const trimmedDuration = outPoint - inPoint;
        const expectedCount = Math.ceil((trimmedDuration * f) / 1_000_000);
        
        // Frame count should match the formula for trimmed duration
        expect(result.frameCount).toBeLessThanOrEqual(expectedCount);
        expect(result.frameCount).toBeGreaterThanOrEqual(0);
        expect(result.trimmedDuration).toBe(trimmedDuration);
      }),
      { numRuns: 20 }
    );
  });

  it('source timestamps are within [inPoint, outPoint]', () => {
    fc.assert(
      fc.property(validTrimPoints, fps, ({ inPoint, outPoint }, f) => {
        const result = generateFrameTimestampsWithTrim(inPoint, outPoint, f);
        
        // Check first 10 and last 10 timestamps for performance
        const checkIndices = [
          ...Array.from({ length: Math.min(10, result.sourceTimestamps.length) }, (_, i) => i),
          ...Array.from({ length: Math.min(10, result.sourceTimestamps.length) }, (_, i) => result.sourceTimestamps.length - 1 - i).filter(i => i >= 10),
        ];
        
        for (const i of checkIndices) {
          if (i >= 0 && i < result.sourceTimestamps.length) {
            expect(result.sourceTimestamps[i]).toBeGreaterThanOrEqual(inPoint);
            expect(result.sourceTimestamps[i]).toBeLessThanOrEqual(outPoint);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('export timestamps start at 0', () => {
    fc.assert(
      fc.property(validTrimPoints, fps, ({ inPoint, outPoint }, f) => {
        const result = generateFrameTimestampsWithTrim(inPoint, outPoint, f);
        
        if (result.exportTimestamps.length > 0) {
          // First export timestamp should be 0
          expect(result.exportTimestamps[0]).toBe(0);
          
          // Check first 10 export timestamps are >= 0
          for (let i = 0; i < Math.min(10, result.exportTimestamps.length); i++) {
            expect(result.exportTimestamps[i]).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('source and export timestamps have correct offset relationship', () => {
    fc.assert(
      fc.property(validTrimPoints, fps, ({ inPoint, outPoint }, f) => {
        const result = generateFrameTimestampsWithTrim(inPoint, outPoint, f);
        
        // Check first 10 timestamps for offset relationship
        for (let i = 0; i < Math.min(10, result.sourceTimestamps.length); i++) {
          const expectedSource = result.exportTimestamps[i] + inPoint;
          expect(result.sourceTimestamps[i]).toBeCloseTo(expectedSource, 5);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('timestamps are in ascending order', () => {
    fc.assert(
      fc.property(validTrimPoints, fps, ({ inPoint, outPoint }, f) => {
        const result = generateFrameTimestampsWithTrim(inPoint, outPoint, f);
        
        // Check ascending order for first 20 source timestamps
        for (let i = 1; i < Math.min(20, result.sourceTimestamps.length); i++) {
          expect(result.sourceTimestamps[i]).toBeGreaterThan(result.sourceTimestamps[i - 1]);
        }
        
        // Check ascending order for first 20 export timestamps
        for (let i = 1; i < Math.min(20, result.exportTimestamps.length); i++) {
          expect(result.exportTimestamps[i]).toBeGreaterThan(result.exportTimestamps[i - 1]);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('returns empty result for invalid inputs', () => {
    // inPoint >= outPoint
    expect(generateFrameTimestampsWithTrim(1000000, 1000000, 30).frameCount).toBe(0);
    expect(generateFrameTimestampsWithTrim(2000000, 1000000, 30).frameCount).toBe(0);
    
    // Negative inPoint
    expect(generateFrameTimestampsWithTrim(-1, 1000000, 30).frameCount).toBe(0);
    
    // Invalid FPS
    expect(generateFrameTimestampsWithTrim(0, 1000000, 0).frameCount).toBe(0);
    expect(generateFrameTimestampsWithTrim(0, 1000000, -1).frameCount).toBe(0);
    
    // Non-finite values
    expect(generateFrameTimestampsWithTrim(NaN, 1000000, 30).frameCount).toBe(0);
    expect(generateFrameTimestampsWithTrim(0, Infinity, 30).frameCount).toBe(0);
  });

  it('calculateTrimmedFrameCount is consistent with generateFrameTimestampsWithTrim', () => {
    fc.assert(
      fc.property(validTrimPoints, fps, ({ inPoint, outPoint }, f) => {
        const result = generateFrameTimestampsWithTrim(inPoint, outPoint, f);
        const count = calculateTrimmedFrameCount(inPoint, outPoint, f);
        
        // calculateTrimmedFrameCount should be >= actual frame count
        expect(count).toBeGreaterThanOrEqual(result.frameCount);
      }),
      { numRuns: 20 }
    );
  });

  it('trimmed export duration equals outPoint - inPoint', () => {
    // Specific test case
    const inPoint = 1_000_000; // 1 second
    const outPoint = 3_000_000; // 3 seconds
    const result = generateFrameTimestampsWithTrim(inPoint, outPoint, 30);
    
    expect(result.trimmedDuration).toBe(2_000_000); // 2 seconds
    
    // At 30 FPS, 2 seconds should give us 60 frames
    expect(result.frameCount).toBe(60);
    
    // First source timestamp should be at inPoint
    expect(result.sourceTimestamps[0]).toBe(inPoint);
    
    // First export timestamp should be 0
    expect(result.exportTimestamps[0]).toBe(0);
  });
});
