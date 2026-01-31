// Property-based tests for UndoManager class
// **Validates: Requirements 5.2, 5.3**
// Property 4: Undo/Redo Symmetry - For any edit action A, applying A then undoing SHALL restore the previous state exactly.
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { UndoManager, type EditAction } from './UndoManager';
import type { ZoomMarker, TimeRange, SpeedRamp } from '../types';

// ============================================================================
// ARBITRARIES
// ============================================================================

/**
 * Arbitrary for generating unique IDs.
 */
const idArb = fc.uuid();

/**
 * Arbitrary for timestamps in microseconds (0 to 1 hour).
 */
const timestampArb = fc.integer({ min: 0, max: 3_600_000_000 });

/**
 * Arbitrary for zoom levels (1x to 3x as per design).
 */
const zoomLevelArb = fc.double({ min: 1.0, max: 3.0, noNaN: true });

/**
 * Arbitrary for normalized coordinates (0 to 1).
 */
const normalizedCoordArb = fc.record({
  x: fc.double({ min: 0, max: 1, noNaN: true }),
  y: fc.double({ min: 0, max: 1, noNaN: true }),
});

/**
 * Arbitrary for ZoomMarker.
 */
const zoomMarkerArb: fc.Arbitrary<ZoomMarker> = fc.record({
  id: idArb,
  timestamp: timestampArb,
  position: normalizedCoordArb,
  zoomLevel: zoomLevelArb,
});

/**
 * Arbitrary for TimeRange with valid start < end.
 */
const timeRangeArb: fc.Arbitrary<TimeRange> = fc
  .record({
    start: timestampArb,
    duration: fc.integer({ min: 1000, max: 60_000_000 }), // 1ms to 60s
  })
  .map(({ start, duration }) => ({
    start,
    end: start + duration,
  }));

/**
 * Arbitrary for speed values (0.25x to 4x as per design).
 */
const speedArb = fc.double({ min: 0.25, max: 4.0, noNaN: true });

/**
 * Arbitrary for SpeedRamp.
 */
const speedRampArb: fc.Arbitrary<SpeedRamp> = fc.record({
  range: timeRangeArb,
  speed: speedArb,
});

/**
 * Arbitrary for add_keyframe action.
 */
const addKeyframeActionArb: fc.Arbitrary<EditAction> = zoomMarkerArb.map(
  (keyframe) => ({
    type: 'add_keyframe' as const,
    keyframe,
  })
);

/**
 * Arbitrary for delete_keyframe action.
 */
const deleteKeyframeActionArb: fc.Arbitrary<EditAction> = zoomMarkerArb.map(
  (keyframe) => ({
    type: 'delete_keyframe' as const,
    keyframe,
  })
);

/**
 * Arbitrary for update_keyframe action.
 */
const updateKeyframeActionArb: fc.Arbitrary<EditAction> = fc
  .record({
    id: idArb,
    before: zoomMarkerArb,
    after: zoomMarkerArb,
  })
  .map(({ id, before, after }) => ({
    type: 'update_keyframe' as const,
    id,
    before: { ...before, id },
    after: { ...after, id },
  }));

/**
 * Arbitrary for set_trim action.
 */
const setTrimActionArb: fc.Arbitrary<EditAction> = fc
  .record({
    before: timeRangeArb,
    after: timeRangeArb,
  })
  .map(({ before, after }) => ({
    type: 'set_trim' as const,
    before,
    after,
  }));

/**
 * Arbitrary for add_cut action.
 */
const addCutActionArb: fc.Arbitrary<EditAction> = timeRangeArb.map((cut) => ({
  type: 'add_cut' as const,
  cut,
}));

/**
 * Arbitrary for remove_cut action.
 */
const removeCutActionArb: fc.Arbitrary<EditAction> = timeRangeArb.map(
  (cut) => ({
    type: 'remove_cut' as const,
    cut,
  })
);

/**
 * Arbitrary for add_speed_ramp action.
 */
const addSpeedRampActionArb: fc.Arbitrary<EditAction> = speedRampArb.map(
  (ramp) => ({
    type: 'add_speed_ramp' as const,
    ramp,
  })
);

/**
 * Arbitrary for update_speed_ramp action.
 */
