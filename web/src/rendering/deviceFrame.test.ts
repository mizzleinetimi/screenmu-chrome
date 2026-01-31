// Device frame rendering tests for Phase 2 Visual Polish
// LLM Disclosure: This file was generated with AI assistance.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CanvasRect, Size } from './types';
import type { DeviceFrameConfig, DeviceFrameType } from './deviceFrame';
import {
  DEFAULT_DEVICE_FRAME_CONFIG,
  renderDeviceFrame,
  calculateContentRectForFrame,
  getFrameDimensions,
  createDeviceFrameConfig,
} from './deviceFrame';

// ============================================================================
// Mock Canvas Context
// ============================================================================

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
}

// ============================================================================
// Default Configuration Tests
// ============================================================================

describe('DEFAULT_DEVICE_FRAME_CONFIG', () => {
  it('should have type set to none', () => {
    expect(DEFAULT_DEVICE_FRAME_CONFIG.type).toBe('none');
  });

  it('should have showTrafficLights enabled', () => {
    expect(DEFAULT_DEVICE_FRAME_CONFIG.showTrafficLights).toBe(true);
  });
});

// ============================================================================
// createDeviceFrameConfig Tests
// ============================================================================

describe('createDeviceFrameConfig', () => {
  it('should return default config when no overrides provided', () => {
    const config = createDeviceFrameConfig();
    expect(config).toEqual(DEFAULT_DEVICE_FRAME_CONFIG);
  });

  it('should override type when provided', () => {
    const config = createDeviceFrameConfig({ type: 'browser' });
    expect(config.type).toBe('browser');
    expect(config.showTrafficLights).toBe(true);
  });

  it('should override showTrafficLights when provided', () => {
    const config = createDeviceFrameConfig({ showTrafficLights: false });
    expect(config.showTrafficLights).toBe(false);
    expect(config.type).toBe('none');
  });

  it('should include browserTitle when provided', () => {
    const config = createDeviceFrameConfig({
      type: 'browser',
      browserTitle: 'My App',
    });
    expect(config.browserTitle).toBe('My App');
  });

  it('should include browserUrl when provided', () => {
    const config = createDeviceFrameConfig({
      type: 'browser',
      browserUrl: 'https://example.com',
    });
    expect(config.browserUrl).toBe('https://example.com');
  });
});

// ============================================================================
// renderDeviceFrame Tests
// ============================================================================

