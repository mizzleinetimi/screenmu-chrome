// CutSegments component tests
// Validates: Requirement 3.2 - THE timeline SHALL visually indicate cut segments with a different color or pattern
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CutSegments, type TimeRange } from './CutSegments';

describe('CutSegments', () => {
    const defaultDuration = 10_000_000; // 10 seconds in microseconds

    describe('rendering', () => {
        it('should render nothing when cuts array is empty', () => {
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={[]}
                    selectedCutIndex={null}
                />
            );
            expect(container.querySelector('.cut-segments')).toBeNull();
        });

        it('should render nothing when duration is 0', () => {
            const cuts: TimeRange[] = [{ start: 0, end: 1_000_000 }];
            const { container } = render(
                <CutSegments
                    duration={0}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            expect(container.querySelector('.cut-segments')).toBeNull();
        });

        it('should render cut segments when cuts are provided', () => {
            const cuts: TimeRange[] = [
                { start: 1_000_000, end: 2_000_000 },
                { start: 5_000_000, end: 6_000_000 },
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segments = container.querySelectorAll('.cut-segment');
            expect(segments.length).toBe(2);
        });

        it('should position cut segments correctly based on time', () => {
            const cuts: TimeRange[] = [
                { start: 2_500_000, end: 5_000_000 }, // 25% to 50%
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segment = container.querySelector('.cut-segment') as HTMLElement;
            expect(segment).not.toBeNull();
            expect(segment.style.left).toBe('25%');
            expect(segment.style.width).toBe('25%');
        });

        it('should skip invalid cuts with zero or negative width', () => {
            const cuts: TimeRange[] = [
                { start: 2_000_000, end: 2_000_000 }, // Zero width
                { start: 5_000_000, end: 4_000_000 }, // Negative width
                { start: 1_000_000, end: 3_000_000 }, // Valid
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segments = container.querySelectorAll('.cut-segment');
            expect(segments.length).toBe(1);
        });
    });

    describe('selection', () => {
        it('should apply selected class to selected cut segment', () => {
            const cuts: TimeRange[] = [
                { start: 1_000_000, end: 2_000_000 },
                { start: 5_000_000, end: 6_000_000 },
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={1}
                />
            );
            const segments = container.querySelectorAll('.cut-segment');
            expect(segments[0].classList.contains('selected')).toBe(false);
            expect(segments[1].classList.contains('selected')).toBe(true);
        });

        it('should call onCutSelect when a cut segment is clicked', () => {
            const onCutSelect = vi.fn();
            const cuts: TimeRange[] = [
                { start: 1_000_000, end: 2_000_000 },
                { start: 5_000_000, end: 6_000_000 },
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                    onCutSelect={onCutSelect}
                />
            );
            const segments = container.querySelectorAll('.cut-segment');
            fireEvent.click(segments[1]);
            expect(onCutSelect).toHaveBeenCalledWith(1);
        });

        it('should call onCutSelect when Enter key is pressed on a cut segment', () => {
            const onCutSelect = vi.fn();
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                    onCutSelect={onCutSelect}
                />
            );
            const segment = container.querySelector('.cut-segment') as HTMLElement;
            fireEvent.keyDown(segment, { key: 'Enter' });
            expect(onCutSelect).toHaveBeenCalledWith(0);
        });

        it('should call onCutSelect when Space key is pressed on a cut segment', () => {
            const onCutSelect = vi.fn();
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                    onCutSelect={onCutSelect}
                />
            );
            const segment = container.querySelector('.cut-segment') as HTMLElement;
            fireEvent.keyDown(segment, { key: ' ' });
            expect(onCutSelect).toHaveBeenCalledWith(0);
        });
    });

    describe('size classes', () => {
        it('should apply tiny class for very small cut segments (< 2%)', () => {
            const cuts: TimeRange[] = [
                { start: 0, end: 100_000 }, // 1% of 10 seconds
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segment = container.querySelector('.cut-segment');
            expect(segment?.classList.contains('tiny')).toBe(true);
        });

        it('should apply small class for small cut segments (2-5%)', () => {
            const cuts: TimeRange[] = [
                { start: 0, end: 300_000 }, // 3% of 10 seconds
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segment = container.querySelector('.cut-segment');
            expect(segment?.classList.contains('small')).toBe(true);
        });

        it('should not apply size class for normal cut segments (>= 5%)', () => {
            const cuts: TimeRange[] = [
                { start: 0, end: 1_000_000 }, // 10% of 10 seconds
            ];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segment = container.querySelector('.cut-segment');
            expect(segment?.classList.contains('tiny')).toBe(false);
            expect(segment?.classList.contains('small')).toBe(false);
        });
    });

    describe('accessibility', () => {
        it('should have proper aria-label for cut segments', () => {
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segment = screen.getByRole('button');
            expect(segment.getAttribute('aria-label')).toContain('Cut segment from 0:01 to 0:02');
        });

        it('should indicate selected state in aria-label', () => {
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={0}
                />
            );
            const segment = screen.getByRole('button');
            expect(segment.getAttribute('aria-label')).toContain('selected');
        });

        it('should have tabIndex for keyboard navigation', () => {
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const segment = container.querySelector('.cut-segment');
            expect(segment?.getAttribute('tabindex')).toBe('0');
        });
    });

    describe('visual elements', () => {
        it('should render cut icon element', () => {
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const icon = container.querySelector('.cut-segment-icon');
            expect(icon).not.toBeNull();
        });

        it('should render cut label element', () => {
            const cuts: TimeRange[] = [{ start: 1_000_000, end: 2_000_000 }];
            const { container } = render(
                <CutSegments
                    duration={defaultDuration}
                    cuts={cuts}
                    selectedCutIndex={null}
                />
            );
            const label = container.querySelector('.cut-segment-label');
            expect(label).not.toBeNull();
            expect(label?.textContent).toBe('CUT');
        });
    });
});
