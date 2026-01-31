// Tests for keyframe merging utilities
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect } from 'vitest';
import {
  mergeKeyframes,
  mergeKeyframesWithSource,
  isOverriddenByManual,
  findNearestKeyframe,
  areKeyframesAtSameTimestamp,
  countOverriddenKeyframes,
} from './keyframe';
import type { ZoomMarker } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createKeyframe(
  id: string,
  timestamp: number,
  zoomLevel: number = 1.5,
  x: number = 0.5,
  y: number = 0.5
): ZoomMarker {
  return {
    id,
    timestamp,
    position: { x, y },
    zoomLevel,
  };
}

// ============================================================================
// mergeKeyframes Tests
// ============================================================================

describe('mergeKeyframes', () => {
  it('returns empty array when both inputs are empty', () => {
    const result = mergeKeyframes([], []);
    expect(result).toEqual([]);
  });

  it('returns auto keyframes when no manual keyframes exist', () => {
    const auto = [
      createKeyframe('auto-1', 1_000_000),
      createKeyframe('auto-2', 2_000_000),
    ];
    const result = mergeKeyframes(auto, []);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('auto-1');
    expect(result[1].id).toBe('auto-2');
  });

  it('returns manual keyframes when no auto keyframes exist', () => {
    const manual = [
      createKeyframe('manual-1', 1_000_000),
      createKeyframe('manual-2', 2_000_000),
    ];
    const result = mergeKeyframes([], manual);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('manual-1');
    expect(result[1].id).toBe('manual-2');
  });

  it('merges non-overlapping keyframes and sorts by timestamp', () => {
    const auto = [
      createKeyframe('auto-1', 1_000_000),
      createKeyframe('auto-2', 3_000_000),
    ];
    const manual = [createKeyframe('manual-1', 2_000_000)];

    const result = mergeKeyframes(auto, manual);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('auto-1');
    expect(result[1].id).toBe('manual-1');
    expect(result[2].id).toBe('auto-2');
  });

  it('manual keyframe overrides auto keyframe at exact same timestamp', () => {
    const auto = [createKeyframe('auto-1', 1_000_000, 1.5)];
    const manual = [createKeyframe('manual-1', 1_000_000, 2.5)];

    const result = mergeKeyframes(auto, manual);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('manual-1');
    expect(result[0].zoomLevel).toBe(2.5);
  });

  it('manual keyframe overrides auto keyframe within tolerance', () => {
    const auto = [createKeyframe('auto-1', 1_000_000, 1.5)];
    // Manual keyframe is 50ms later (within default 100ms tolerance)
    const manual = [createKeyframe('manual-1', 1_050_000, 2.5)];

    const result = mergeKeyframes(auto, manual);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('manual-1');
  });

  it('does not override auto keyframe outside tolerance', () => {
    const auto = [createKeyframe('auto-1', 1_000_000, 1.5)];
    // Manual keyframe is 150ms later (outside default 100ms tolerance)
    const manual = [createKeyframe('manual-1', 1_150_000, 2.5)];

    const result = mergeKeyframes(auto, manual);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('auto-1');
    expect(result[1].id).toBe('manual-1');
  });

  it('handles multiple manual keyframes overriding multiple auto keyframes', () => {
    const auto = [
      createKeyframe('auto-1', 1_000_000),
      createKeyframe('auto-2', 2_000_000),
      createKeyframe('auto-3', 3_000_000),
    ];
    const manual = [
      createKeyframe('manual-1', 1_000_000), // Overrides auto-1
      createKeyframe('manual-2', 3_000_000), // Overrides auto-3
    ];

    const result = mergeKeyframes(auto, manual);

    expect(result).toHaveLength(3);
    expect(result.map((kf) => kf.id)).toEqual(['manual-1', 'auto-2', 'manual-2']);
  });

  it('respects custom tolerance parameter', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    const manual = [createKeyframe('manual-1', 1_200_000)]; // 200ms apart

    // With default tolerance (100ms), both should exist
    const resultDefault = mergeKeyframes(auto, manual);
    expect(resultDefault).toHaveLength(2);

    // With larger tolerance (300ms), manual should override
    const resultLarge = mergeKeyframes(auto, manual, 300_000);
    expect(resultLarge).toHaveLength(1);
    expect(resultLarge[0].id).toBe('manual-1');
  });

  it('preserves keyframe properties when merging', () => {
    const auto = [createKeyframe('auto-1', 1_000_000, 1.5, 0.3, 0.4)];
    const manual = [createKeyframe('manual-1', 2_000_000, 2.5, 0.7, 0.8)];

    const result = mergeKeyframes(auto, manual);

    expect(result[0].zoomLevel).toBe(1.5);
    expect(result[0].position).toEqual({ x: 0.3, y: 0.4 });
    expect(result[1].zoomLevel).toBe(2.5);
    expect(result[1].position).toEqual({ x: 0.7, y: 0.8 });
  });
});

