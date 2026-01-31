// TrimHandles component tests
// Validates: Requirements 2.1, 2.4 - Trim handles and visual indication of trimmed regions

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TrimHandles } from './TrimHandles';

// Mock CSS import
vi.mock('../styles/TrimHandles.css', () => ({}));

describe('TrimHandles', () => {
    const defaultProps = {
        duration: 10_000_000, // 10 seconds in microseconds
        inPoint: 0,
        outPoint: 10_000_000,
        onInPointChange: vi.fn(),
        onOutPointChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Requirement 2.1: Display trim handles at start and end', () => {
        it('should render in point handle', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            expect(inHandle).toBeTruthy();
        });

        it('should render out point handle', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const outHandle = container.querySelector('.trim-handle-out');
            expect(outHandle).toBeTruthy();
        });

        it('should position in handle at correct percentage', () => {
            const { container } = render(<TrimHandles {...defaultProps} inPoint={2_000_000} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            expect(inHandle).toBeTruthy();
            // 2 seconds out of 10 = 20%
            expect(inHandle?.getAttribute('style')).toContain('left: 20%');
        });

        it('should position out handle at correct percentage', () => {
            const { container } = render(<TrimHandles {...defaultProps} outPoint={8_000_000} />);
            
            const outHandle = container.querySelector('.trim-handle-out');
            expect(outHandle).toBeTruthy();
            // 8 seconds out of 10 = 80%
            expect(outHandle?.getAttribute('style')).toContain('left: 80%');
        });

        it('should have draggable handles with correct title', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            const outHandle = container.querySelector('.trim-handle-out');
            
            expect(inHandle?.getAttribute('title')).toBe('Drag to set start point');
            expect(outHandle?.getAttribute('title')).toBe('Drag to set end point');
        });
    });

    describe('Requirement 2.4: Visual indication of trimmed regions', () => {
        it('should not show trimmed region when in point is at start', () => {
            const { container } = render(<TrimHandles {...defaultProps} inPoint={0} />);
            
            const startRegion = container.querySelector('.trim-region-start');
            expect(startRegion).toBeFalsy();
        });

        it('should show trimmed region before in point when trimmed', () => {
            const { container } = render(<TrimHandles {...defaultProps} inPoint={2_000_000} />);
            
            const startRegion = container.querySelector('.trim-region-start');
            expect(startRegion).toBeTruthy();
            // 2 seconds out of 10 = 20%
            expect(startRegion?.getAttribute('style')).toContain('width: 20%');
        });

        it('should not show trimmed region when out point is at end', () => {
            const { container } = render(<TrimHandles {...defaultProps} outPoint={10_000_000} />);
            
            const endRegion = container.querySelector('.trim-region-end');
            expect(endRegion).toBeFalsy();
        });

        it('should show trimmed region after out point when trimmed', () => {
            const { container } = render(<TrimHandles {...defaultProps} outPoint={8_000_000} />);
            
            const endRegion = container.querySelector('.trim-region-end');
            expect(endRegion).toBeTruthy();
            // Starts at 80%, width is 20%
            expect(endRegion?.getAttribute('style')).toContain('left: 80%');
            expect(endRegion?.getAttribute('style')).toContain('width: 20%');
        });

        it('should show both trimmed regions when both ends are trimmed', () => {
            const { container } = render(<TrimHandles {...defaultProps} inPoint={2_000_000} outPoint={8_000_000} />);
            
            const startRegion = container.querySelector('.trim-region-start');
            const endRegion = container.querySelector('.trim-region-end');
            
            expect(startRegion).toBeTruthy();
            expect(endRegion).toBeTruthy();
            expect(startRegion?.getAttribute('style')).toContain('width: 20%');
            expect(endRegion?.getAttribute('style')).toContain('left: 80%');
            expect(endRegion?.getAttribute('style')).toContain('width: 20%');
        });

        it('should render active region between in and out points', () => {
            const { container } = render(<TrimHandles {...defaultProps} inPoint={2_000_000} outPoint={8_000_000} />);
            
            const activeRegion = container.querySelector('.trim-active-region');
            expect(activeRegion).toBeTruthy();
            expect(activeRegion?.getAttribute('style')).toContain('left: 20%');
            expect(activeRegion?.getAttribute('style')).toContain('width: 60%');
        });
    });

    describe('Handle interaction', () => {
        it('should have grip lines for visual affordance', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const gripLines = container.querySelectorAll('.grip-line');
            // 3 grip lines per handle, 2 handles = 6 total
            expect(gripLines.length).toBe(6);
        });

        it('should have handle bars', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const handleBars = container.querySelectorAll('.trim-handle-bar');
            expect(handleBars.length).toBe(2);
        });

        it('should show dragging state when in handle is being dragged', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            expect(inHandle).toBeTruthy();
            
            // Start drag
            fireEvent.mouseDown(inHandle!, { clientX: 100 });
            
            // Check dragging class is applied
            expect(inHandle?.classList.contains('dragging')).toBe(true);
        });

        it('should show dragging state when out handle is being dragged', () => {
            const { container } = render(<TrimHandles {...defaultProps} />);
            
            const outHandle = container.querySelector('.trim-handle-out');
            expect(outHandle).toBeTruthy();
            
            // Start drag
            fireEvent.mouseDown(outHandle!, { clientX: 100 });
            
            // Check dragging class is applied
            expect(outHandle?.classList.contains('dragging')).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should handle zero duration gracefully', () => {
            const { container } = render(<TrimHandles {...defaultProps} duration={0} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            const outHandle = container.querySelector('.trim-handle-out');
            
            expect(inHandle?.getAttribute('style')).toContain('left: 0%');
            expect(outHandle?.getAttribute('style')).toContain('left: 100%');
        });

        it('should handle in point equal to out point', () => {
            const { container } = render(<TrimHandles {...defaultProps} inPoint={5_000_000} outPoint={5_000_000} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            const outHandle = container.querySelector('.trim-handle-out');
            
            expect(inHandle?.getAttribute('style')).toContain('left: 50%');
            expect(outHandle?.getAttribute('style')).toContain('left: 50%');
        });

        it('should render all handles at start when duration is zero', () => {
            const { container } = render(<TrimHandles {...defaultProps} duration={0} inPoint={0} outPoint={0} />);
            
            const inHandle = container.querySelector('.trim-handle-in');
            const outHandle = container.querySelector('.trim-handle-out');
            
            expect(inHandle).toBeTruthy();
            expect(outHandle).toBeTruthy();
        });
    });
});
