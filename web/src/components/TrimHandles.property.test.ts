// TrimHandles property-based tests
// **Validates: Requirements 2.2, 2.3**
// Property 5: Trim Bounds - For any trim operation, In_Point < Out_Point, and both within [0, duration]
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// TRIM BOUNDS VALIDATION LOGIC
// ============================================================================

/**
 * Validates and clamps an in-point value to ensure it's within valid bounds.
 * This mirrors the logic in TrimHandles component for in-point drag handling.
 * 
 * @param inPoint - The proposed in-point value
 * @param outPoint - The current out-point value
 * @param duration - The total video duration
 * @param minGapRatio - Minimum gap ratio between in and out points (default 1%)
 * @returns The validated and clamped in-point value
 */
export function validateInPoint(
    inPoint: number,
    outPoint: number,
    duration: number,
    minGapRatio: number = 0.01
): number {
    // Use Math.floor to ensure integer microseconds and avoid floating-point issues
    const minGap = Math.floor(duration * minGapRatio);
    // In point must be >= 0 and < out point (with minimum gap)
    return Math.max(0, Math.min(outPoint - minGap, inPoint));
}

/**
 * Validates and clamps an out-point value to ensure it's within valid bounds.
 * This mirrors the logic in TrimHandles component for out-point drag handling.
 * 
 * @param outPoint - The proposed out-point value
 * @param inPoint - The current in-point value
 * @param duration - The total video duration
 * @param minGapRatio - Minimum gap ratio between in and out points (default 1%)
 * @returns The validated and clamped out-point value
 */
export function validateOutPoint(
    outPoint: number,
    inPoint: number,
    duration: number,
    minGapRatio: number = 0.01
): number {
    // Use Math.floor to ensure integer microseconds and avoid floating-point issues
    const minGap = Math.floor(duration * minGapRatio);
    // Out point must be > in point and <= duration
    return Math.max(inPoint + minGap, Math.min(duration, outPoint));
}

/**
 * Checks if trim bounds are valid according to Property 5.
 * 
 * @param inPoint - The in-point value
 * @param outPoint - The out-point value
 * @param duration - The total video duration
 * @returns True if bounds are valid
 */
export function areTrimBoundsValid(
    inPoint: number,
    outPoint: number,
    duration: number
): boolean {
    return (
        inPoint >= 0 &&
        inPoint < outPoint &&
        outPoint <= duration
    );
}

// ============================================================================
// ARBITRARIES
// ============================================================================

/**
 * Arbitrary for video duration in microseconds.
 * Reasonable range from 1 second to 1 hour.
 */
const durationArb = fc.integer({ min: 1_000_000, max: 3_600_000_000 });

/**
 * Arbitrary for a proposed in-point value.
 * Can be any value, including invalid ones outside [0, duration].
 */
const proposedInPointArb = (duration: number) =>
    fc.integer({ min: -duration, max: duration * 2 });

/**
 * Arbitrary for a proposed out-point value.
 * Can be any value, including invalid ones outside [0, duration].
 */
const proposedOutPointArb = (duration: number) =>
    fc.integer({ min: -duration, max: duration * 2 });

/**
 * Arbitrary for valid trim state (in-point and out-point within bounds).
 */
