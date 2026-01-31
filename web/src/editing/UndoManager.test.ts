// Tests for UndoManager class
// Validates Requirements 5.1 (maintain history) and 5.5 (limit to 50 actions)
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect, beforeEach } from 'vitest';
import { UndoManager, type EditAction } from './UndoManager';
import type { ZoomMarker, TimeRange, SpeedRamp } from '../types';

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

function createTimeRange(start: number, end: number): TimeRange {
  return { start, end };
}

function createSpeedRamp(start: number, end: number, speed: number): SpeedRamp {
  return {
    range: { start, end },
    speed,
  };
}

function createAddKeyframeAction(keyframe: ZoomMarker): EditAction {
  return { type: 'add_keyframe', keyframe };
}

// ============================================================================
// UndoManager Constructor Tests
// ============================================================================

describe('UndoManager constructor', () => {
  it('creates an empty history by default', () => {
    const manager = new UndoManager();
    expect(manager.getHistoryLength()).toBe(0);
    expect(manager.getCurrentIndex()).toBe(-1);
  });

  it('accepts custom maxHistory parameter', () => {
    const manager = new UndoManager(10);
    // Push 15 actions
    for (let i = 0; i < 15; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    // Should only keep 10
    expect(manager.getHistoryLength()).toBe(10);
  });

  it('uses default maxHistory of 50', () => {
    const manager = new UndoManager();
    // Push 55 actions
    for (let i = 0; i < 55; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    // Should only keep 50 (Requirement 5.5)
    expect(manager.getHistoryLength()).toBe(50);
  });
});

// ============================================================================
// push() Tests
// ============================================================================

describe('UndoManager.push()', () => {
  let manager: UndoManager;

  beforeEach(() => {
    manager = new UndoManager();
  });

  it('adds action to history', () => {
    const action = createAddKeyframeAction(createKeyframe('kf-1', 1000));
    manager.push(action);
    
    expect(manager.getHistoryLength()).toBe(1);
    expect(manager.getCurrentIndex()).toBe(0);
  });

  it('adds multiple actions in order', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-3', 3000)));
    
    expect(manager.getHistoryLength()).toBe(3);
    expect(manager.getCurrentIndex()).toBe(2);
  });

  it('discards redo history when new action is pushed after undo', () => {
    // Add 3 actions
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-3', 3000)));
    
    // Undo twice
    manager.undo();
    manager.undo();
    expect(manager.getCurrentIndex()).toBe(0);
    
    // Push new action - should discard kf-2 and kf-3
    manager.push(createAddKeyframeAction(createKeyframe('kf-4', 4000)));
    
    expect(manager.getHistoryLength()).toBe(2);
    expect(manager.getCurrentIndex()).toBe(1);
    expect(manager.canRedo()).toBe(false);
  });

  it('enforces maxHistory limit (Requirement 5.5)', () => {
    const manager = new UndoManager(5);
    
    // Push 7 actions
    for (let i = 0; i < 7; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    
    // Should only keep last 5
    expect(manager.getHistoryLength()).toBe(5);
    expect(manager.getCurrentIndex()).toBe(4);
    
    // Verify oldest actions were removed
    const history = manager.getHistory();
    expect((history[0] as { type: 'add_keyframe'; keyframe: ZoomMarker }).keyframe.id).toBe('kf-2');
    expect((history[4] as { type: 'add_keyframe'; keyframe: ZoomMarker }).keyframe.id).toBe('kf-6');
  });

  it('handles all EditAction types', () => {
    const keyframe = createKeyframe('kf-1', 1000);
    const timeRange = createTimeRange(0, 5000);
    const speedRamp = createSpeedRamp(1000, 2000, 2.0);
    
    manager.push({ type: 'add_keyframe', keyframe });
    manager.push({ type: 'delete_keyframe', keyframe });
    manager.push({ type: 'update_keyframe', id: 'kf-1', before: keyframe, after: { ...keyframe, zoomLevel: 2.0 } });
    manager.push({ type: 'set_trim', before: timeRange, after: { start: 500, end: 4500 } });
    manager.push({ type: 'add_cut', cut: timeRange });
    manager.push({ type: 'remove_cut', cut: timeRange });
    manager.push({ type: 'add_speed_ramp', ramp: speedRamp });
    manager.push({ type: 'update_speed_ramp', before: speedRamp, after: { ...speedRamp, speed: 0.5 } });
    manager.push({ type: 'remove_speed_ramp', ramp: speedRamp });
    
    expect(manager.getHistoryLength()).toBe(9);
  });
});

// ============================================================================
// undo() Tests
// ============================================================================

describe('UndoManager.undo()', () => {
  let manager: UndoManager;

  beforeEach(() => {
    manager = new UndoManager();
  });

  it('returns null when history is empty', () => {
    expect(manager.undo()).toBeNull();
  });

  it('returns the last action and decrements index', () => {
    const action1 = createAddKeyframeAction(createKeyframe('kf-1', 1000));
    const action2 = createAddKeyframeAction(createKeyframe('kf-2', 2000));
    
    manager.push(action1);
    manager.push(action2);
    
    const undone = manager.undo();
    
    expect(undone).toEqual(action2);
    expect(manager.getCurrentIndex()).toBe(0);
  });

  it('can undo all actions', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-3', 3000)));
    
    expect(manager.undo()).not.toBeNull();
    expect(manager.undo()).not.toBeNull();
    expect(manager.undo()).not.toBeNull();
    expect(manager.undo()).toBeNull(); // No more to undo
    
    expect(manager.getCurrentIndex()).toBe(-1);
  });

  it('returns actions in reverse order', () => {
    const action1 = createAddKeyframeAction(createKeyframe('kf-1', 1000));
    const action2 = createAddKeyframeAction(createKeyframe('kf-2', 2000));
    const action3 = createAddKeyframeAction(createKeyframe('kf-3', 3000));
    
    manager.push(action1);
    manager.push(action2);
    manager.push(action3);
    
    expect(manager.undo()).toEqual(action3);
    expect(manager.undo()).toEqual(action2);
    expect(manager.undo()).toEqual(action1);
  });
});

// ============================================================================
// redo() Tests
// ============================================================================

describe('UndoManager.redo()', () => {
  let manager: UndoManager;

  beforeEach(() => {
    manager = new UndoManager();
  });

  it('returns null when no actions to redo', () => {
    expect(manager.redo()).toBeNull();
  });

  it('returns null when at end of history', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    expect(manager.redo()).toBeNull();
  });

  it('returns the next action after undo', () => {
    const action1 = createAddKeyframeAction(createKeyframe('kf-1', 1000));
    const action2 = createAddKeyframeAction(createKeyframe('kf-2', 2000));
    
    manager.push(action1);
    manager.push(action2);
    manager.undo();
    
    const redone = manager.redo();
    
    expect(redone).toEqual(action2);
    expect(manager.getCurrentIndex()).toBe(1);
  });

  it('can redo all undone actions', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-3', 3000)));
    
    // Undo all
    manager.undo();
    manager.undo();
    manager.undo();
    
    // Redo all
    expect(manager.redo()).not.toBeNull();
    expect(manager.redo()).not.toBeNull();
    expect(manager.redo()).not.toBeNull();
    expect(manager.redo()).toBeNull(); // No more to redo
    
    expect(manager.getCurrentIndex()).toBe(2);
  });

  it('returns actions in original order', () => {
    const action1 = createAddKeyframeAction(createKeyframe('kf-1', 1000));
    const action2 = createAddKeyframeAction(createKeyframe('kf-2', 2000));
    const action3 = createAddKeyframeAction(createKeyframe('kf-3', 3000));
    
    manager.push(action1);
    manager.push(action2);
    manager.push(action3);
    
    // Undo all
    manager.undo();
    manager.undo();
    manager.undo();
    
    // Redo should return in original order
    expect(manager.redo()).toEqual(action1);
    expect(manager.redo()).toEqual(action2);
    expect(manager.redo()).toEqual(action3);
  });
});