// ============================================================================
// mergeKeyframesWithSource Tests
// ============================================================================

describe('mergeKeyframesWithSource', () => {
  it('marks auto keyframes with source "auto"', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    const result = mergeKeyframesWithSource(auto, []);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('auto');
  });

  it('marks manual keyframes with source "manual"', () => {
    const manual = [createKeyframe('manual-1', 1_000_000)];
    const result = mergeKeyframesWithSource([], manual);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('manual');
  });

  it('correctly marks sources in merged result', () => {
    const auto = [
      createKeyframe('auto-1', 1_000_000),
      createKeyframe('auto-2', 3_000_000),
    ];
    const manual = [createKeyframe('manual-1', 2_000_000)];

    const result = mergeKeyframesWithSource(auto, manual);

    expect(result).toHaveLength(3);
    expect(result[0].source).toBe('auto');
    expect(result[1].source).toBe('manual');
    expect(result[2].source).toBe('auto');
  });

  it('overridden auto keyframes are not included', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    const manual = [createKeyframe('manual-1', 1_000_000)];

    const result = mergeKeyframesWithSource(auto, manual);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('manual-1');
    expect(result[0].source).toBe('manual');
  });
});

// ============================================================================
// isOverriddenByManual Tests
// ============================================================================

describe('isOverriddenByManual', () => {
  it('returns false when no manual keyframes exist', () => {
    expect(isOverriddenByManual(1_000_000, [])).toBe(false);
  });

  it('returns true when timestamp matches exactly', () => {
    const manual = [createKeyframe('manual-1', 1_000_000)];
    expect(isOverriddenByManual(1_000_000, manual)).toBe(true);
  });

  it('returns true when timestamp is within tolerance', () => {
    const manual = [createKeyframe('manual-1', 1_000_000)];
    // 50ms difference (within default 100ms tolerance)
    expect(isOverriddenByManual(1_050_000, manual)).toBe(true);
    expect(isOverriddenByManual(950_000, manual)).toBe(true);
  });

  it('returns false when timestamp is outside tolerance', () => {
    const manual = [createKeyframe('manual-1', 1_000_000)];
    // 150ms difference (outside default 100ms tolerance)
    expect(isOverriddenByManual(1_150_000, manual)).toBe(false);
    expect(isOverriddenByManual(850_000, manual)).toBe(false);
  });

  it('checks against all manual keyframes', () => {
    const manual = [
      createKeyframe('manual-1', 1_000_000),
      createKeyframe('manual-2', 3_000_000),
    ];
    expect(isOverriddenByManual(1_000_000, manual)).toBe(true);
    expect(isOverriddenByManual(3_000_000, manual)).toBe(true);
    expect(isOverriddenByManual(2_000_000, manual)).toBe(false);
  });
});

// ============================================================================
// findNearestKeyframe Tests
// ============================================================================

