// UndoManager class for timeline editing undo/redo functionality
// Implements Requirements 5.1 (maintain history) and 5.5 (limit to 50 actions)
// LLM Disclosure: This file was generated with AI assistance.

import type { ZoomMarker, TimeRange, SpeedRamp } from '../types';

// ============================================================================
// EditAction Types
// ============================================================================

/**
 * Represents all possible editing actions that can be undone/redone.
 * Each action type stores the necessary data to reverse the operation.
 */
export type EditAction =
  | { type: 'add_keyframe'; keyframe: ZoomMarker }
  | { type: 'update_keyframe'; id: string; before: ZoomMarker; after: ZoomMarker }
  | { type: 'delete_keyframe'; keyframe: ZoomMarker }
  | { type: 'set_trim'; before: TimeRange; after: TimeRange }
  | { type: 'add_cut'; cut: TimeRange }
  | { type: 'remove_cut'; cut: TimeRange }
  | { type: 'add_speed_ramp'; ramp: SpeedRamp }
  | { type: 'update_speed_ramp'; before: SpeedRamp; after: SpeedRamp }
  | { type: 'remove_speed_ramp'; ramp: SpeedRamp };

// ============================================================================
// UndoManager Class
// ============================================================================

/**
 * Manages undo/redo history for timeline editing operations.
 * 
 * Requirements:
 * - 5.1: THE system SHALL maintain a history of editing actions
 * - 5.5: THE undo history SHALL be limited to the last 50 actions
 */
export class UndoManager {
  private history: EditAction[] = [];
  private index: number = -1;
  private readonly maxHistory: number;

  /**
   * Creates a new UndoManager instance.
   * @param maxHistory Maximum number of actions to keep in history (default: 50)
   */
  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  /**
   * Pushes a new action onto the history stack.
   * 
   * When a new action is pushed:
   * 1. Any redo history (actions after current index) is discarded
   * 2. The new action is added at the current position
   * 3. If history exceeds maxHistory, oldest entries are removed
   * 
   * @param action The edit action to record
   */
  push(action: EditAction): void {
    // Discard any redo history (actions after current index)
    this.history = this.history.slice(0, this.index + 1);
    
    // Add the new action
    this.history.push(action);
    this.index = this.history.length - 1;
    
    // Enforce max history limit (Requirement 5.5)
    if (this.history.length > this.maxHistory) {
      const overflow = this.history.length - this.maxHistory;
      this.history = this.history.slice(overflow);
      this.index = this.history.length - 1;
    }
  }

  /**
   * Undoes the last action and returns it.
   * The returned action contains the data needed to reverse the operation.
   * 
   * @returns The action that was undone, or null if no actions to undo
   */
  undo(): EditAction | null {
    if (!this.canUndo()) {
      return null;
    }
    
    const action = this.history[this.index];
    this.index--;
    return action;
  }

  /**
   * Redoes the next action and returns it.
   * The returned action contains the data needed to reapply the operation.
   * 
   * @returns The action that was redone, or null if no actions to redo
   */
  redo(): EditAction | null {
    if (!this.canRedo()) {
      return null;
    }
    
    this.index++;
    return this.history[this.index];
  }

  /**
   * Checks if there are any actions that can be undone.
   * @returns true if undo is available, false otherwise
   */
  canUndo(): boolean {
    return this.index >= 0;
  }

  /**
   * Checks if there are any actions that can be redone.
   * @returns true if redo is available, false otherwise
   */
  canRedo(): boolean {
    return this.index < this.history.length - 1;
  }

  /**
   * Returns the current number of actions in history.
   * Useful for testing and debugging.
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Returns the current index in the history.
   * Useful for testing and debugging.
   */
  getCurrentIndex(): number {
    return this.index;
  }

  /**
   * Clears all history.
   * Useful when loading a new project or resetting state.
   */
  clear(): void {
    this.history = [];
    this.index = -1;
  }

  /**
   * Returns a copy of the current history.
   * Useful for serialization/persistence.
   */
  getHistory(): EditAction[] {
    return [...this.history];
  }

  /**
   * Restores history from a saved state.
   * Useful for loading persisted undo history.
   * 
   * @param history The history array to restore
   * @param index The index to restore (defaults to end of history)
   */
  restoreHistory(history: EditAction[], index?: number): void {
    // Enforce max history limit on restore
    if (history.length > this.maxHistory) {
      const overflow = history.length - this.maxHistory;
      this.history = history.slice(overflow);
    } else {
      this.history = [...history];
    }
    
    // Set index, defaulting to end of history
    if (index !== undefined) {
      this.index = Math.min(index, this.history.length - 1);
    } else {
      this.index = this.history.length - 1;
    }
  }
}
