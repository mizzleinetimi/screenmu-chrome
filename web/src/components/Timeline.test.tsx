// Timeline component tests
// Tests for keyframe interaction features (Requirements 1.2, 1.5)

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';
import type { ZoomMarker } from '../types';

// Mock CSS import
vi.mock('../styles/Timeline.css', () => ({}));

describe('Timeline', () => {
    const defaultProps = {
        duration: 10000000, // 10 seconds in microseconds
        currentTime: 0,
        markers: [] as ZoomMarker[],
        selectedMarkerId: null,
        onSeek: vi.fn(),
        onMarkerSelect: vi.fn(),
    };

    const createMarker = (id: string, timestamp: number, zoomLevel = 1.5): ZoomMarker => ({
        id,
        timestamp,
        position: { x: 0.5, y: 0.5 },
        zoomLevel,
    });

    describe('marker selection (Requirement 1.2)', () => {
        it('should call onMarkerSelect when a marker is clicked', () => {
            const onMarkerSelect = vi.fn();
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    onMarkerSelect={onMarkerSelect}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            expect(markerElement).toBeTruthy();

            fireEvent.click(markerElement!);
            expect(onMarkerSelect).toHaveBeenCalledWith('marker-1');
        });

        it('should show selected state visually when marker is selected', () => {
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    selectedMarkerId="marker-1"
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            expect(markerElement?.classList.contains('selected')).toBe(true);
        });

        it('should not show selected state when marker is not selected', () => {
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    selectedMarkerId={null}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            expect(markerElement?.classList.contains('selected')).toBe(false);
        });

        it('should not trigger seek when clicking on a marker', () => {
            const onSeek = vi.fn();
            const onMarkerSelect = vi.fn();
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    onSeek={onSeek}
                    onMarkerSelect={onMarkerSelect}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            fireEvent.click(markerElement!);

            // onMarkerSelect should be called, but onSeek should not
            expect(onMarkerSelect).toHaveBeenCalledWith('marker-1');
            expect(onSeek).not.toHaveBeenCalled();
        });
    });

    describe('marker dragging (Requirement 1.5)', () => {
        it('should call onMarkerTimestampChange when marker is dragged', () => {
            const onMarkerTimestampChange = vi.fn();
            const markers = [createMarker('marker-1', 5000000)]; // 5 seconds

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    onMarkerTimestampChange={onMarkerTimestampChange}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            const trackElement = container.querySelector('.timeline-track');
            expect(markerElement).toBeTruthy();
            expect(trackElement).toBeTruthy();

            // Simulate drag: mousedown on marker, mousemove on track, mouseup on track
            fireEvent.mouseDown(markerElement!, { clientX: 100 });
            fireEvent.mouseMove(trackElement!, { clientX: 150 });
            fireEvent.mouseUp(trackElement!);

            // Should have been called with the new timestamp
            expect(onMarkerTimestampChange).toHaveBeenCalled();
            expect(onMarkerTimestampChange.mock.calls[0][0]).toBe('marker-1');
        });

        it('should show dragging state visually during drag', () => {
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            const trackElement = container.querySelector('.timeline-track');

            // Start drag
            fireEvent.mouseDown(markerElement!, { clientX: 100 });

            // Check dragging class is applied
            expect(markerElement?.classList.contains('dragging')).toBe(true);
            expect(trackElement?.classList.contains('dragging')).toBe(true);

            // End drag
            fireEvent.mouseUp(trackElement!);

            // Dragging class should be removed
            expect(markerElement?.classList.contains('dragging')).toBe(false);
            expect(trackElement?.classList.contains('dragging')).toBe(false);
        });

        it('should select marker when starting to drag', () => {
            const onMarkerSelect = vi.fn();
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    onMarkerSelect={onMarkerSelect}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            fireEvent.mouseDown(markerElement!, { clientX: 100 });

            expect(onMarkerSelect).toHaveBeenCalledWith('marker-1');
        });

        it('should not call onMarkerTimestampChange if timestamp did not change', () => {
            const onMarkerTimestampChange = vi.fn();
            const markers = [createMarker('marker-1', 5000000)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                    onMarkerTimestampChange={onMarkerTimestampChange}
                />
            );

            const markerElement = container.querySelector('.timeline-marker');
            const trackElement = container.querySelector('.timeline-track');

            // Mock getBoundingClientRect for the track
            Object.defineProperty(trackElement, 'getBoundingClientRect', {
                value: () => ({
                    left: 0,
                    width: 100,
                    top: 0,
                    height: 32,
                    right: 100,
                    bottom: 32,
                }),
            });

            // Simulate drag with no movement
            fireEvent.mouseDown(markerElement!, { clientX: 50 });
            fireEvent.mouseMove(trackElement!, { clientX: 50 }); // Same position
            fireEvent.mouseUp(trackElement!);

            // Should not have been called since position didn't change
            expect(onMarkerTimestampChange).not.toHaveBeenCalled();
        });
    });

    describe('timeline track interaction', () => {
        it('should call onSeek when clicking on the track', () => {
            const onSeek = vi.fn();

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    onSeek={onSeek}
                />
            );

            const trackElement = container.querySelector('.timeline-track');
            expect(trackElement).toBeTruthy();

            // Mock getBoundingClientRect
            Object.defineProperty(trackElement, 'getBoundingClientRect', {
                value: () => ({
                    left: 0,
                    width: 100,
                    top: 0,
                    height: 32,
                    right: 100,
                    bottom: 32,
                }),
            });

            fireEvent.click(trackElement!, { clientX: 50 });

            // Should seek to 50% of duration (5 seconds)
            expect(onSeek).toHaveBeenCalledWith(5000000);
        });

        it('should display correct playhead position', () => {
            const { container } = render(
                <Timeline
                    {...defaultProps}
                    currentTime={2500000} // 2.5 seconds
                    duration={10000000} // 10 seconds
                />
            );

            const playhead = container.querySelector('.timeline-playhead');
            expect(playhead).toBeTruthy();
            // Playhead should be at 25%
            expect(playhead?.getAttribute('style')).toContain('left: 25%');
        });
    });

    describe('marker positioning', () => {
        it('should position markers correctly based on timestamp', () => {
            const markers = [
                createMarker('marker-1', 2500000), // 25%
                createMarker('marker-2', 7500000), // 75%
            ];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                />
            );

            const markerElements = container.querySelectorAll('.timeline-marker');
            expect(markerElements.length).toBe(2);

            // First marker at 25%
            expect(markerElements[0].getAttribute('style')).toContain('left: 25%');
            // Second marker at 75%
            expect(markerElements[1].getAttribute('style')).toContain('left: 75%');
        });

        it('should display zoom level in marker label', () => {
            const markers = [createMarker('marker-1', 5000000, 2.0)];

            const { container } = render(
                <Timeline
                    {...defaultProps}
                    markers={markers}
                />
            );

            const markerLabel = container.querySelector('.marker-label');
            expect(markerLabel?.textContent).toBe('2.0x');
        });
    });

    describe('time formatting', () => {
        it('should format time correctly', () => {
            const { container } = render(
                <Timeline
                    {...defaultProps}
                    currentTime={65000000} // 1:05
                    duration={120000000} // 2:00
                />
            );

            const times = container.querySelector('.timeline-times');
            expect(times?.textContent).toContain('1:05');
            expect(times?.textContent).toContain('2:00');
        });
    });
});