const updateSpeedRampActionArb: fc.Arbitrary<EditAction> = fc
  .record({
    before: speedRampArb,
    after: speedRampArb,
  })
  .map(({ before, after }) => ({
    type: 'update_speed_ramp' as const,
    before,
    after,
  }));

/**
 * Arbitrary for remove_speed_ramp action.
 */
const removeSpeedRampActionArb: fc.Arbitrary<EditAction> = speedRampArb.map(
  (ramp) => ({
    type: 'remove_speed_ramp' as const,
    ramp,
  })
);

/**
 * Arbitrary for any EditAction type.
 */
const editActionArb: fc.Arbitrary<EditAction> = fc.oneof(
  addKeyframeActionArb,
  deleteKeyframeActionArb,
  updateKeyframeActionArb,
  setTrimActionArb,
  addCutActionArb,
  removeCutActionArb,
  addSpeedRampActionArb,
  updateSpeedRampActionArb,
  removeSpeedRampActionArb
);

/**
 * Arbitrary for a non-empty array of EditActions.
 */
const editActionsArb = fc.array(editActionArb, { minLength: 1, maxLength: 20 });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Deep equality check for EditAction objects.
 */
function actionsEqual(a: EditAction, b: EditAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Property 4: Undo/Redo Symmetry', () => {
  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: For any single edit action, pushing then undoing returns the same action.
   * This validates that undo correctly returns the action that was pushed.
   */
  it('undo returns the same action that was pushed', () => {
    fc.assert(
      fc.property(editActionArb, (action) => {
        const manager = new UndoManager();

        // Push the action
        manager.push(action);

        // Undo should return the same action
        const undoneAction = manager.undo();

        expect(undoneAction).not.toBeNull();
        expect(actionsEqual(undoneAction!, action)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: For any single edit action, push -> undo -> redo returns the same action.
   * This validates the symmetry of undo and redo operations.
   */
  it('redo returns the same action that was undone', () => {
    fc.assert(
      fc.property(editActionArb, (action) => {
        const manager = new UndoManager();

        // Push the action
        manager.push(action);

        // Undo the action
        const undoneAction = manager.undo();

        // Redo should return the same action
        const redoneAction = manager.redo();

        expect(redoneAction).not.toBeNull();
        expect(actionsEqual(redoneAction!, action)).toBe(true);
        expect(actionsEqual(redoneAction!, undoneAction!)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: For any sequence of actions, undoing all then redoing all
   * restores the exact same sequence of actions.
   */
  it('undo all then redo all restores exact action sequence', () => {
    fc.assert(
      fc.property(editActionsArb, (actions) => {
        const manager = new UndoManager();

        // Push all actions
        for (const action of actions) {
          manager.push(action);
        }

        // Undo all actions and collect them
        const undoneActions: EditAction[] = [];
        while (manager.canUndo()) {
          const undone = manager.undo();
          if (undone) {
            undoneActions.push(undone);
          }
        }

        // Undone actions should be in reverse order
        expect(undoneActions.length).toBe(actions.length);
        for (let i = 0; i < actions.length; i++) {
          expect(actionsEqual(undoneActions[i], actions[actions.length - 1 - i])).toBe(true);
        }

        // Redo all actions and collect them
        const redoneActions: EditAction[] = [];
        while (manager.canRedo()) {
          const redone = manager.redo();
          if (redone) {
            redoneActions.push(redone);
          }
        }

        // Redone actions should be in original order
        expect(redoneActions.length).toBe(actions.length);
        for (let i = 0; i < actions.length; i++) {
          expect(actionsEqual(redoneActions[i], actions[i])).toBe(true);
        }
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: Multiple undo/redo cycles maintain consistency.
   * After any number of undo/redo cycles, the state should be consistent.
   */
  it('multiple undo/redo cycles maintain consistency', () => {
    fc.assert(
      fc.property(
        editActionsArb,
        fc.integer({ min: 1, max: 10 }), // Number of cycles
        (actions, cycles) => {
          const manager = new UndoManager();

          // Push all actions
          for (const action of actions) {
            manager.push(action);
          }

          // Perform multiple undo/redo cycles
          for (let cycle = 0; cycle < cycles; cycle++) {
            // Undo all
            while (manager.canUndo()) {
              manager.undo();
            }

            // Verify we're at the beginning
            expect(manager.canUndo()).toBe(false);
            expect(manager.canRedo()).toBe(true);

            // Redo all
            while (manager.canRedo()) {
              manager.redo();
            }

            // Verify we're at the end
            expect(manager.canUndo()).toBe(true);
            expect(manager.canRedo()).toBe(false);
          }

          // After all cycles, history should be intact
          expect(manager.getHistoryLength()).toBe(actions.length);
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: Partial undo followed by redo returns to the same state.
   * Undoing N actions then redoing N actions should return the same actions.
   */
  it('partial undo/redo returns to same state', () => {
    fc.assert(
      fc.property(
        editActionsArb,
        fc.integer({ min: 1, max: 20 }),
        (actions, undoCount) => {
          const manager = new UndoManager();

          // Push all actions
          for (const action of actions) {
            manager.push(action);
          }

          // Limit undo count to available actions
          const actualUndoCount = Math.min(undoCount, actions.length);

          // Undo N actions
          const undoneActions: EditAction[] = [];
          for (let i = 0; i < actualUndoCount; i++) {
            const undone = manager.undo();
            if (undone) {
              undoneActions.push(undone);
            }
          }

          // Redo N actions
          const redoneActions: EditAction[] = [];
          for (let i = 0; i < actualUndoCount; i++) {
            const redone = manager.redo();
            if (redone) {
              redoneActions.push(redone);
            }
          }

          // Redone actions should be the reverse of undone actions
          expect(redoneActions.length).toBe(undoneActions.length);
          for (let i = 0; i < redoneActions.length; i++) {
            expect(
              actionsEqual(redoneActions[i], undoneActions[undoneActions.length - 1 - i])
            ).toBe(true);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: Index state is symmetric after undo/redo.
   * After push -> undo -> redo, the index should be the same as after push.
   */
  it('index state is symmetric after undo/redo', () => {
    fc.assert(
      fc.property(editActionsArb, (actions) => {
        const manager = new UndoManager();

        // Push all actions
        for (const action of actions) {
          manager.push(action);
        }

        const indexAfterPush = manager.getCurrentIndex();

        // Undo all
        while (manager.canUndo()) {
          manager.undo();
        }

        expect(manager.getCurrentIndex()).toBe(-1);

        // Redo all
        while (manager.canRedo()) {
          manager.redo();
        }

        // Index should be restored
        expect(manager.getCurrentIndex()).toBe(indexAfterPush);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: canUndo and canRedo are symmetric.
   * After undo, canRedo becomes true. After redo, canUndo becomes true.
   */
  it('canUndo and canRedo are symmetric', () => {
    fc.assert(
      fc.property(editActionArb, (action) => {
        const manager = new UndoManager();

        // Initially, neither undo nor redo is available
        expect(manager.canUndo()).toBe(false);
        expect(manager.canRedo()).toBe(false);

        // After push, can undo but not redo
        manager.push(action);
        expect(manager.canUndo()).toBe(true);
        expect(manager.canRedo()).toBe(false);

        // After undo, can redo but not undo
        manager.undo();
        expect(manager.canUndo()).toBe(false);
        expect(manager.canRedo()).toBe(true);

        // After redo, can undo but not redo
        manager.redo();
        expect(manager.canUndo()).toBe(true);
        expect(manager.canRedo()).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * **Validates: Requirements 5.2, 5.3**
   *
   * Property: History length is preserved through undo/redo cycles.
   * Undo and redo operations should not change the history length.
   */
  it('history length is preserved through undo/redo', () => {
    fc.assert(
      fc.property(editActionsArb, (actions) => {
        const manager = new UndoManager();

        // Push all actions
        for (const action of actions) {
          manager.push(action);
        }

        const originalLength = manager.getHistoryLength();

        // Undo some actions
        const undoCount = Math.floor(actions.length / 2);
        for (let i = 0; i < undoCount; i++) {
          manager.undo();
        }

        // History length should be unchanged
        expect(manager.getHistoryLength()).toBe(originalLength);

        // Redo all undone actions
        for (let i = 0; i < undoCount; i++) {
          manager.redo();
        }

        // History length should still be unchanged
        expect(manager.getHistoryLength()).toBe(originalLength);
      }),
      { numRuns: 500 }
    );
  });
});