describe('findNearestKeyframe', () => {
  it('returns null for empty keyframe list', () => {
    expect(findNearestKeyframe(1_000_000, [])).toBeNull();
  });

  it('returns the only keyframe when list has one element', () => {
    const keyframes = [createKeyframe('kf-1', 1_000_000)];
    const result = findNearestKeyframe(5_000_000, keyframes);
    expect(result?.id).toBe('kf-1');
  });

  it('returns exact match when timestamp matches', () => {
    const keyframes = [
      createKeyframe('kf-1', 1_000_000),
      createKeyframe('kf-2', 2_000_000),
      createKeyframe('kf-3', 3_000_000),
    ];
    const result = findNearestKeyframe(2_000_000, keyframes);
    expect(result?.id).toBe('kf-2');
  });

  it('returns nearest keyframe when timestamp is between keyframes', () => {
    const keyframes = [
      createKeyframe('kf-1', 1_000_000),
      createKeyframe('kf-2', 3_000_000),
    ];
    // 1.8M is closer to 1M than to 3M
    expect(findNearestKeyframe(1_800_000, keyframes)?.id).toBe('kf-1');
    // 2.2M is closer to 3M than to 1M
    expect(findNearestKeyframe(2_200_000, keyframes)?.id).toBe('kf-2');
  });

  it('returns first keyframe when timestamp is before all', () => {
    const keyframes = [
      createKeyframe('kf-1', 1_000_000),
      createKeyframe('kf-2', 2_000_000),
    ];
    const result = findNearestKeyframe(0, keyframes);
    expect(result?.id).toBe('kf-1');
  });

  it('returns last keyframe when timestamp is after all', () => {
    const keyframes = [
      createKeyframe('kf-1', 1_000_000),
      createKeyframe('kf-2', 2_000_000),
    ];
    const result = findNearestKeyframe(10_000_000, keyframes);
    expect(result?.id).toBe('kf-2');
  });
});

// ============================================================================
// areKeyframesAtSameTimestamp Tests
// ============================================================================

describe('areKeyframesAtSameTimestamp', () => {
  it('returns true for exact same timestamp', () => {
    const kf1 = createKeyframe('kf-1', 1_000_000);
    const kf2 = createKeyframe('kf-2', 1_000_000);
    expect(areKeyframesAtSameTimestamp(kf1, kf2)).toBe(true);
  });

  it('returns true for timestamps within tolerance', () => {
    const kf1 = createKeyframe('kf-1', 1_000_000);
    const kf2 = createKeyframe('kf-2', 1_050_000); // 50ms apart
    expect(areKeyframesAtSameTimestamp(kf1, kf2)).toBe(true);
  });

  it('returns false for timestamps outside tolerance', () => {
    const kf1 = createKeyframe('kf-1', 1_000_000);
    const kf2 = createKeyframe('kf-2', 1_200_000); // 200ms apart
    expect(areKeyframesAtSameTimestamp(kf1, kf2)).toBe(false);
  });

  it('respects custom tolerance', () => {
    const kf1 = createKeyframe('kf-1', 1_000_000);
    const kf2 = createKeyframe('kf-2', 1_200_000); // 200ms apart

    // With default tolerance (100ms), should be false
    expect(areKeyframesAtSameTimestamp(kf1, kf2)).toBe(false);

    // With larger tolerance (300ms), should be true
    expect(areKeyframesAtSameTimestamp(kf1, kf2, 300_000)).toBe(true);
  });
});

// ============================================================================
// countOverriddenKeyframes Tests
// ============================================================================

describe('countOverriddenKeyframes', () => {
  it('returns 0 when no manual keyframes exist', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    expect(countOverriddenKeyframes(auto, [])).toBe(0);
  });

  it('returns 0 when no auto keyframes exist', () => {
    const manual = [createKeyframe('manual-1', 1_000_000)];
    expect(countOverriddenKeyframes([], manual)).toBe(0);
  });

  it('returns 0 when no keyframes overlap', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    const manual = [createKeyframe('manual-1', 3_000_000)];
    expect(countOverriddenKeyframes(auto, manual)).toBe(0);
  });

  it('counts single override correctly', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    const manual = [createKeyframe('manual-1', 1_000_000)];
    expect(countOverriddenKeyframes(auto, manual)).toBe(1);
  });

  it('counts multiple overrides correctly', () => {
    const auto = [
      createKeyframe('auto-1', 1_000_000),
      createKeyframe('auto-2', 2_000_000),
      createKeyframe('auto-3', 3_000_000),
    ];
    const manual = [
      createKeyframe('manual-1', 1_000_000), // Overrides auto-1
      createKeyframe('manual-2', 3_000_000), // Overrides auto-3
    ];
    expect(countOverriddenKeyframes(auto, manual)).toBe(2);
  });

  it('counts overrides within tolerance', () => {
    const auto = [createKeyframe('auto-1', 1_000_000)];
    const manual = [createKeyframe('manual-1', 1_050_000)]; // 50ms apart
    expect(countOverriddenKeyframes(auto, manual)).toBe(1);
  });
});

