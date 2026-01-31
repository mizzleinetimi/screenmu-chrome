// Barrel export for rendering module
// LLM Disclosure: This file was generated with AI assistance.

// Types
export type {
  CanvasPoint,
  CanvasRect,
  Size,
  ClickRingAnimationState,
} from './types';

// Background rendering
export type { GradientPreset } from './background';

export {
  GRADIENT_PRESETS,
  DEFAULT_GRADIENT_PRESET_ID,
  getGradientPresetById,
  calculateGradientPoints,
  renderBackground,
  renderBackgroundById,
} from './background';

// Screen frame rendering
export type { ScreenFrameConfig } from './screenFrame';

export {
  DEFAULT_SCREEN_FRAME_CONFIG,
  calculateInsetRect,
  renderScreenFrame,
  createScreenFrameConfig,
} from './screenFrame';

// Device frame rendering
export type { DeviceFrameType, DeviceFrameConfig } from './deviceFrame';

export {
  DEFAULT_DEVICE_FRAME_CONFIG,
  renderDeviceFrame,
  calculateContentRectForFrame,
  getFrameDimensions,
  createDeviceFrameConfig,
} from './deviceFrame';

// Camera bubble rendering
export type { CameraBubbleShape, CameraBubbleConfig } from './cameraBubble';

export {
  DEFAULT_CAMERA_BUBBLE_CONFIG,
  MIN_CAMERA_BUBBLE_SIZE,
  MAX_CAMERA_BUBBLE_SIZE,
  MIN_BACKGROUND_BLUR,
  MAX_BACKGROUND_BLUR,
  clampCameraBubbleSize,
  clampBackgroundBlur,
  isBackgroundBlurSupported,
  calculateCameraBubbleBounds,
  renderCameraBubble,
  createCameraBubbleConfig,
} from './cameraBubble';

// Viewport utilities
export {
  DEFAULT_VIEWPORT,
  toCanvas,
  getSourceRect,
  sanitizeViewport,
  isDefaultViewport,
} from './viewport';

// Effect utilities
export {
  DEFAULT_CLICK_RING_COLOR,
  DEFAULT_CLICK_RING_MAX_RADIUS,
  DEFAULT_CLICK_RING_START_RADIUS,
  DEFAULT_CLICK_RING_START_OPACITY,
  DEFAULT_CLICK_RING_END_OPACITY,
  findActiveEffects,
  calculateClickRingState,
  calculateClickRingProgress,
  calculateClickRingRadius,
  calculateClickRingOpacity,
  renderClickRing,
  renderAllClickRings,
} from './effects';

// Cursor utilities
export type {
  InterpolatedCursor,
  CursorRenderOptions,
} from './cursor';

export {
  DEFAULT_CURSOR_SCALE,
  CONFIDENCE_THRESHOLD,
  DEFAULT_CURSOR_SIZE,
  calculateCursorOpacity,
  interpolateCursor,
  renderCursor,
} from './cursor';

// Compositor
export type {
  CompositorConfig,
  RenderContext,
} from './compositor';

export {
  DEFAULT_CLICK_RING_COLOR as COMPOSITOR_DEFAULT_CLICK_RING_COLOR,
  DEFAULT_CLICK_RING_MAX_RADIUS as COMPOSITOR_DEFAULT_CLICK_RING_MAX_RADIUS,
  createDefaultConfig,
  createConfigFromEditSettings,
  createConfigWithCursor,
  loadCursorSprite,
  CanvasCompositor,
} from './compositor';

// Export utilities
export type {
  FrameTimestampResult,
  TrimmedFrameTimestampResult,
  VideoSeekResult,
  ExportProgress,
} from './export';

export {
  DEFAULT_EXPORT_FPS,
  MAX_SEEK_RETRIES,
  BASE_RETRY_DELAY_MS,
  generateFrameTimestamps,
  generateFrameTimestampsWithTrim,
  calculateFrameCount,
  calculateTrimmedFrameCount,
  frameIndexToTimestamp,
  waitForVideoSeek,
  calculateExportProgress,
} from './export';

// Keyframe utilities (Phase 3)
export type {
  KeyframeSource,
  KeyframeWithSource,
} from './keyframe';

export {
  KEYFRAME_TIMESTAMP_TOLERANCE_US,
  mergeKeyframes,
  mergeKeyframesWithSource,
  isOverriddenByManual,
  findNearestKeyframe,
  areKeyframesAtSameTimestamp,
  countOverriddenKeyframes,
  interpolateViewportFromKeyframes,
  interpolateViewportFromZoomSegments,
  interpolateViewportCombined,
} from './keyframe';

// Time remapping utilities (Phase 3 - Speed Ramps)
export type {
  TimeRemapperConfig,
  TimeRangeConfig,
  SpeedRampConfig,
  RemappedFrameTimestampResult,
} from './timeRemap';

export {
  toTimeRangeConfig,
  toSpeedRampConfig,
  createTimeRemapperConfig,
  serializeTimeRemapperConfig,
  calculateExportDuration,
  toSourceTime,
  getSpeedAt,
  isCut,
  generateFrameTimestampsWithRemap,
  // Audio handling during speed ramps (Requirement 4.6)
  AUDIO_MUTE_SPEED_THRESHOLD,
  shouldMuteAudioAtSpeed,
  getAudioPlaybackRate,
  getAudioStateAtTime,
} from './timeRemap';