// ============================================================================
// canUndo() Tests
// ============================================================================

describe('UndoManager.canUndo()', () => {
  let manager: UndoManager;

  beforeEach(() => {
    manager = new UndoManager();
  });

  it('returns false when history is empty', () => {
    expect(manager.canUndo()).toBe(false);
  });

  it('returns true when there are actions to undo', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    expect(manager.canUndo()).toBe(true);
  });

  it('returns false after all actions are undone', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.undo();
    expect(manager.canUndo()).toBe(false);
  });

  it('returns true after redo', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.undo();
    manager.redo();
    expect(manager.canUndo()).toBe(true);
  });
});

// ============================================================================
// canRedo() Tests
// ============================================================================

describe('UndoManager.canRedo()', () => {
  let manager: UndoManager;

  beforeEach(() => {
    manager = new UndoManager();
  });

  it('returns false when history is empty', () => {
    expect(manager.canRedo()).toBe(false);
  });

  it('returns false when at end of history', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    expect(manager.canRedo()).toBe(false);
  });

  it('returns true after undo', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.undo();
    expect(manager.canRedo()).toBe(true);
  });

  it('returns false after all actions are redone', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.undo();
    manager.redo();
    expect(manager.canRedo()).toBe(false);
  });

  it('returns false after new action is pushed (redo history discarded)', () => {
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    manager.undo();
    expect(manager.canRedo()).toBe(true);
    
    // Push new action - discards redo history
    manager.push(createAddKeyframeAction(createKeyframe('kf-3', 3000)));
    expect(manager.canRedo()).toBe(false);
  });
});

