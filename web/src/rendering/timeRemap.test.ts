// Time remapping utilities tests
// Validates: Requirements 4.5, 4.8 - Time remapper accounts for speed changes
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect } from 'vitest';
import {
  toTimeRangeConfig,
  toSpeedRampConfig,
  createTimeRemapperConfig,
  calculateExportDuration,
  toSourceTime,
  getSpeedAt,
  isCut,
  generateFrameTimestampsWithRemap,
  // Audio handling functions (Requirement 4.6)
  AUDIO_MUTE_SPEED_THRESHOLD,
  shouldMuteAudioAtSpeed,
  getAudioPlaybackRate,
  getAudioStateAtTime,
} from './timeRemap';
import type { TimeRange, SpeedRamp } from '../types';

describe('timeRemap', () => {
  // =========================================================================
  // Configuration Conversion Tests
  // =========================================================================

  describe('toTimeRangeConfig', () => {
    it('converts TimeRange to TimeRangeConfig', () => {
      const range: TimeRange = { start: 1000000, end: 2000000 };
      const config = toTimeRangeConfig(range);
      
      expect(config.start_us).toBe(1000000);
      expect(config.end_us).toBe(2000000);
    });
  });

  describe('toSpeedRampConfig', () => {
    it('converts SpeedRamp to SpeedRampConfig', () => {
      const ramp: SpeedRamp = {
        range: { start: 1000000, end: 2000000 },
        speed: 2.0,
      };
      const config = toSpeedRampConfig(ramp);
      
      expect(config.start_us).toBe(1000000);
      expect(config.end_us).toBe(2000000);
      expect(config.speed).toBe(2.0);
    });
  });

  describe('createTimeRemapperConfig', () => {
    it('creates config with empty cuts and speed ramps', () => {
      const config = createTimeRemapperConfig(0, 10000000);
      
      expect(config.in_point_us).toBe(0);
      expect(config.out_point_us).toBe(10000000);
      expect(config.cuts).toEqual([]);
      expect(config.speed_ramps).toEqual([]);
    });

    it('creates config with cuts and speed ramps', () => {
      const cuts: TimeRange[] = [{ start: 2000000, end: 4000000 }];
      const speedRamps: SpeedRamp[] = [
        { range: { start: 5000000, end: 7000000 }, speed: 2.0 },
      ];
      
      const config = createTimeRemapperConfig(0, 10000000, cuts, speedRamps);
      
      expect(config.cuts).toHaveLength(1);
      expect(config.cuts[0].start_us).toBe(2000000);
      expect(config.cuts[0].end_us).toBe(4000000);
      expect(config.speed_ramps).toHaveLength(1);
      expect(config.speed_ramps[0].start_us).toBe(5000000);
      expect(config.speed_ramps[0].end_us).toBe(7000000);
      expect(config.speed_ramps[0].speed).toBe(2.0);
    });
  });

  // =========================================================================
  // Export Duration Tests
  // =========================================================================

  describe('calculateExportDuration', () => {
    it('returns trimmed duration with no cuts or speed ramps', () => {
      const duration = calculateExportDuration(0, 10000000);
      expect(duration).toBe(10000000);
    });

    it('returns 0 for invalid range', () => {
      expect(calculateExportDuration(10000000, 0)).toBe(0);
      expect(calculateExportDuration(5000000, 5000000)).toBe(0);
    });

    it('subtracts cut duration from export', () => {
      // 10 second video with a 2 second cut (2s-4s)
      // Export duration should be 8 seconds
      const cuts: TimeRange[] = [{ start: 2000000, end: 4000000 }];
      const duration = calculateExportDuration(0, 10000000, cuts);
      expect(duration).toBe(8000000);
    });

    it('handles multiple cuts', () => {
      // 10 second video with two cuts:
      // - Cut from 1s-2s (1 second)
      // - Cut from 5s-7s (2 seconds)
      // Export duration: 10 - 1 - 2 = 7 seconds
      const cuts: TimeRange[] = [
        { start: 1000000, end: 2000000 },
        { start: 5000000, end: 7000000 },
      ];
      const duration = calculateExportDuration(0, 10000000, cuts);
      expect(duration).toBe(7000000);
    });

    /**
     * **Validates: Requirements 4.5**
     * Property: Speed Ramp Duration
     * For any speed ramp with source duration D and speed S, the export duration
     * for that segment SHALL be D / S.
     */
    it('adjusts duration for speed ramps (2x speed)', () => {
      // 10 second video with 2x speed from 2s-4s
      // 0-2s: 2s at 1x = 2s export
      // 2-4s: 2s at 2x = 1s export
      // 4-10s: 6s at 1x = 6s export
      // Total: 9s export
      const speedRamps: SpeedRamp[] = [
        { range: { start: 2000000, end: 4000000 }, speed: 2.0 },
      ];
      const duration = calculateExportDuration(0, 10000000, [], speedRamps);
      expect(duration).toBe(9000000);
    });

    /**
     * **Validates: Requirements 4.5**
     * Property: Speed Ramp Duration
     * Slow motion (0.5x) should increase export duration.
     */
    it('adjusts duration for slow motion (0.5x speed)', () => {
      // 10 second video with 0.5x speed from 2s-4s
      // 0-2s: 2s at 1x = 2s export
      // 2-4s: 2s at 0.5x = 4s export
      // 4-10s: 6s at 1x = 6s export
      // Total: 12s export
      const speedRamps: SpeedRamp[] = [
        { range: { start: 2000000, end: 4000000 }, speed: 0.5 },
      ];
      const duration = calculateExportDuration(0, 10000000, [], speedRamps);
      expect(duration).toBe(12000000);
    });

    it('handles combined cuts and speed ramps', () => {
      // 10 second video:
      // - Cut from 2s-3s (1 second removed)
      // - 2x speed from 5s-7s (2 seconds source -> 1 second export)
      // Export duration: 10 - 1 - 1 = 8 seconds
      const cuts: TimeRange[] = [{ start: 2000000, end: 3000000 }];
      const speedRamps: SpeedRamp[] = [
        { range: { start: 5000000, end: 7000000 }, speed: 2.0 },
      ];
      const duration = calculateExportDuration(0, 10000000, cuts, speedRamps);
      expect(duration).toBe(8000000);
    });
  });

  // =========================================================================
  // Source Time Mapping Tests
  // =========================================================================

  describe('toSourceTime', () => {
    it('returns in_point for export time 0', () => {
      const sourceTime = toSourceTime(0, 0, 10000000);
      expect(sourceTime).toBe(0);
    });

    it('maps export time directly with no cuts or speed ramps', () => {
      const sourceTime = toSourceTime(5000000, 0, 10000000);
      expect(sourceTime).toBe(5000000);
    });

    it('accounts for trim offset', () => {
      // Video trimmed from 2s to 8s
      // Export time 0 -> Source time 2s
      const sourceTime = toSourceTime(0, 2000000, 8000000);
      expect(sourceTime).toBe(2000000);
    });

    it('skips over cuts', () => {
      // 10 second video with a 2 second cut (2s-4s)
      const cuts: TimeRange[] = [{ start: 2000000, end: 4000000 }];
      
      // Export time 0 -> Source time 0
      expect(toSourceTime(0, 0, 10000000, cuts)).toBe(0);
      
      // Export time 1s -> Source time 1s (before cut)
      expect(toSourceTime(1000000, 0, 10000000, cuts)).toBe(1000000);
      
      // Export time 2s -> Source time 4s (after cut)
      expect(toSourceTime(2000000, 0, 10000000, cuts)).toBe(4000000);
      
      // Export time 3s -> Source time 5s
      expect(toSourceTime(3000000, 0, 10000000, cuts)).toBe(5000000);
    });

    /**
     * **Validates: Requirements 4.5, 4.8**
     * Time remapper accounts for speed changes in time mapping.
     */
    it('accounts for speed ramps', () => {
      // 10 second video with 2x speed from 2s-4s
      const speedRamps: SpeedRamp[] = [
        { range: { start: 2000000, end: 4000000 }, speed: 2.0 },
      ];
      
      // Export time 0 -> Source time 0
      expect(toSourceTime(0, 0, 10000000, [], speedRamps)).toBe(0);
      
      // Export time 2s -> Source time 2s (start of speed ramp)
      expect(toSourceTime(2000000, 0, 10000000, [], speedRamps)).toBe(2000000);
      
      // Export time 2.5s -> Source time 3s (middle of 2x speed ramp)
      // 0.5s export at 2x speed = 1s source
      expect(toSourceTime(2500000, 0, 10000000, [], speedRamps)).toBe(3000000);
      
      // Export time 3s -> Source time 4s (end of speed ramp)
      expect(toSourceTime(3000000, 0, 10000000, [], speedRamps)).toBe(4000000);
      
      // Export time 4s -> Source time 5s (after speed ramp)
      expect(toSourceTime(4000000, 0, 10000000, [], speedRamps)).toBe(5000000);
    });

    it('handles cut at start', () => {
      // Cut at the very beginning
      const cuts: TimeRange[] = [{ start: 0, end: 2000000 }];
      
      // Export time 0 should skip to after the cut
      expect(toSourceTime(0, 0, 10000000, cuts)).toBe(2000000);
    });
  });

  // =========================================================================
  // Speed At Tests
  // =========================================================================

  describe('getSpeedAt', () => {
    it('returns 1.0 with no speed ramps', () => {
      expect(getSpeedAt(5000000)).toBe(1.0);
    });

    it('returns speed when in a speed ramp', () => {
      const speedRamps: SpeedRamp[] = [
        { range: { start: 2000000, end: 4000000 }, speed: 2.0 },
      ];
      
      expect(getSpeedAt(1000000, speedRamps)).toBe(1.0);
      expect(getSpeedAt(2000000, speedRamps)).toBe(2.0);
      expect(getSpeedAt(3000000, speedRamps)).toBe(2.0);
      expect(getSpeedAt(4000000, speedRamps)).toBe(1.0);
    });
  });

  // =========================================================================
  // Is Cut Tests
  // =========================================================================

  describe('isCut', () => {
    it('returns false with no cuts', () => {
      expect(isCut(5000000)).toBe(false);
    });

    it('returns true when in a cut region', () => {
      const cuts: TimeRange[] = [{ start: 2000000, end: 4000000 }];
      
      expect(isCut(1000000, cuts)).toBe(false);
      expect(isCut(2000000, cuts)).toBe(true);
      expect(isCut(3000000, cuts)).toBe(true);
      expect(isCut(4000000, cuts)).toBe(false); // exclusive end
    });
  });

  // =========================================================================
  // Frame Timestamp Generation Tests
  // =========================================================================

  describe('generateFrameTimestampsWithRemap', () => {
    it('returns empty result for invalid inputs', () => {
      const result = generateFrameTimestampsWithRemap(-1, 10000000);
      expect(result.frameCount).toBe(0);
      expect(result.sourceTimestamps).toEqual([]);
    });

    it('generates timestamps for simple case', () => {
      // 1 second video at 30 fps = 30 frames
      const result = generateFrameTimestampsWithRemap(0, 1000000, [], [], 30);
      
      expect(result.frameCount).toBe(30);
      expect(result.exportDuration).toBe(1000000);
      expect(result.sourceTimestamps[0]).toBe(0);
      expect(result.exportTimestamps[0]).toBe(0);
    });

    it('accounts for cuts in frame generation', () => {
      // 2 second video with 1 second cut = 1 second export = 30 frames
      const cuts: TimeRange[] = [{ start: 500000, end: 1500000 }];
      const result = generateFrameTimestampsWithRemap(0, 2000000, cuts, [], 30);
      
      expect(result.exportDuration).toBe(1000000);
      expect(result.frameCount).toBe(30);
    });

    /**
     * **Validates: Requirements 4.5, 4.8**
     * Frame generation accounts for speed ramps.
     */
    it('accounts for speed ramps in frame generation', () => {
      // 2 second video with 2x speed for entire duration = 1 second export = 30 frames
      const speedRamps: SpeedRamp[] = [
        { range: { start: 0, end: 2000000 }, speed: 2.0 },
      ];
      const result = generateFrameTimestampsWithRemap(0, 2000000, [], speedRamps, 30);
      
      expect(result.exportDuration).toBe(1000000);
      expect(result.frameCount).toBe(30);
      
      // Source timestamps should span the full 2 seconds
      // First frame at source 0
      expect(result.sourceTimestamps[0]).toBe(0);
      // Last frame should be near source 2 seconds
      const lastSourceTimestamp = result.sourceTimestamps[result.sourceTimestamps.length - 1];
      expect(lastSourceTimestamp).toBeLessThanOrEqual(2000000);
    });

    it('maps export timestamps to correct source timestamps', () => {
      // 4 second video with 2x speed from 1s-3s
      // 0-1s: 1s at 1x = 1s export
      // 1-3s: 2s at 2x = 1s export
      // 3-4s: 1s at 1x = 1s export
      // Total: 3s export
      const speedRamps: SpeedRamp[] = [
        { range: { start: 1000000, end: 3000000 }, speed: 2.0 },
      ];
      const result = generateFrameTimestampsWithRemap(0, 4000000, [], speedRamps, 30);
      
      expect(result.exportDuration).toBe(3000000);
      // 3 seconds at 30 fps = 90 frames
      expect(result.frameCount).toBe(90);
    });
  });

  // =========================================================================
  // Audio Handling During Speed Ramps Tests
  // Validates: Requirement 4.6 - WHEN audio is sped up beyond 2x, THE system SHALL optionally mute the audio
  // =========================================================================

  describe('Audio handling during speed ramps', () => {
    describe('AUDIO_MUTE_SPEED_THRESHOLD', () => {
      it('should be 2.0', () => {
        expect(AUDIO_MUTE_SPEED_THRESHOLD).toBe(2.0);
      });
    });

    describe('shouldMuteAudioAtSpeed', () => {
      /**
       * **Validates: Requirement 4.6**
       * Audio should NOT be muted at speeds <= 2x
       */
      it('returns false for speeds <= 2x', () => {
        expect(shouldMuteAudioAtSpeed(0.25)).toBe(false);
        expect(shouldMuteAudioAtSpeed(0.5)).toBe(false);
        expect(shouldMuteAudioAtSpeed(1.0)).toBe(false);
        expect(shouldMuteAudioAtSpeed(1.5)).toBe(false);
        expect(shouldMuteAudioAtSpeed(2.0)).toBe(false);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio should be muted at speeds > 2x
       */
      it('returns true for speeds > 2x', () => {
        expect(shouldMuteAudioAtSpeed(2.01)).toBe(true);
        expect(shouldMuteAudioAtSpeed(2.5)).toBe(true);
        expect(shouldMuteAudioAtSpeed(3.0)).toBe(true);
        expect(shouldMuteAudioAtSpeed(4.0)).toBe(true);
      });

      it('handles edge case at exactly 2x', () => {
        // At exactly 2x, audio should NOT be muted (threshold is >2x)
        expect(shouldMuteAudioAtSpeed(2.0)).toBe(false);
      });
    });

    describe('getAudioPlaybackRate', () => {
      /**
       * **Validates: Requirement 4.6**
       * For speeds <= 2x, audio playback rate should match the speed
       */
      it('returns the speed for speeds <= 2x', () => {
        expect(getAudioPlaybackRate(0.25)).toBe(0.25);
        expect(getAudioPlaybackRate(0.5)).toBe(0.5);
        expect(getAudioPlaybackRate(1.0)).toBe(1.0);
        expect(getAudioPlaybackRate(1.5)).toBe(1.5);
        expect(getAudioPlaybackRate(2.0)).toBe(2.0);
      });

      /**
       * **Validates: Requirement 4.6**
       * For speeds > 2x, audio will be muted so playback rate defaults to 1.0
       */
      it('returns 1.0 for speeds > 2x (audio will be muted)', () => {
        expect(getAudioPlaybackRate(2.5)).toBe(1.0);
        expect(getAudioPlaybackRate(3.0)).toBe(1.0);
        expect(getAudioPlaybackRate(4.0)).toBe(1.0);
      });
    });

    describe('getAudioStateAtTime', () => {
      /**
       * **Validates: Requirement 4.6**
       * Audio state should be unmuted with normal playback rate when no speed ramps
       */
      it('returns unmuted with playbackRate 1.0 when no speed ramps', () => {
        const state = getAudioStateAtTime(5000000);
        expect(state.muted).toBe(false);
        expect(state.playbackRate).toBe(1.0);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio should be unmuted with adjusted playback rate for speeds <= 2x
       */
      it('returns unmuted with adjusted playbackRate for speeds <= 2x', () => {
        const speedRamps: SpeedRamp[] = [
          { range: { start: 2000000, end: 4000000 }, speed: 1.5 },
        ];
        
        // Before speed ramp
        const stateBefore = getAudioStateAtTime(1000000, speedRamps);
        expect(stateBefore.muted).toBe(false);
        expect(stateBefore.playbackRate).toBe(1.0);
        
        // During speed ramp (1.5x)
        const stateDuring = getAudioStateAtTime(3000000, speedRamps);
        expect(stateDuring.muted).toBe(false);
        expect(stateDuring.playbackRate).toBe(1.5);
        
        // After speed ramp
        const stateAfter = getAudioStateAtTime(5000000, speedRamps);
        expect(stateAfter.muted).toBe(false);
        expect(stateAfter.playbackRate).toBe(1.0);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio should be muted for speeds > 2x
       */
      it('returns muted for speeds > 2x', () => {
        const speedRamps: SpeedRamp[] = [
          { range: { start: 2000000, end: 4000000 }, speed: 3.0 },
        ];
        
        // Before speed ramp - unmuted
        const stateBefore = getAudioStateAtTime(1000000, speedRamps);
        expect(stateBefore.muted).toBe(false);
        expect(stateBefore.playbackRate).toBe(1.0);
        
        // During speed ramp (3x) - muted
        const stateDuring = getAudioStateAtTime(3000000, speedRamps);
        expect(stateDuring.muted).toBe(true);
        expect(stateDuring.playbackRate).toBe(1.0); // Rate doesn't matter when muted
        
        // After speed ramp - unmuted
        const stateAfter = getAudioStateAtTime(5000000, speedRamps);
        expect(stateAfter.muted).toBe(false);
        expect(stateAfter.playbackRate).toBe(1.0);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio state should handle multiple speed ramps correctly
       */
      it('handles multiple speed ramps with different speeds', () => {
        const speedRamps: SpeedRamp[] = [
          { range: { start: 1000000, end: 2000000 }, speed: 1.5 },  // <= 2x, unmuted
          { range: { start: 3000000, end: 4000000 }, speed: 3.0 },  // > 2x, muted
          { range: { start: 5000000, end: 6000000 }, speed: 2.0 },  // exactly 2x, unmuted
        ];
        
        // First ramp (1.5x) - unmuted
        const state1 = getAudioStateAtTime(1500000, speedRamps);
        expect(state1.muted).toBe(false);
        expect(state1.playbackRate).toBe(1.5);
        
        // Second ramp (3x) - muted
        const state2 = getAudioStateAtTime(3500000, speedRamps);
        expect(state2.muted).toBe(true);
        expect(state2.playbackRate).toBe(1.0);
        
        // Third ramp (2x) - unmuted
        const state3 = getAudioStateAtTime(5500000, speedRamps);
        expect(state3.muted).toBe(false);
        expect(state3.playbackRate).toBe(2.0);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio state should handle slow motion (< 1x) correctly
       */
      it('handles slow motion speeds correctly', () => {
        const speedRamps: SpeedRamp[] = [
          { range: { start: 2000000, end: 4000000 }, speed: 0.5 },
        ];
        
        const state = getAudioStateAtTime(3000000, speedRamps);
        expect(state.muted).toBe(false);
        expect(state.playbackRate).toBe(0.5);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio state should handle the minimum speed (0.25x) correctly
       */
      it('handles minimum speed (0.25x) correctly', () => {
        const speedRamps: SpeedRamp[] = [
          { range: { start: 2000000, end: 4000000 }, speed: 0.25 },
        ];
        
        const state = getAudioStateAtTime(3000000, speedRamps);
        expect(state.muted).toBe(false);
        expect(state.playbackRate).toBe(0.25);
      });

      /**
       * **Validates: Requirement 4.6**
       * Audio state should handle the maximum speed (4x) correctly
       */
      it('handles maximum speed (4x) correctly', () => {
        const speedRamps: SpeedRamp[] = [
          { range: { start: 2000000, end: 4000000 }, speed: 4.0 },
        ];
        
        const state = getAudioStateAtTime(3000000, speedRamps);
        expect(state.muted).toBe(true);
        expect(state.playbackRate).toBe(1.0);
      });
    });
  });
});
