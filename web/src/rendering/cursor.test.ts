// Property-based tests for cursor interpolation utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { interpolateCursor, calculateCursorOpacity, CONFIDENCE_THRESHOLD } from './cursor';
import type { CursorTrackPoint, CursorState, NormalizedCoord } from '../types';

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Arbitrary for normalized coordinates (0-1 range).
 * Uses Math.fround for 32-bit float compatibility with fast-check.
 */
const normalizedCoord = fc.record({
  x: fc.float({ min: 0, max: 1, noNaN: true }),
  y: fc.float({ min: 0, max: 1, noNaN: true }),
});

/**
 * Arbitrary for cursor state.
 */
const cursorState = fc.constantFrom<CursorState>('Visible', 'Hidden', 'Inferred');

/**
 * Arbitrary for cursor track point.
 */
const cursorTrackPoint = fc.record({
  timestamp: fc.nat({ max: 10_000_000 }),
  position: normalizedCoord,
  state: cursorState,
  confidence: fc.nat({ max: 100 }),
  reason: fc.constant('DirectInput'),
});

/**
 * Arbitrary for a sorted cursor track with at least two points.
 * Ensures timestamps are strictly increasing.
 */
const sortedCursorTrack = fc
  .array(cursorTrackPoint, { minLength: 2, maxLength: 50 })
  .map((points) => {
    // Sort by timestamp and ensure strictly increasing timestamps
    const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
    // Make timestamps strictly increasing by adding index offset
    return sorted.map((point, index) => ({
      ...point,
      timestamp: point.timestamp + index * 1000, // Ensure at least 1000us gap
    }));
  });

/**
 * Arbitrary for timestamps within a reasonable range.
 */
const timestamp = fc.nat({ max: 15_000_000 });

// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * Property 4: Cursor Position Interpolation
 * **Validates: Requirements 3.2, 3.3, 3.9**
 *
 * For any cursor track with at least two points, and any timestamp T between
 * the first and last track points, the interpolated position SHALL be:
 * - If T exactly matches a track point, return that point's position
 * - Otherwise, find adjacent points (p1, p2) where p1.timestamp <= T < p2.timestamp
 * - Return linear interpolation: position = p1.position + (p2.position - p1.position)
 *   * ((T - p1.timestamp) / (p2.timestamp - p1.timestamp))
 */