const validTrimStateArb = fc.record({
    duration: durationArb,
}).chain(({ duration }) => {
    // Generate valid in-point and out-point with minimum gap
    const minGap = Math.max(1, Math.floor(duration * 0.01));
    return fc.record({
        duration: fc.constant(duration),
        inPoint: fc.integer({ min: 0, max: duration - minGap }),
    }).chain(({ duration, inPoint }) => {
        const minOutPoint = inPoint + minGap;
        return fc.record({
            duration: fc.constant(duration),
            inPoint: fc.constant(inPoint),
            outPoint: fc.integer({ min: minOutPoint, max: duration }),
        });
    });
});

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Property 5: Trim Bounds', () => {
    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: For any trim operation, validated In_Point is within [0, duration].
     */
    it('validated in-point is always within [0, duration]', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                proposedInPointArb(3_600_000_000),
                ({ duration, outPoint }, proposedInPoint) => {
                    const validatedInPoint = validateInPoint(proposedInPoint, outPoint, duration);
                    
                    // In-point must be >= 0
                    expect(validatedInPoint).toBeGreaterThanOrEqual(0);
                    // In-point must be <= duration (implicitly, since it must be < outPoint <= duration)
                    expect(validatedInPoint).toBeLessThanOrEqual(duration);
                }
            ),
            { numRuns: 1000 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: For any trim operation, validated Out_Point is within [0, duration].
     */
    it('validated out-point is always within [0, duration]', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                proposedOutPointArb(3_600_000_000),
                ({ duration, inPoint }, proposedOutPoint) => {
                    const validatedOutPoint = validateOutPoint(proposedOutPoint, inPoint, duration);
                    
                    // Out-point must be >= 0 (implicitly, since it must be > inPoint >= 0)
                    expect(validatedOutPoint).toBeGreaterThanOrEqual(0);
                    // Out-point must be <= duration
                    expect(validatedOutPoint).toBeLessThanOrEqual(duration);
                }
            ),
            { numRuns: 1000 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: For any trim operation, validated In_Point < Out_Point.
     */
    it('validated in-point is always less than out-point', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                proposedInPointArb(3_600_000_000),
                ({ duration, outPoint }, proposedInPoint) => {
                    const validatedInPoint = validateInPoint(proposedInPoint, outPoint, duration);
                    
                    // In-point must be strictly less than out-point
                    expect(validatedInPoint).toBeLessThan(outPoint);
                }
            ),
            { numRuns: 1000 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: For any trim operation, validated Out_Point > In_Point.
     */
    it('validated out-point is always greater than in-point', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                proposedOutPointArb(3_600_000_000),
                ({ duration, inPoint }, proposedOutPoint) => {
                    const validatedOutPoint = validateOutPoint(proposedOutPoint, inPoint, duration);
                    
                    // Out-point must be strictly greater than in-point
                    expect(validatedOutPoint).toBeGreaterThan(inPoint);
                }
            ),
            { numRuns: 1000 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: After validation, trim bounds are always valid according to Property 5.
     */
    it('validated trim bounds always satisfy Property 5 constraints', () => {
        fc.assert(
            fc.property(
                durationArb,
                fc.integer({ min: -1_000_000, max: 5_000_000_000 }),
                fc.integer({ min: -1_000_000, max: 5_000_000_000 }),
                (duration, rawInPoint, rawOutPoint) => {
                    // Start with a valid out-point to validate in-point against
                    const initialOutPoint = Math.max(
                        Math.floor(duration * 0.02), // At least 2% from start
                        Math.min(duration, rawOutPoint)
                    );
                    
                    // Validate in-point
                    const validatedInPoint = validateInPoint(rawInPoint, initialOutPoint, duration);
                    
                    // Validate out-point against the validated in-point
                    const validatedOutPoint = validateOutPoint(rawOutPoint, validatedInPoint, duration);
                    
                    // Check all Property 5 constraints
                    expect(areTrimBoundsValid(validatedInPoint, validatedOutPoint, duration)).toBe(true);
                }
            ),
            { numRuns: 1000 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: Validation preserves valid input values when possible.
     * If the proposed value is already valid, it should be preserved.
     */
    it('validation preserves valid in-point values', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                ({ duration, inPoint, outPoint }) => {
                    // Generate a valid proposed in-point within bounds
                    const minGap = duration * 0.01;
                    const maxValidInPoint = outPoint - minGap;
                    
                    if (maxValidInPoint > 0) {
                        // Test with a value that's already valid
                        const validProposedInPoint = Math.floor(maxValidInPoint / 2);
                        const result = validateInPoint(validProposedInPoint, outPoint, duration);
                        
                        // Should preserve the valid value
                        expect(result).toBe(validProposedInPoint);
                    }
                }
            ),
            { numRuns: 500 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: Validation preserves valid out-point values when possible.
     * If the proposed value is already valid, it should be preserved.
     */
    it('validation preserves valid out-point values', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                ({ duration, inPoint }) => {
                    // Generate a valid proposed out-point within bounds
                    const minGap = duration * 0.01;
                    const minValidOutPoint = inPoint + minGap;
                    
                    if (minValidOutPoint < duration) {
                        // Test with a value that's already valid
                        const validProposedOutPoint = Math.floor((minValidOutPoint + duration) / 2);
                        const result = validateOutPoint(validProposedOutPoint, inPoint, duration);
                        
                        // Should preserve the valid value
                        expect(result).toBe(validProposedOutPoint);
                    }
                }
            ),
            { numRuns: 500 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: Negative in-point values are clamped to 0.
     */
    it('negative in-point values are clamped to 0', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                fc.integer({ min: -10_000_000, max: -1 }),
                ({ duration, outPoint }, negativeInPoint) => {
                    const result = validateInPoint(negativeInPoint, outPoint, duration);
                    
                    expect(result).toBe(0);
                }
            ),
            { numRuns: 500 }
        );
    });

    /**
     * **Validates: Requirements 2.2, 2.3**
     * 
     * Property: Out-point values exceeding duration are clamped to duration.
     */
    it('out-point values exceeding duration are clamped to duration', () => {
        fc.assert(
            fc.property(
                validTrimStateArb,
                fc.integer({ min: 1, max: 10_000_000 }),
                ({ duration, inPoint }, excess) => {
                    const excessiveOutPoint = duration + excess;
                    const result = validateOutPoint(excessiveOutPoint, inPoint, duration);
                    
                    expect(result).toBe(duration);
                }
            ),
            { numRuns: 500 }
        );
    });
});