// ============================================================================
// Integration Tests - Validates Requirement 1.9
// ============================================================================

describe('Requirement 1.9: Manual keyframe edits SHALL override auto-generated keyframes', () => {
  it('manual keyframe completely replaces auto keyframe at same position', () => {
    // Simulate engine generating keyframes
    const autoKeyframes = [
      createKeyframe('auto-1', 0, 1.0, 0.5, 0.5),
      createKeyframe('auto-2', 1_000_000, 1.5, 0.3, 0.3),
      createKeyframe('auto-3', 2_000_000, 2.0, 0.7, 0.7),
    ];

    // User manually edits the keyframe at 1 second
    const manualKeyframes = [
      createKeyframe('manual-1', 1_000_000, 2.5, 0.5, 0.5), // Different zoom and position
    ];

    const merged = mergeKeyframes(autoKeyframes, manualKeyframes);

    // Should have 3 keyframes total
    expect(merged).toHaveLength(3);

    // The keyframe at 1 second should be the manual one
    const kfAt1Sec = merged.find((kf) => kf.timestamp === 1_000_000);
    expect(kfAt1Sec?.id).toBe('manual-1');
    expect(kfAt1Sec?.zoomLevel).toBe(2.5);
    expect(kfAt1Sec?.position).toEqual({ x: 0.5, y: 0.5 });
  });

  it('user can add new keyframes between auto-generated ones', () => {
    const autoKeyframes = [
      createKeyframe('auto-1', 0, 1.0),
      createKeyframe('auto-2', 2_000_000, 2.0),
    ];

    // User adds a keyframe at 1 second (between auto keyframes)
    const manualKeyframes = [createKeyframe('manual-1', 1_000_000, 1.5)];

    const merged = mergeKeyframes(autoKeyframes, manualKeyframes);

    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe('auto-1');
    expect(merged[1].id).toBe('manual-1');
    expect(merged[2].id).toBe('auto-2');
  });

  it('user can override all auto keyframes with manual ones', () => {
    const autoKeyframes = [
      createKeyframe('auto-1', 0, 1.0),
      createKeyframe('auto-2', 1_000_000, 1.5),
      createKeyframe('auto-3', 2_000_000, 2.0),
    ];

    // User replaces all keyframes
    const manualKeyframes = [
      createKeyframe('manual-1', 0, 1.2),
      createKeyframe('manual-2', 1_000_000, 1.8),
      createKeyframe('manual-3', 2_000_000, 2.5),
    ];

    const merged = mergeKeyframes(autoKeyframes, manualKeyframes);

    expect(merged).toHaveLength(3);
    expect(merged.every((kf) => kf.id.startsWith('manual'))).toBe(true);
  });
});


// ============================================================================
// interpolateViewportFromKeyframes Tests
// ============================================================================

import { interpolateViewportFromKeyframes } from './keyframe';