// ============================================================================
// clear() Tests
// ============================================================================

describe('UndoManager.clear()', () => {
  it('removes all history', () => {
    const manager = new UndoManager();
    manager.push(createAddKeyframeAction(createKeyframe('kf-1', 1000)));
    manager.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    
    manager.clear();
    
    expect(manager.getHistoryLength()).toBe(0);
    expect(manager.getCurrentIndex()).toBe(-1);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
  });
});

// ============================================================================
// getHistory() Tests
// ============================================================================

describe('UndoManager.getHistory()', () => {
  it('returns empty array when history is empty', () => {
    const manager = new UndoManager();
    expect(manager.getHistory()).toEqual([]);
  });

  it('returns copy of history', () => {
    const manager = new UndoManager();
    const action = createAddKeyframeAction(createKeyframe('kf-1', 1000));
    manager.push(action);
    
    const history = manager.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(action);
    
    // Modifying returned array should not affect internal state
    history.push(createAddKeyframeAction(createKeyframe('kf-2', 2000)));
    expect(manager.getHistoryLength()).toBe(1);
  });
});

// ============================================================================
// restoreHistory() Tests
// ============================================================================

describe('UndoManager.restoreHistory()', () => {
  it('restores history from saved state', () => {
    const manager = new UndoManager();
    const savedHistory: EditAction[] = [
      createAddKeyframeAction(createKeyframe('kf-1', 1000)),
      createAddKeyframeAction(createKeyframe('kf-2', 2000)),
    ];
    
    manager.restoreHistory(savedHistory);
    
    expect(manager.getHistoryLength()).toBe(2);
    expect(manager.getCurrentIndex()).toBe(1);
  });

  it('restores with custom index', () => {
    const manager = new UndoManager();
    const savedHistory: EditAction[] = [
      createAddKeyframeAction(createKeyframe('kf-1', 1000)),
      createAddKeyframeAction(createKeyframe('kf-2', 2000)),
      createAddKeyframeAction(createKeyframe('kf-3', 3000)),
    ];
    
    manager.restoreHistory(savedHistory, 1);
    
    expect(manager.getHistoryLength()).toBe(3);
    expect(manager.getCurrentIndex()).toBe(1);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(true);
  });

  it('clamps index to valid range', () => {
    const manager = new UndoManager();
    const savedHistory: EditAction[] = [
      createAddKeyframeAction(createKeyframe('kf-1', 1000)),
    ];
    
    manager.restoreHistory(savedHistory, 10); // Index too high
    
    expect(manager.getCurrentIndex()).toBe(0);
  });

  it('enforces maxHistory on restore', () => {
    const manager = new UndoManager(3);
    const savedHistory: EditAction[] = [
      createAddKeyframeAction(createKeyframe('kf-1', 1000)),
      createAddKeyframeAction(createKeyframe('kf-2', 2000)),
      createAddKeyframeAction(createKeyframe('kf-3', 3000)),
      createAddKeyframeAction(createKeyframe('kf-4', 4000)),
      createAddKeyframeAction(createKeyframe('kf-5', 5000)),
    ];
    
    manager.restoreHistory(savedHistory);
    
    expect(manager.getHistoryLength()).toBe(3);
    // Should keep the last 3 actions
    const history = manager.getHistory();
    expect((history[0] as { type: 'add_keyframe'; keyframe: ZoomMarker }).keyframe.id).toBe('kf-3');
  });
});

// ============================================================================
// Requirement 5.1: Maintain history of editing actions
// ============================================================================