describe('Property 4: Cursor Position Interpolation', () => {
  it('returns exact position when timestamp matches a track point', () => {
    fc.assert(
      fc.property(sortedCursorTrack, (track) => {
        // Pick a random point from the track
        const randomIndex = Math.floor(Math.random() * track.length);
        const point = track[randomIndex];
        
        const result = interpolateCursor(track, point.timestamp);
        
        expect(result).not.toBeNull();
        if (result) {
          expect(result.position.x).toBeCloseTo(point.position.x, 10);
          expect(result.position.y).toBeCloseTo(point.position.y, 10);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('returns first point position when timestamp is before first point', () => {
    fc.assert(
      fc.property(
        sortedCursorTrack.filter((track) => track[0].timestamp > 0),
        (track) => {
          const beforeFirst = track[0].timestamp - 1;
          const result = interpolateCursor(track, beforeFirst);
          
          expect(result).not.toBeNull();
          if (result) {
            expect(result.position.x).toBeCloseTo(track[0].position.x, 10);
            expect(result.position.y).toBeCloseTo(track[0].position.y, 10);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('returns last point position when timestamp is after last point', () => {
    fc.assert(
      fc.property(sortedCursorTrack, (track) => {
        const lastPoint = track[track.length - 1];
        const afterLast = lastPoint.timestamp + 1;
        const result = interpolateCursor(track, afterLast);
        
        expect(result).not.toBeNull();
        if (result) {
          expect(result.position.x).toBeCloseTo(lastPoint.position.x, 10);
          expect(result.position.y).toBeCloseTo(lastPoint.position.y, 10);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('interpolates position linearly between adjacent points', () => {
    fc.assert(
      fc.property(sortedCursorTrack, (track) => {
        // Find two adjacent points with different timestamps
        for (let i = 0; i < track.length - 1; i++) {
          const p1 = track[i];
          const p2 = track[i + 1];
          
          if (p2.timestamp <= p1.timestamp) continue;
          
          // Test at midpoint between p1 and p2
          const midTimestamp = p1.timestamp + Math.floor((p2.timestamp - p1.timestamp) / 2);
          
          // Skip if midTimestamp equals p1.timestamp (would be exact match)
          if (midTimestamp === p1.timestamp) continue;
          
          const result = interpolateCursor(track, midTimestamp);
          
          expect(result).not.toBeNull();
          if (result) {
            // Calculate expected interpolation factor
            const t = (midTimestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
            
            // Expected interpolated position
            const expectedX = p1.position.x + (p2.position.x - p1.position.x) * t;
            const expectedY = p1.position.y + (p2.position.y - p1.position.y) * t;
            
            expect(result.position.x).toBeCloseTo(expectedX, 10);
            expect(result.position.y).toBeCloseTo(expectedY, 10);
          }
          
          // Only test one pair per track to keep test fast
          break;
        }
      }),
      { numRuns: 20 }
    );
  });

  it('interpolation factor t is correctly calculated as (T - p1.timestamp) / (p2.timestamp - p1.timestamp)', () => {
    fc.assert(
      fc.property(
        sortedCursorTrack,
        fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
        (track, fraction) => {
          // Find two adjacent points
          for (let i = 0; i < track.length - 1; i++) {
            const p1 = track[i];
            const p2 = track[i + 1];
            
            if (p2.timestamp <= p1.timestamp) continue;
            
            // Calculate timestamp at given fraction between p1 and p2
            const duration = p2.timestamp - p1.timestamp;
            const targetTimestamp = p1.timestamp + Math.floor(duration * fraction);
            
            // Skip if it would be an exact match
            if (targetTimestamp === p1.timestamp || targetTimestamp >= p2.timestamp) continue;
            
            const result = interpolateCursor(track, targetTimestamp);
            
            expect(result).not.toBeNull();
            if (result) {
              // Calculate expected t
              const expectedT = (targetTimestamp - p1.timestamp) / (p2.timestamp - p1.timestamp);
              
              // Expected position using linear interpolation formula
              const expectedX = p1.position.x + (p2.position.x - p1.position.x) * expectedT;
              const expectedY = p1.position.y + (p2.position.y - p1.position.y) * expectedT;
              
              expect(result.position.x).toBeCloseTo(expectedX, 10);
              expect(result.position.y).toBeCloseTo(expectedY, 10);
            }
            
            break;
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('interpolated position is always within bounds of adjacent points', () => {
    fc.assert(
      fc.property(sortedCursorTrack, timestamp, (track, t) => {
        const result = interpolateCursor(track, t);
        
        if (!result) return true; // Empty track case
        
        // Find the bounding points
        const firstPoint = track[0];
        const lastPoint = track[track.length - 1];
        
        if (t <= firstPoint.timestamp) {
          // Should return first point
          expect(result.position.x).toBeCloseTo(firstPoint.position.x, 10);
          expect(result.position.y).toBeCloseTo(firstPoint.position.y, 10);
        } else if (t >= lastPoint.timestamp) {
          // Should return last point
          expect(result.position.x).toBeCloseTo(lastPoint.position.x, 10);
          expect(result.position.y).toBeCloseTo(lastPoint.position.y, 10);
        } else {
          // Find adjacent points
          let p1 = firstPoint;
          let p2 = lastPoint;
          
          for (let i = 0; i < track.length - 1; i++) {
            if (track[i].timestamp <= t && t < track[i + 1].timestamp) {
              p1 = track[i];
              p2 = track[i + 1];
              break;
            }
          }
          
          // Position should be between p1 and p2 (or equal to one of them)
          const minX = Math.min(p1.position.x, p2.position.x);
          const maxX = Math.max(p1.position.x, p2.position.x);
          const minY = Math.min(p1.position.y, p2.position.y);
          const maxY = Math.max(p1.position.y, p2.position.y);
          
          expect(result.position.x).toBeGreaterThanOrEqual(minX - 0.0001);
          expect(result.position.x).toBeLessThanOrEqual(maxX + 0.0001);
          expect(result.position.y).toBeGreaterThanOrEqual(minY - 0.0001);
          expect(result.position.y).toBeLessThanOrEqual(maxY + 0.0001);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('returns null for empty track', () => {
    const result = interpolateCursor([], 1000);
    expect(result).toBeNull();
  });

  it('returns single point for single-point track', () => {
    fc.assert(
      fc.property(cursorTrackPoint, timestamp, (point, t) => {
        const result = interpolateCursor([point], t);
        
        expect(result).not.toBeNull();
        if (result) {
          expect(result.position.x).toBeCloseTo(point.position.x, 10);
          expect(result.position.y).toBeCloseTo(point.position.y, 10);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('finds correct adjacent points where p1.timestamp <= T < p2.timestamp', () => {
    fc.assert(
      fc.property(sortedCursorTrack, (track) => {
        const firstPoint = track[0];
        const lastPoint = track[track.length - 1];
        
        // Generate a timestamp strictly between first and last
        if (lastPoint.timestamp <= firstPoint.timestamp + 1) return true;
        
        const midTimestamp = firstPoint.timestamp + 
          Math.floor((lastPoint.timestamp - firstPoint.timestamp) / 2);
        
        // Find expected adjacent points manually
        let expectedP1 = firstPoint;
        let expectedP2 = track[1];
        
        for (let i = 0; i < track.length - 1; i++) {
          if (track[i].timestamp <= midTimestamp && midTimestamp < track[i + 1].timestamp) {
            expectedP1 = track[i];
            expectedP2 = track[i + 1];
            break;
          }
        }
        
        const result = interpolateCursor(track, midTimestamp);
        
        expect(result).not.toBeNull();
        if (result && expectedP2.timestamp > expectedP1.timestamp) {
          // Verify the interpolation uses the correct adjacent points
          const t = (midTimestamp - expectedP1.timestamp) / (expectedP2.timestamp - expectedP1.timestamp);
          const expectedX = expectedP1.position.x + (expectedP2.position.x - expectedP1.position.x) * t;
          const expectedY = expectedP1.position.y + (expectedP2.position.y - expectedP1.position.y) * t;
          
          expect(result.position.x).toBeCloseTo(expectedX, 10);
          expect(result.position.y).toBeCloseTo(expectedY, 10);
        }
      }),
      { numRuns: 20 }
    );
  });
});


// ============================================================================
// Property 5: Cursor Opacity Calculation
// ============================================================================

/**
 * Arbitrary for confidence values (0-100).
 */
const confidence = fc.nat({ max: 100 });

/**
 * Property 5: Cursor Opacity Calculation
 * **Validates: Requirements 3.4, 3.5, 3.6**
 *
 * For any cursor track point with state S and confidence C:
 * - If S is Hidden: opacity = 0
 * - If S is Visible: opacity = 1.0
 * - If S is Inferred and C >= 70: opacity = 1.0
 * - If S is Inferred and C < 70: opacity = C / 100
 */
describe('Property 5: Cursor Opacity Calculation', () => {
  it('returns 0 when state is Hidden regardless of confidence', () => {
    fc.assert(
      fc.property(confidence, (c) => {
        const result = calculateCursorOpacity('Hidden', c);
        expect(result).toBe(0);
      }),
      { numRuns: 20 }
    );
  });

  it('returns 1.0 when state is Visible regardless of confidence', () => {
    fc.assert(
      fc.property(confidence, (c) => {
        const result = calculateCursorOpacity('Visible', c);
        expect(result).toBe(1.0);
      }),
      { numRuns: 20 }
    );
  });

  it('returns 1.0 when state is Inferred and confidence >= 70', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: CONFIDENCE_THRESHOLD, max: 100 }),
        (c) => {
          const result = calculateCursorOpacity('Inferred', c);
          expect(result).toBe(1.0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('returns C/100 when state is Inferred and confidence < 70', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: CONFIDENCE_THRESHOLD - 1 }),
        (c) => {
          const result = calculateCursorOpacity('Inferred', c);
          expect(result).toBeCloseTo(c / 100, 10);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('opacity is always in range [0, 1]', () => {
    fc.assert(
      fc.property(cursorState, confidence, (state, c) => {
        const result = calculateCursorOpacity(state, c);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }),
      { numRuns: 20 }
    );
  });

  it('Inferred state with confidence 0 returns 0', () => {
    const result = calculateCursorOpacity('Inferred', 0);
    expect(result).toBe(0);
  });

  it('Inferred state with confidence 69 returns 0.69', () => {
    const result = calculateCursorOpacity('Inferred', 69);
    expect(result).toBeCloseTo(0.69, 10);
  });

  it('Inferred state with confidence 70 (boundary) returns 1.0', () => {
    const result = calculateCursorOpacity('Inferred', 70);
    expect(result).toBe(1.0);
  });

  it('Inferred state with confidence 100 returns 1.0', () => {
    const result = calculateCursorOpacity('Inferred', 100);
    expect(result).toBe(1.0);
  });
});