describe('renderDeviceFrame', () => {
  let ctx: CanvasRenderingContext2D;
  const contentRect: CanvasRect = { x: 50, y: 50, width: 800, height: 600 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should not render anything for type "none"', () => {
    const config: DeviceFrameConfig = { type: 'none', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('should skip rendering for zero-width content rect', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: true };
    const zeroRect: CanvasRect = { x: 50, y: 50, width: 0, height: 600 };
    renderDeviceFrame(ctx, zeroRect, config);

    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('should skip rendering for zero-height content rect', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: true };
    const zeroRect: CanvasRect = { x: 50, y: 50, width: 800, height: 0 };
    renderDeviceFrame(ctx, zeroRect, config);

    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('should render browser frame when type is "browser"', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('should render traffic lights for browser frame when enabled', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    // Traffic lights are rendered using arc
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('should not render traffic lights when disabled', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: false };
    renderDeviceFrame(ctx, contentRect, config);

    // arc should not be called for traffic lights
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('should render browser title when provided', () => {
    const config: DeviceFrameConfig = {
      type: 'browser',
      showTrafficLights: true,
      browserTitle: 'Test Title',
    };
    renderDeviceFrame(ctx, contentRect, config);

    expect(ctx.fillText).toHaveBeenCalledWith(
      'Test Title',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('should render browser URL when provided', () => {
    const config: DeviceFrameConfig = {
      type: 'browser',
      showTrafficLights: true,
      browserUrl: 'https://example.com',
    };
    renderDeviceFrame(ctx, contentRect, config);

    expect(ctx.fillText).toHaveBeenCalledWith(
      'https://example.com',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('should render macbook frame when type is "macbook"', () => {
    const config: DeviceFrameConfig = { type: 'macbook', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('should render macbook camera notch', () => {
    const config: DeviceFrameConfig = { type: 'macbook', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    // Camera notch is rendered using arc
    expect(ctx.arc).toHaveBeenCalled();
  });
});

// ============================================================================
// calculateContentRectForFrame Tests
// ============================================================================

describe('calculateContentRectForFrame', () => {
  const availableRect: CanvasRect = { x: 0, y: 0, width: 1000, height: 800 };

  it('should return same rect for type "none"', () => {
    const result = calculateContentRectForFrame('none', availableRect);
    expect(result).toEqual(availableRect);
  });

  it('should adjust y and height for browser frame', () => {
    const result = calculateContentRectForFrame('browser', availableRect);

    // Browser frame adds 40px title bar at top
    expect(result.x).toBe(0);
    expect(result.y).toBe(40); // Title bar height
    expect(result.width).toBe(1000);
    expect(result.height).toBe(760); // 800 - 40
  });

  it('should adjust all dimensions for macbook frame', () => {
    const result = calculateContentRectForFrame('macbook', availableRect);

    // MacBook frame adds bezel around and keyboard below
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.width).toBeLessThan(1000);
    expect(result.height).toBeLessThan(800);
  });

  it('should handle unknown frame type as none', () => {
    const result = calculateContentRectForFrame('unknown' as DeviceFrameType, availableRect);
    expect(result).toEqual(availableRect);
  });
});

// ============================================================================
// getFrameDimensions Tests
// ============================================================================

describe('getFrameDimensions', () => {
  const contentSize: Size = { width: 800, height: 600 };

  it('should return same size for type "none"', () => {
    const result = getFrameDimensions('none', contentSize);
    expect(result).toEqual(contentSize);
  });

  it('should add title bar height for browser frame', () => {
    const result = getFrameDimensions('browser', contentSize);

    expect(result.width).toBe(800);
    expect(result.height).toBe(640); // 600 + 40 title bar
  });

  it('should add bezel and keyboard for macbook frame', () => {
    const result = getFrameDimensions('macbook', contentSize);

    // MacBook adds bezel (12*2) + keyboard overhang (40) to width
    expect(result.width).toBeGreaterThan(800);
    // MacBook adds bezel (12*2) + chin (24) + keyboard (80) to height
    expect(result.height).toBeGreaterThan(600);
  });

  it('should handle unknown frame type as none', () => {
    const result = getFrameDimensions('unknown' as DeviceFrameType, contentSize);
    expect(result).toEqual(contentSize);
  });
});

// ============================================================================
// Requirement Validation Tests
// ============================================================================

describe('Requirement 3.1: Device Frame Types', () => {
  /**
   * Validates: Requirement 3.1
   * THE system SHALL support at least 3 device frame types: Browser (Chrome-style), MacBook, and None
   */
  it('should support "none" frame type', () => {
    const config = createDeviceFrameConfig({ type: 'none' });
    expect(config.type).toBe('none');
  });

  it('should support "browser" frame type', () => {
    const config = createDeviceFrameConfig({ type: 'browser' });
    expect(config.type).toBe('browser');
  });

  it('should support "macbook" frame type', () => {
    const config = createDeviceFrameConfig({ type: 'macbook' });
    expect(config.type).toBe('macbook');
  });
});

describe('Requirement 3.3: Browser Frame Features', () => {
  /**
   * Validates: Requirement 3.3
   * THE Browser frame SHALL include a title bar with traffic light buttons and optional URL bar
   */
  let ctx: CanvasRenderingContext2D;
  const contentRect: CanvasRect = { x: 50, y: 50, width: 800, height: 600 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should render title bar for browser frame', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    // Title bar is rendered using roundRect
    expect(ctx.roundRect).toHaveBeenCalled();
  });

  it('should render traffic light buttons', () => {
    const config: DeviceFrameConfig = { type: 'browser', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    // Traffic lights are rendered using arc (3 circles)
    expect(ctx.arc).toHaveBeenCalledTimes(3);
  });

  it('should support optional URL bar', () => {
    const config: DeviceFrameConfig = {
      type: 'browser',
      showTrafficLights: true,
      browserUrl: 'https://example.com',
    };
    renderDeviceFrame(ctx, contentRect, config);

    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('Requirement 3.4: MacBook Frame Features', () => {
  /**
   * Validates: Requirement 3.4
   * THE MacBook frame SHALL include the laptop bezel and keyboard area
   */
  let ctx: CanvasRenderingContext2D;
  const contentRect: CanvasRect = { x: 50, y: 100, width: 800, height: 600 };

  beforeEach(() => {
    ctx = createMockContext();
  });

  it('should render bezel for macbook frame', () => {
    const config: DeviceFrameConfig = { type: 'macbook', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    // Bezel is rendered using roundRect
    expect(ctx.roundRect).toHaveBeenCalled();
  });

  it('should render keyboard area for macbook frame', () => {
    const config: DeviceFrameConfig = { type: 'macbook', showTrafficLights: true };
    renderDeviceFrame(ctx, contentRect, config);

    // Multiple roundRect calls for bezel, screen, keyboard, trackpad
    const roundRectCalls = (ctx.roundRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(roundRectCalls.length).toBeGreaterThanOrEqual(3);
  });
});