describe('Requirement 5.1: THE system SHALL maintain a history of editing actions', () => {
  it('maintains history of keyframe changes', () => {
    const manager = new UndoManager();
    const keyframe = createKeyframe('kf-1', 1000);
    
    manager.push({ type: 'add_keyframe', keyframe });
    manager.push({ type: 'update_keyframe', id: 'kf-1', before: keyframe, after: { ...keyframe, zoomLevel: 2.0 } });
    manager.push({ type: 'delete_keyframe', keyframe });
    
    expect(manager.getHistoryLength()).toBe(3);
    
    const history = manager.getHistory();
    expect(history[0].type).toBe('add_keyframe');
    expect(history[1].type).toBe('update_keyframe');
    expect(history[2].type).toBe('delete_keyframe');
  });

  it('maintains history of trim changes', () => {
    const manager = new UndoManager();
    
    manager.push({ 
      type: 'set_trim', 
      before: { start: 0, end: 10000 }, 
      after: { start: 1000, end: 9000 } 
    });
    
    expect(manager.getHistoryLength()).toBe(1);
    expect(manager.getHistory()[0].type).toBe('set_trim');
  });

  it('maintains history of cut changes', () => {
    const manager = new UndoManager();
    const cut = createTimeRange(2000, 4000);
    
    manager.push({ type: 'add_cut', cut });
    manager.push({ type: 'remove_cut', cut });
    
    expect(manager.getHistoryLength()).toBe(2);
    expect(manager.getHistory()[0].type).toBe('add_cut');
    expect(manager.getHistory()[1].type).toBe('remove_cut');
  });

  it('maintains history of speed ramp changes', () => {
    const manager = new UndoManager();
    const ramp = createSpeedRamp(1000, 3000, 2.0);
    
    manager.push({ type: 'add_speed_ramp', ramp });
    manager.push({ type: 'update_speed_ramp', before: ramp, after: { ...ramp, speed: 0.5 } });
    manager.push({ type: 'remove_speed_ramp', ramp });
    
    expect(manager.getHistoryLength()).toBe(3);
    expect(manager.getHistory()[0].type).toBe('add_speed_ramp');
    expect(manager.getHistory()[1].type).toBe('update_speed_ramp');
    expect(manager.getHistory()[2].type).toBe('remove_speed_ramp');
  });
});

// ============================================================================
// Requirement 5.5: Undo history limited to 50 actions
// ============================================================================

describe('Requirement 5.5: THE undo history SHALL be limited to the last 50 actions', () => {
  it('limits history to 50 actions', () => {
    const manager = new UndoManager();
    
    // Push 60 actions
    for (let i = 0; i < 60; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    
    expect(manager.getHistoryLength()).toBe(50);
  });

  it('removes oldest actions when limit is exceeded', () => {
    const manager = new UndoManager();
    
    // Push 55 actions
    for (let i = 0; i < 55; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    
    const history = manager.getHistory();
    
    // First action should be kf-5 (oldest 5 were removed)
    expect((history[0] as { type: 'add_keyframe'; keyframe: ZoomMarker }).keyframe.id).toBe('kf-5');
    // Last action should be kf-54
    expect((history[49] as { type: 'add_keyframe'; keyframe: ZoomMarker }).keyframe.id).toBe('kf-54');
  });

  it('maintains correct index after overflow', () => {
    const manager = new UndoManager();
    
    // Push 55 actions
    for (let i = 0; i < 55; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    
    // Index should point to last action
    expect(manager.getCurrentIndex()).toBe(49);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
  });
});

// ============================================================================
// Undo/Redo Workflow Integration Tests
// ============================================================================

describe('Undo/Redo workflow integration', () => {
  it('supports typical editing workflow', () => {
    const manager = new UndoManager();
    
    // User adds a keyframe
    const kf1 = createKeyframe('kf-1', 1000);
    manager.push({ type: 'add_keyframe', keyframe: kf1 });
    
    // User modifies the keyframe
    const kf1Updated = { ...kf1, zoomLevel: 2.0 };
    manager.push({ type: 'update_keyframe', id: 'kf-1', before: kf1, after: kf1Updated });
    
    // User adds a cut
    const cut = createTimeRange(5000, 7000);
    manager.push({ type: 'add_cut', cut });
    
    // User undoes the cut
    const undone1 = manager.undo();
    expect(undone1?.type).toBe('add_cut');
    
    // User undoes the keyframe update
    const undone2 = manager.undo();
    expect(undone2?.type).toBe('update_keyframe');
    
    // User redoes the keyframe update
    const redone1 = manager.redo();
    expect(redone1?.type).toBe('update_keyframe');
    
    // User makes a new change (discards redo history)
    const speedRamp = createSpeedRamp(2000, 4000, 1.5);
    manager.push({ type: 'add_speed_ramp', ramp: speedRamp });
    
    // Can no longer redo the cut
    expect(manager.canRedo()).toBe(false);
    
    // History should have: add_keyframe, update_keyframe, add_speed_ramp
    expect(manager.getHistoryLength()).toBe(3);
  });

  it('handles rapid undo/redo cycles', () => {
    const manager = new UndoManager();
    
    // Add 10 actions
    for (let i = 0; i < 10; i++) {
      manager.push(createAddKeyframeAction(createKeyframe(`kf-${i}`, i * 1000)));
    }
    
    // Undo 5
    for (let i = 0; i < 5; i++) {
      manager.undo();
    }
    expect(manager.getCurrentIndex()).toBe(4);
    
    // Redo 3
    for (let i = 0; i < 3; i++) {
      manager.redo();
    }
    expect(manager.getCurrentIndex()).toBe(7);
    
    // Undo 2
    for (let i = 0; i < 2; i++) {
      manager.undo();
    }
    expect(manager.getCurrentIndex()).toBe(5);
    
    // All actions still in history
    expect(manager.getHistoryLength()).toBe(10);
  });
});
