// SpeedRamps component tests
// Validates: Requirement 4.4 - THE timeline SHALL visually indicate speed ramp segments with their speed value
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeedRamps } from './SpeedRamps';
import type { SpeedRamp } from '../types';

describe('SpeedRamps', () => {
    const defaultDuration = 10_000_000; // 10 seconds in microseconds

    describe('rendering', () => {
        it('should render nothing when speedRamps array is empty', () => {
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={[]}
                    selectedRampIndex={null}
                />
            );
            expect(container.querySelector('.speed-ramps')).toBeNull();
        });

        it('should render nothing when duration is 0', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 0, end: 1_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={0}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            expect(container.querySelector('.speed-ramps')).toBeNull();
        });

        it('should render speed ramp segments when speedRamps are provided', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 2 },
                { range: { start: 5_000_000, end: 6_000_000 }, speed: 0.5 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segments = container.querySelectorAll('.speed-ramp');
            expect(segments.length).toBe(2);
        });

        it('should position speed ramp segments correctly based on time', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 2_500_000, end: 5_000_000 }, speed: 2 }, // 25% to 50%
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp') as HTMLElement;
            expect(segment).not.toBeNull();
            expect(segment.style.left).toBe('25%');
            expect(segment.style.width).toBe('25%');
        });

        it('should skip invalid ramps with zero or negative width', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 2_000_000, end: 2_000_000 }, speed: 2 }, // Zero width
                { range: { start: 5_000_000, end: 4_000_000 }, speed: 2 }, // Negative width
                { range: { start: 1_000_000, end: 3_000_000 }, speed: 2 }, // Valid
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segments = container.querySelectorAll('.speed-ramp');
            expect(segments.length).toBe(1);
        });
    });

    describe('speed display', () => {
        it('should display speed value in label for whole numbers', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 2 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const label = container.querySelector('.speed-ramp-label');
            expect(label?.textContent).toBe('2x');
        });

        it('should display speed value in label for common fractions', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 0.5 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const label = container.querySelector('.speed-ramp-label');
            expect(label?.textContent).toBe('0.5x');
        });

        it('should display speed value in label for 0.25x', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 0.25 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const label = container.querySelector('.speed-ramp-label');
            expect(label?.textContent).toBe('0.25x');
        });

        it('should display speed value in label for 4x', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 4 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const label = container.querySelector('.speed-ramp-label');
            expect(label?.textContent).toBe('4x');
        });

        it('should display speed value with one decimal for non-standard values', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 1.5 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const label = container.querySelector('.speed-ramp-label');
            expect(label?.textContent).toBe('1.5x');
        });
    });

    describe('speed type classes', () => {
        it('should apply slow class for speed < 1', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 0.5 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.classList.contains('slow')).toBe(true);
            expect(segment?.classList.contains('fast')).toBe(false);
        });

        it('should apply fast class for speed > 1', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 2 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.classList.contains('fast')).toBe(true);
            expect(segment?.classList.contains('slow')).toBe(false);
        });

        it('should not apply slow or fast class for speed = 1', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 1 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.classList.contains('slow')).toBe(false);
            expect(segment?.classList.contains('fast')).toBe(false);
        });
    });

    describe('selection', () => {
        it('should apply selected class to selected speed ramp segment', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 2 },
                { range: { start: 5_000_000, end: 6_000_000 }, speed: 0.5 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={1}
                />
            );
            const segments = container.querySelectorAll('.speed-ramp');
            expect(segments[0].classList.contains('selected')).toBe(false);
            expect(segments[1].classList.contains('selected')).toBe(true);
        });

        it('should call onRampSelect when a speed ramp segment is clicked', () => {
            const onRampSelect = vi.fn();
            const speedRamps: SpeedRamp[] = [
                { range: { start: 1_000_000, end: 2_000_000 }, speed: 2 },
                { range: { start: 5_000_000, end: 6_000_000 }, speed: 0.5 },
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                    onRampSelect={onRampSelect}
                />
            );
            const segments = container.querySelectorAll('.speed-ramp');
            fireEvent.click(segments[1]);
            expect(onRampSelect).toHaveBeenCalledWith(1);
        });

        it('should call onRampSelect when Enter key is pressed on a speed ramp segment', () => {
            const onRampSelect = vi.fn();
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                    onRampSelect={onRampSelect}
                />
            );
            const segment = container.querySelector('.speed-ramp') as HTMLElement;
            fireEvent.keyDown(segment, { key: 'Enter' });
            expect(onRampSelect).toHaveBeenCalledWith(0);
        });

        it('should call onRampSelect when Space key is pressed on a speed ramp segment', () => {
            const onRampSelect = vi.fn();
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                    onRampSelect={onRampSelect}
                />
            );
            const segment = container.querySelector('.speed-ramp') as HTMLElement;
            fireEvent.keyDown(segment, { key: ' ' });
            expect(onRampSelect).toHaveBeenCalledWith(0);
        });
    });

    describe('size classes', () => {
        it('should apply tiny class for very small speed ramp segments (< 2%)', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 0, end: 100_000 }, speed: 2 }, // 1% of 10 seconds
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.classList.contains('tiny')).toBe(true);
        });

        it('should apply small class for small speed ramp segments (2-5%)', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 0, end: 300_000 }, speed: 2 }, // 3% of 10 seconds
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.classList.contains('small')).toBe(true);
        });

        it('should not apply size class for normal speed ramp segments (>= 5%)', () => {
            const speedRamps: SpeedRamp[] = [
                { range: { start: 0, end: 1_000_000 }, speed: 2 }, // 10% of 10 seconds
            ];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.classList.contains('tiny')).toBe(false);
            expect(segment?.classList.contains('small')).toBe(false);
        });
    });

    describe('accessibility', () => {
        it('should have proper aria-label for speed ramp segments', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = screen.getByRole('button');
            expect(segment.getAttribute('aria-label')).toContain('Speed ramp 2x from 0:01 to 0:02');
        });

        it('should indicate selected state in aria-label', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={0}
                />
            );
            const segment = screen.getByRole('button');
            expect(segment.getAttribute('aria-label')).toContain('selected');
        });

        it('should have tabIndex for keyboard navigation', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const segment = container.querySelector('.speed-ramp');
            expect(segment?.getAttribute('tabindex')).toBe('0');
        });
    });

    describe('visual elements', () => {
        it('should render speed ramp icon element', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const icon = container.querySelector('.speed-ramp-icon');
            expect(icon).not.toBeNull();
        });

        it('should render speed ramp label element with speed value', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const label = container.querySelector('.speed-ramp-label');
            expect(label).not.toBeNull();
            expect(label?.textContent).toBe('2x');
        });

        it('should show turtle emoji for slow-mo', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 0.5 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const icon = container.querySelector('.speed-ramp-icon');
            expect(icon?.textContent).toBe('🐢');
        });

        it('should show lightning emoji for fast-forward', () => {
            const speedRamps: SpeedRamp[] = [{ range: { start: 1_000_000, end: 2_000_000 }, speed: 2 }];
            const { container } = render(
                <SpeedRamps
                    duration={defaultDuration}
                    speedRamps={speedRamps}
                    selectedRampIndex={null}
                />
            );
            const icon = container.querySelector('.speed-ramp-icon');
            expect(icon?.textContent).toBe('⚡');
        });
    });
});
