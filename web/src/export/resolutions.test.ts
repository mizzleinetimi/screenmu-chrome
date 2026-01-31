// Property tests for resolution scaling
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getTargetDimensions,
  RESOLUTION_DIMENSIONS,
  type Size,
  type ResolutionPreset,
  type PresetName,
  ALL_PRESETS,
} from './resolutions';

/**
 * **Property: Resolution Scaling**
 * **Validates: Requirements 1.3**
 *
 * For any source resolution (sw, sh) and target resolution (tw, th),
 * the output SHALL have exactly dimensions (tw, th).
 */
describe('Resolution Scaling Property', () => {
  // Arbitrary for valid video dimensions (reasonable range)
  const sizeArb = fc.record({
    width: fc.integer({ min: 320, max: 7680 }),
    height: fc.integer({ min: 240, max: 4320 }),
  });

  // Arbitrary for preset names
  const presetNameArb = fc.constantFrom<PresetName>(...ALL_PRESETS);

  it('preset resolution returns exact target dimensions regardless of source', () => {
    fc.assert(
      fc.property(sizeArb, presetNameArb, (sourceSize: Size, presetName: PresetName) => {
        const preset: ResolutionPreset = { type: 'preset', name: presetName };
        const result = getTargetDimensions(preset, sourceSize);
        const expected = RESOLUTION_DIMENSIONS[presetName];

        // Output SHALL have exactly the preset dimensions
        expect(result.width).toBe(expected.width);
        expect(result.height).toBe(expected.height);
      }),
      { numRuns: 100 }
    );
  });

  it('native resolution returns exact source dimensions', () => {
    fc.assert(
      fc.property(sizeArb, (sourceSize: Size) => {
        const preset: ResolutionPreset = { type: 'native' };
        const result = getTargetDimensions(preset, sourceSize);

        // Output SHALL have exactly the source dimensions
        expect(result.width).toBe(sourceSize.width);
        expect(result.height).toBe(sourceSize.height);
      }),
      { numRuns: 100 }
    );
  });

  it('target dimensions are always positive integers', () => {
    fc.assert(
      fc.property(
        sizeArb,
        fc.oneof(
          presetNameArb.map((name): ResolutionPreset => ({ type: 'preset', name })),
          fc.constant<ResolutionPreset>({ type: 'native' })
        ),
        (sourceSize: Size, preset: ResolutionPreset) => {
          const result = getTargetDimensions(preset, sourceSize);

          expect(result.width).toBeGreaterThan(0);
          expect(result.height).toBeGreaterThan(0);
          expect(Number.isInteger(result.width)).toBe(true);
          expect(Number.isInteger(result.height)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