describe('interpolateViewportFromKeyframes', () => {
  describe('edge cases', () => {
    it('returns default viewport when no keyframes exist', () => {
      const result = interpolateViewportFromKeyframes([], 1_000_000);
      expect(result.center).toEqual({ x: 0.5, y: 0.5 });
      expect(result.zoom).toBe(1.0);
    });

    it('returns single keyframe viewport when only one keyframe exists', () => {
      const keyframes = [createKeyframe('kf-1', 1_000_000, 2.0, 0.3, 0.4)];
      const result = interpolateViewportFromKeyframes(keyframes, 500_000);
      expect(result.center).toEqual({ x: 0.3, y: 0.4 });
      expect(result.zoom).toBe(2.0);
    });
  });

  describe('boundary conditions', () => {
    it('returns first keyframe viewport when timestamp is before first keyframe', () => {
      const keyframes = [
        createKeyframe('kf-1', 1_000_000, 1.5, 0.3, 0.3),
        createKeyframe('kf-2', 2_000_000, 2.5, 0.7, 0.7),
      ];
      const result = interpolateViewportFromKeyframes(keyframes, 0);
      expect(result.center).toEqual({ x: 0.3, y: 0.3 });
      expect(result.zoom).toBe(1.5);
    });

    it('returns last keyframe viewport when timestamp is after last keyframe', () => {
      const keyframes = [
        createKeyframe('kf-1', 1_000_000, 1.5, 0.3, 0.3),
        createKeyframe('kf-2', 2_000_000, 2.5, 0.7, 0.7),
      ];
      const result = interpolateViewportFromKeyframes(keyframes, 5_000_000);
      expect(result.center).toEqual({ x: 0.7, y: 0.7 });
      expect(result.zoom).toBe(2.5);
    });

    it('returns exact keyframe viewport when timestamp matches exactly', () => {
      const keyframes = [
        createKeyframe('kf-1', 1_000_000, 1.5, 0.3, 0.3),
        createKeyframe('kf-2', 2_000_000, 2.5, 0.7, 0.7),
      ];
      const result = interpolateViewportFromKeyframes(keyframes, 1_000_000);
      expect(result.center).toEqual({ x: 0.3, y: 0.3 });
      expect(result.zoom).toBe(1.5);
    });
  });

  describe('linear interpolation', () => {
    it('interpolates zoom level linearly between keyframes', () => {
      const keyframes = [
        createKeyframe('kf-1', 0, 1.0, 0.5, 0.5),
        createKeyframe('kf-2', 1_000_000, 2.0, 0.5, 0.5),
      ];
      
      // At midpoint (500ms), zoom should be 1.5
      const result = interpolateViewportFromKeyframes(keyframes, 500_000);
      expect(result.zoom).toBeCloseTo(1.5, 5);
    });

    it('interpolates position linearly between keyframes', () => {
      const keyframes = [
        createKeyframe('kf-1', 0, 1.0, 0.0, 0.0),
        createKeyframe('kf-2', 1_000_000, 1.0, 1.0, 1.0),
      ];
      
      // At midpoint (500ms), position should be (0.5, 0.5)
      const result = interpolateViewportFromKeyframes(keyframes, 500_000);
      expect(result.center.x).toBeCloseTo(0.5, 5);
      expect(result.center.y).toBeCloseTo(0.5, 5);
    });

    it('interpolates both zoom and position correctly', () => {
      const keyframes = [
        createKeyframe('kf-1', 0, 1.0, 0.2, 0.3),
        createKeyframe('kf-2', 1_000_000, 3.0, 0.8, 0.9),
      ];
      
      // At 25% (250ms)
      const result25 = interpolateViewportFromKeyframes(keyframes, 250_000);
      expect(result25.zoom).toBeCloseTo(1.5, 5); // 1.0 + 0.25 * (3.0 - 1.0) = 1.5
      expect(result25.center.x).toBeCloseTo(0.35, 5); // 0.2 + 0.25 * (0.8 - 0.2) = 0.35
      expect(result25.center.y).toBeCloseTo(0.45, 5); // 0.3 + 0.25 * (0.9 - 0.3) = 0.45
      
      // At 75% (750ms)
      const result75 = interpolateViewportFromKeyframes(keyframes, 750_000);
      expect(result75.zoom).toBeCloseTo(2.5, 5); // 1.0 + 0.75 * (3.0 - 1.0) = 2.5
      expect(result75.center.x).toBeCloseTo(0.65, 5); // 0.2 + 0.75 * (0.8 - 0.2) = 0.65
      expect(result75.center.y).toBeCloseTo(0.75, 5); // 0.3 + 0.75 * (0.9 - 0.3) = 0.75
    });
  });

  describe('multiple keyframes', () => {
    it('interpolates between correct adjacent keyframes', () => {
      const keyframes = [
        createKeyframe('kf-1', 0, 1.0, 0.0, 0.0),
        createKeyframe('kf-2', 1_000_000, 2.0, 0.5, 0.5),
        createKeyframe('kf-3', 2_000_000, 3.0, 1.0, 1.0),
      ];
      
      // Between kf-1 and kf-2 (at 500ms)
      const result1 = interpolateViewportFromKeyframes(keyframes, 500_000);
      expect(result1.zoom).toBeCloseTo(1.5, 5);
      expect(result1.center.x).toBeCloseTo(0.25, 5);
      
      // Between kf-2 and kf-3 (at 1500ms)
      const result2 = interpolateViewportFromKeyframes(keyframes, 1_500_000);
      expect(result2.zoom).toBeCloseTo(2.5, 5);
      expect(result2.center.x).toBeCloseTo(0.75, 5);
    });
  });
});

