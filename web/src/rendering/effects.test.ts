// Property-based tests for effect rendering utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  findActiveEffects,
  calculateClickRingProgress,
  calculateClickRingRadius,
  calculateClickRingOpacity,
} from './effects';
import type { ClickRingAnimationState } from './types';

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
 * Arbitrary for Effect objects.
 * Generates effects with valid timestamps, durations, and positions.
 * Note: duration_us uses fc.integer with min: 1 as per design doc specification.
 */
const effect = fc.record({
  timestamp: fc.nat({ max: 10_000_000 }),
  duration_us: fc.integer({ min: 1, max: 1_000_000 }),
  effect_type: fc.constant('ClickRing' as const),
  position: normalizedCoord,
});

/**
 * Arbitrary for a list of effects.
 */
const effectList = fc.array(effect, { minLength: 0, maxLength: 50 });

/**
 * Arbitrary for timestamps within a reasonable range.
 */
const timestamp = fc.nat({ max: 15_000_000 });

// ============================================================================
// Property-Based Tests
// ============================================================================

/**
 * Property 2: Active Effect Filtering
 * **Validates: Requirements 2.2, 2.6**
 *
 * For any list of effects and any timestamp T, the `findActiveEffects` function
 * SHALL return exactly those effects where:
 * - effect.timestamp <= T AND T < effect.timestamp + effect.duration_us
 *
 * No effects outside this range shall be included, and no matching effects
 * shall be excluded.
 */
