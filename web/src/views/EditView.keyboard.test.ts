// Tests for EditView keyboard shortcuts (undo/redo)
// Validates: Requirements 5.2, 5.3
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UndoManager, type EditAction } from '../editing/UndoManager';
import type { ZoomMarker, TimeRange, SpeedRamp } from '../types';

/**
 * These tests verify the undo/redo logic that is used by the keyboard shortcuts.
 * The actual keyboard event handling is tested through the UndoManager class.
 * 
 * Validates:
 * - Requirement 5.2: THE user SHALL be able to undo the last action using Ctrl/Cmd+Z
 * - Requirement 5.3: THE user SHALL be able to redo an undone action using Ctrl/Cmd+Shift+Z
 */

describe('Undo/Redo Keyboard Shortcut Logic', () => {
    let undoManager: UndoManager;

    beforeEach(() => {
        undoManager = new UndoManager();
    });

    describe('Undo (Ctrl/Cmd+Z)', () => {
        it('should return the action to reverse when undo is called', () => {
            const keyframe: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            const action: EditAction = { type: 'add_keyframe', keyframe };
            
            undoManager.push(action);
            const undoneAction = undoManager.undo();
            
            expect(undoneAction).toEqual(action);
            expect(undoneAction?.type).toBe('add_keyframe');
        });

        it('should return null when no actions to undo', () => {
            const undoneAction = undoManager.undo();
            expect(undoneAction).toBeNull();
        });

        it('should handle add_keyframe undo (reverse: remove keyframe)', () => {
            const keyframe: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            undoManager.push({ type: 'add_keyframe', keyframe });
            
            const action = undoManager.undo();
            
            // The action tells us to reverse add_keyframe by removing the keyframe
            expect(action?.type).toBe('add_keyframe');
            if (action?.type === 'add_keyframe') {
                expect(action.keyframe.id).toBe('kf-1');
            }
        });

        it('should handle delete_keyframe undo (reverse: add keyframe back)', () => {
            const keyframe: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            undoManager.push({ type: 'delete_keyframe', keyframe });
            
            const action = undoManager.undo();
            
            // The action tells us to reverse delete_keyframe by adding the keyframe back
            expect(action?.type).toBe('delete_keyframe');
            if (action?.type === 'delete_keyframe') {
                expect(action.keyframe.id).toBe('kf-1');
            }
        });

        it('should handle update_keyframe undo (reverse: restore before state)', () => {
            const before: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            const after: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 2.0,
            };
            undoManager.push({ type: 'update_keyframe', id: 'kf-1', before, after });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('update_keyframe');
            if (action?.type === 'update_keyframe') {
                expect(action.before.zoomLevel).toBe(1.5);
                expect(action.after.zoomLevel).toBe(2.0);
            }
        });

        it('should handle set_trim undo (reverse: restore before trim)', () => {
            const before: TimeRange = { start: 0, end: 10000000 };
            const after: TimeRange = { start: 1000000, end: 9000000 };
            undoManager.push({ type: 'set_trim', before, after });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('set_trim');
            if (action?.type === 'set_trim') {
                expect(action.before.start).toBe(0);
                expect(action.before.end).toBe(10000000);
            }
        });

        it('should handle add_cut undo (reverse: remove cut)', () => {
            const cut: TimeRange = { start: 1000000, end: 2000000 };
            undoManager.push({ type: 'add_cut', cut });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('add_cut');
            if (action?.type === 'add_cut') {
                expect(action.cut.start).toBe(1000000);
                expect(action.cut.end).toBe(2000000);
            }
        });

        it('should handle remove_cut undo (reverse: add cut back)', () => {
            const cut: TimeRange = { start: 1000000, end: 2000000 };
            undoManager.push({ type: 'remove_cut', cut });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('remove_cut');
            if (action?.type === 'remove_cut') {
                expect(action.cut.start).toBe(1000000);
            }
        });

        it('should handle add_speed_ramp undo (reverse: remove ramp)', () => {
            const ramp: SpeedRamp = {
                range: { start: 1000000, end: 2000000 },
                speed: 2.0,
            };
            undoManager.push({ type: 'add_speed_ramp', ramp });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('add_speed_ramp');
            if (action?.type === 'add_speed_ramp') {
                expect(action.ramp.speed).toBe(2.0);
            }
        });

        it('should handle update_speed_ramp undo (reverse: restore before state)', () => {
            const before: SpeedRamp = {
                range: { start: 1000000, end: 2000000 },
                speed: 2.0,
            };
            const after: SpeedRamp = {
                range: { start: 1000000, end: 2000000 },
                speed: 4.0,
            };
            undoManager.push({ type: 'update_speed_ramp', before, after });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('update_speed_ramp');
            if (action?.type === 'update_speed_ramp') {
                expect(action.before.speed).toBe(2.0);
            }
        });

        it('should handle remove_speed_ramp undo (reverse: add ramp back)', () => {
            const ramp: SpeedRamp = {
                range: { start: 1000000, end: 2000000 },
                speed: 2.0,
            };
            undoManager.push({ type: 'remove_speed_ramp', ramp });
            
            const action = undoManager.undo();
            
            expect(action?.type).toBe('remove_speed_ramp');
            if (action?.type === 'remove_speed_ramp') {
                expect(action.ramp.speed).toBe(2.0);
            }
        });
    });

    describe('Redo (Ctrl/Cmd+Shift+Z)', () => {
        it('should return the action to reapply when redo is called after undo', () => {
            const keyframe: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            const action: EditAction = { type: 'add_keyframe', keyframe };
            
            undoManager.push(action);
            undoManager.undo();
            const redoneAction = undoManager.redo();
            
            expect(redoneAction).toEqual(action);
        });

        it('should return null when no actions to redo', () => {
            const redoneAction = undoManager.redo();
            expect(redoneAction).toBeNull();
        });

        it('should return null when redo is called without prior undo', () => {
            const keyframe: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            undoManager.push({ type: 'add_keyframe', keyframe });
            
            const redoneAction = undoManager.redo();
            expect(redoneAction).toBeNull();
        });

        it('should handle multiple undo/redo cycles', () => {
            const keyframe1: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            const keyframe2: ZoomMarker = {
                id: 'kf-2',
                timestamp: 2000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 2.0,
            };
            
            undoManager.push({ type: 'add_keyframe', keyframe: keyframe1 });
            undoManager.push({ type: 'add_keyframe', keyframe: keyframe2 });
            
            // Undo both
            const undo2 = undoManager.undo();
            const undo1 = undoManager.undo();
            
            expect(undo2?.type).toBe('add_keyframe');
            expect(undo1?.type).toBe('add_keyframe');
            if (undo2?.type === 'add_keyframe') {
                expect(undo2.keyframe.id).toBe('kf-2');
            }
            if (undo1?.type === 'add_keyframe') {
                expect(undo1.keyframe.id).toBe('kf-1');
            }
            
            // Redo both
            const redo1 = undoManager.redo();
            const redo2 = undoManager.redo();
            
            expect(redo1?.type).toBe('add_keyframe');
            expect(redo2?.type).toBe('add_keyframe');
            if (redo1?.type === 'add_keyframe') {
                expect(redo1.keyframe.id).toBe('kf-1');
            }
            if (redo2?.type === 'add_keyframe') {
                expect(redo2.keyframe.id).toBe('kf-2');
            }
        });
    });

    describe('Undo/Redo State Management', () => {
        it('should clear redo history when new action is pushed after undo', () => {
            const keyframe1: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            const keyframe2: ZoomMarker = {
                id: 'kf-2',
                timestamp: 2000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 2.0,
            };
            const keyframe3: ZoomMarker = {
                id: 'kf-3',
                timestamp: 3000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 2.5,
            };
            
            undoManager.push({ type: 'add_keyframe', keyframe: keyframe1 });
            undoManager.push({ type: 'add_keyframe', keyframe: keyframe2 });
            
            // Undo one action
            undoManager.undo();
            
            // Push a new action (should clear redo history)
            undoManager.push({ type: 'add_keyframe', keyframe: keyframe3 });
            
            // Redo should return null since history was cleared
            const redoneAction = undoManager.redo();
            expect(redoneAction).toBeNull();
        });

        it('should correctly report canUndo and canRedo states', () => {
            expect(undoManager.canUndo()).toBe(false);
            expect(undoManager.canRedo()).toBe(false);
            
            const keyframe: ZoomMarker = {
                id: 'kf-1',
                timestamp: 1000000,
                position: { x: 0.5, y: 0.5 },
                zoomLevel: 1.5,
            };
            undoManager.push({ type: 'add_keyframe', keyframe });
            
            expect(undoManager.canUndo()).toBe(true);
            expect(undoManager.canRedo()).toBe(false);
            
            undoManager.undo();
            
            expect(undoManager.canUndo()).toBe(false);
            expect(undoManager.canRedo()).toBe(true);
            
            undoManager.redo();
            
            expect(undoManager.canUndo()).toBe(true);
            expect(undoManager.canRedo()).toBe(false);
        });
    });
});