// ============================================================================
// Requirement 1.7: Preview SHALL update in real-time to show new zoom behavior
// ============================================================================

describe('Requirement 1.7: Real-time preview update on keyframe change', () => {
  it('viewport changes when keyframe zoom level is modified', () => {
    // Initial keyframes
    const keyframes1 = [
      createKeyframe('kf-1', 0, 1.0, 0.5, 0.5),
      createKeyframe('kf-2', 1_000_000, 2.0, 0.5, 0.5),
    ];
    
    // Get viewport at midpoint
    const viewport1 = interpolateViewportFromKeyframes(keyframes1, 500_000);
    expect(viewport1.zoom).toBeCloseTo(1.5, 5);
    
    // Simulate user modifying kf-2's zoom level to 3.0
    const keyframes2 = [
      createKeyframe('kf-1', 0, 1.0, 0.5, 0.5),
      createKeyframe('kf-2', 1_000_000, 3.0, 0.5, 0.5), // Changed from 2.0 to 3.0
    ];
    
    // Viewport should now reflect the change
    const viewport2 = interpolateViewportFromKeyframes(keyframes2, 500_000);
    expect(viewport2.zoom).toBeCloseTo(2.0, 5); // 1.0 + 0.5 * (3.0 - 1.0) = 2.0
  });

  it('viewport changes when keyframe position is modified', () => {
    // Initial keyframes
    const keyframes1 = [
      createKeyframe('kf-1', 0, 1.5, 0.3, 0.3),
      createKeyframe('kf-2', 1_000_000, 1.5, 0.7, 0.7),
    ];
    
    // Get viewport at midpoint
    const viewport1 = interpolateViewportFromKeyframes(keyframes1, 500_000);
    expect(viewport1.center.x).toBeCloseTo(0.5, 5);
    expect(viewport1.center.y).toBeCloseTo(0.5, 5);
    
    // Simulate user modifying kf-2's position
    const keyframes2 = [
      createKeyframe('kf-1', 0, 1.5, 0.3, 0.3),
      createKeyframe('kf-2', 1_000_000, 1.5, 0.9, 0.9), // Changed from (0.7, 0.7) to (0.9, 0.9)
    ];
    
    // Viewport should now reflect the change
    const viewport2 = interpolateViewportFromKeyframes(keyframes2, 500_000);
    expect(viewport2.center.x).toBeCloseTo(0.6, 5); // 0.3 + 0.5 * (0.9 - 0.3) = 0.6
    expect(viewport2.center.y).toBeCloseTo(0.6, 5);
  });

  it('viewport changes when keyframe timestamp is modified', () => {
    // Initial keyframes
    const keyframes1 = [
      createKeyframe('kf-1', 0, 1.0, 0.5, 0.5),
      createKeyframe('kf-2', 1_000_000, 2.0, 0.5, 0.5),
    ];
    
    // Get viewport at 500ms (midpoint between 0 and 1000ms)
    const viewport1 = interpolateViewportFromKeyframes(keyframes1, 500_000);
    expect(viewport1.zoom).toBeCloseTo(1.5, 5);
    
    // Simulate user dragging kf-2 to 2000ms
    const keyframes2 = [
      createKeyframe('kf-1', 0, 1.0, 0.5, 0.5),
      createKeyframe('kf-2', 2_000_000, 2.0, 0.5, 0.5), // Changed from 1000ms to 2000ms
    ];
    
    // At 500ms, we're now only 25% through the interpolation
    const viewport2 = interpolateViewportFromKeyframes(keyframes2, 500_000);
    expect(viewport2.zoom).toBeCloseTo(1.25, 5); // 1.0 + 0.25 * (2.0 - 1.0) = 1.25
  });
});