describe('Property 2: Active Effect Filtering', () => {
  it('returns only effects where timestamp falls within [effect.timestamp, effect.timestamp + duration_us)', () => {
    fc.assert(
      fc.property(effectList, timestamp, (effects, t) => {
        const result = findActiveEffects(effects, t);

        // Every returned effect must satisfy the active condition
        for (const activeEffect of result) {
          const effectStart = activeEffect.timestamp;
          const effectEnd = activeEffect.timestamp + activeEffect.duration_us;
          
          // Condition: effectStart <= t < effectEnd
          expect(effectStart).toBeLessThanOrEqual(t);
          expect(t).toBeLessThan(effectEnd);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('includes all effects that satisfy the active condition', () => {
    fc.assert(
      fc.property(effectList, timestamp, (effects, t) => {
        const result = findActiveEffects(effects, t);

        // Count how many effects should be active
        const expectedActiveCount = effects.filter((e) => {
          const effectStart = e.timestamp;
          const effectEnd = e.timestamp + e.duration_us;
          return effectStart <= t && t < effectEnd;
        }).length;

        // Result should have exactly that many effects
        expect(result.length).toBe(expectedActiveCount);
      }),
      { numRuns: 20 }
    );
  });

  it('excludes all effects that do not satisfy the active condition', () => {
    fc.assert(
      fc.property(effectList, timestamp, (effects, t) => {
        const result = findActiveEffects(effects, t);
        const resultSet = new Set(result);

        // Every effect NOT in result must NOT satisfy the active condition
        for (const e of effects) {
          if (!resultSet.has(e)) {
            const effectStart = e.timestamp;
            const effectEnd = e.timestamp + e.duration_us;
            
            // Either t < effectStart OR t >= effectEnd
            const isBeforeStart = t < effectStart;
            const isAfterEnd = t >= effectEnd;
            
            expect(isBeforeStart || isAfterEnd).toBe(true);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it('result contains exactly the effects matching the active condition (completeness)', () => {
    fc.assert(
      fc.property(effectList, timestamp, (effects, t) => {
        const result = findActiveEffects(effects, t);

        // Manually compute expected active effects
        const expected = effects.filter((e) => {
          const effectStart = e.timestamp;
          const effectEnd = e.timestamp + e.duration_us;
          return effectStart <= t && t < effectEnd;
        });

        // Result should match expected exactly
        expect(result.length).toBe(expected.length);
        
        // Every expected effect should be in result
        for (const e of expected) {
          expect(result).toContain(e);
        }
      }),
      { numRuns: 20 }
    );
  });

  it('empty effect list returns empty array for any timestamp', () => {
    fc.assert(
      fc.property(timestamp, (t) => {
        const result = findActiveEffects([], t);
        expect(result).toEqual([]);
      }),
      { numRuns: 20 }
    );
  });

  it('timestamp exactly at effect start includes the effect', () => {
    fc.assert(
      fc.property(effect, (e) => {
        const result = findActiveEffects([e], e.timestamp);
        
        // Effect should be included when t === effect.timestamp
        expect(result.length).toBe(1);
        expect(result[0]).toBe(e);
      }),
      { numRuns: 20 }
    );
  });

  it('timestamp exactly at effect end excludes the effect', () => {
    fc.assert(
      fc.property(effect, (e) => {
        const effectEnd = e.timestamp + e.duration_us;
        const result = findActiveEffects([e], effectEnd);
        
        // Effect should NOT be included when t === effect.timestamp + duration_us
        expect(result.length).toBe(0);
      }),
      { numRuns: 20 }
    );
  });

  it('timestamp before effect start excludes the effect', () => {
    fc.assert(
      fc.property(
        effect.filter((e) => e.timestamp > 0),
        (e) => {
          // Use timestamp one microsecond before effect start
          const beforeStart = e.timestamp - 1;
          const result = findActiveEffects([e], beforeStart);
          
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('timestamp after effect end excludes the effect', () => {
    fc.assert(
      fc.property(effect, (e) => {
        // Use timestamp one microsecond after effect end
        const afterEnd = e.timestamp + e.duration_us + 1;
        const result = findActiveEffects([e], afterEnd);
        
        expect(result.length).toBe(0);
      }),
      { numRuns: 20 }
    );
  });
});


// ============================================================================
// Property 3: Click Ring Animation State
// ============================================================================

/**
 * Arbitrary for click ring animation state.
 * Generates states with valid radius and opacity ranges.
 */
const clickRingAnimationState = fc.record({
  effect: effect,
  startRadius: fc.float({ min: 1, max: 100, noNaN: true }),
  endRadius: fc.float({ min: 10, max: 200, noNaN: true }),
  startOpacity: fc.float({ min: 0, max: 1, noNaN: true }),
  endOpacity: fc.float({ min: 0, max: 1, noNaN: true }),
});

/**
 * Arbitrary for progress values in [0, 1] range.
 */
const progress = fc.float({ min: 0, max: 1, noNaN: true });

/**
 * Property 3: Click Ring Animation State
 * **Validates: Requirements 2.4, 2.5**
 *
 * For any click ring effect with duration D, and any timestamp T within the
 * effect's active period, the animation state SHALL have:
 * - progress = (T - effect.timestamp) / D, in range [0, 1]
 * - radius = startRadius + (endRadius - startRadius) * progress
 * - opacity = startOpacity * (1 - progress)
 */
describe('Property 3: Click Ring Animation State', () => {
  describe('calculateClickRingProgress', () => {
    it('returns progress = (T - effect.timestamp) / D for timestamps within active period', () => {
      fc.assert(
        fc.property(effect, (e) => {
          // Generate a timestamp within the effect's active period
          const duration = e.duration_us;
          if (duration <= 0) return true; // Skip invalid durations

          // Test at various points within the effect's duration
          const testPoints = [0, 0.25, 0.5, 0.75, 1.0];
          for (const fraction of testPoints) {
            const t = e.timestamp + Math.floor(duration * fraction);
            const result = calculateClickRingProgress(e, t);
            const expectedProgress = (t - e.timestamp) / duration;

            // Progress should match the formula
            expect(result).toBeCloseTo(expectedProgress, 10);
          }
        }),
        { numRuns: 20 }
      );
    });

    it('returns progress in range [0, 1] for any timestamp', () => {
      fc.assert(
        fc.property(effect, timestamp, (e, t) => {
          const result = calculateClickRingProgress(e, t);

          // Progress should always be clamped to [0, 1]
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
        }),
        { numRuns: 20 }
      );
    });

    it('returns 0 when timestamp equals effect.timestamp', () => {
      fc.assert(
        fc.property(effect, (e) => {
          const result = calculateClickRingProgress(e, e.timestamp);
          expect(result).toBe(0);
        }),
        { numRuns: 20 }
      );
    });

    it('returns 1 when timestamp equals effect.timestamp + duration_us', () => {
      fc.assert(
        fc.property(effect, (e) => {
          const effectEnd = e.timestamp + e.duration_us;
          const result = calculateClickRingProgress(e, effectEnd);
          expect(result).toBe(1);
        }),
        { numRuns: 20 }
      );
    });

    it('clamps to 0 for timestamps before effect start', () => {
      fc.assert(
        fc.property(
          effect.filter((e) => e.timestamp > 0),
          (e) => {
            const beforeStart = e.timestamp - 1;
            const result = calculateClickRingProgress(e, beforeStart);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('clamps to 1 for timestamps after effect end', () => {
      fc.assert(
        fc.property(effect, (e) => {
          const afterEnd = e.timestamp + e.duration_us + 1;
          const result = calculateClickRingProgress(e, afterEnd);
          expect(result).toBe(1);
        }),
        { numRuns: 20 }
      );
    });
  });

  describe('calculateClickRingRadius', () => {
    it('returns radius = startRadius + (endRadius - startRadius) * progress', () => {
      fc.assert(
        fc.property(clickRingAnimationState, progress, (state, p) => {
          const result = calculateClickRingRadius(state, p);
          const expected =
            state.startRadius + (state.endRadius - state.startRadius) * p;

          expect(result).toBeCloseTo(expected, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('returns startRadius when progress is 0', () => {
      fc.assert(
        fc.property(clickRingAnimationState, (state) => {
          const result = calculateClickRingRadius(state, 0);
          expect(result).toBeCloseTo(state.startRadius, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('returns endRadius when progress is 1', () => {
      fc.assert(
        fc.property(clickRingAnimationState, (state) => {
          const result = calculateClickRingRadius(state, 1);
          expect(result).toBeCloseTo(state.endRadius, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('returns midpoint radius when progress is 0.5', () => {
      fc.assert(
        fc.property(clickRingAnimationState, (state) => {
          const result = calculateClickRingRadius(state, 0.5);
          const expected = (state.startRadius + state.endRadius) / 2;
          expect(result).toBeCloseTo(expected, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('radius increases monotonically with progress when endRadius > startRadius', () => {
      fc.assert(
        fc.property(
          clickRingAnimationState.filter((s) => s.endRadius > s.startRadius),
          (state) => {
            const progressValues = [0, 0.25, 0.5, 0.75, 1.0];
            const radii = progressValues.map((p) =>
              calculateClickRingRadius(state, p)
            );

            // Each radius should be >= the previous one
            for (let i = 1; i < radii.length; i++) {
              expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('calculateClickRingOpacity', () => {
    it('returns opacity = startOpacity * (1 - progress)', () => {
      fc.assert(
        fc.property(clickRingAnimationState, progress, (state, p) => {
          const result = calculateClickRingOpacity(state, p);
          const expected = state.startOpacity * (1 - p);

          expect(result).toBeCloseTo(expected, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('returns startOpacity when progress is 0', () => {
      fc.assert(
        fc.property(clickRingAnimationState, (state) => {
          const result = calculateClickRingOpacity(state, 0);
          expect(result).toBeCloseTo(state.startOpacity, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('returns 0 when progress is 1', () => {
      fc.assert(
        fc.property(clickRingAnimationState, (state) => {
          const result = calculateClickRingOpacity(state, 1);
          expect(result).toBeCloseTo(0, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('returns half of startOpacity when progress is 0.5', () => {
      fc.assert(
        fc.property(clickRingAnimationState, (state) => {
          const result = calculateClickRingOpacity(state, 0.5);
          const expected = state.startOpacity * 0.5;
          expect(result).toBeCloseTo(expected, 10);
        }),
        { numRuns: 20 }
      );
    });

    it('opacity decreases monotonically with progress when startOpacity > 0', () => {
      fc.assert(
        fc.property(
          clickRingAnimationState.filter((s) => s.startOpacity > 0),
          (state) => {
            const progressValues = [0, 0.25, 0.5, 0.75, 1.0];
            const opacities = progressValues.map((p) =>
              calculateClickRingOpacity(state, p)
            );

            // Each opacity should be <= the previous one
            for (let i = 1; i < opacities.length; i++) {
              expect(opacities[i]).toBeLessThanOrEqual(opacities[i - 1]);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('opacity is always in range [0, startOpacity]', () => {
      fc.assert(
        fc.property(clickRingAnimationState, progress, (state, p) => {
          const result = calculateClickRingOpacity(state, p);

          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(state.startOpacity);
        }),
        { numRuns: 20 }
      );
    });
  });
});
