// Export pipeline module exports
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

export {
  type Size,
  type PresetName,
  type ResolutionPreset,
  RESOLUTION_DIMENSIONS,
  PRESET_LABELS,
  ALL_PRESETS,
  getTargetDimensions,
  getAspectRatio,
} from './resolutions';

export {
  type AspectRatioMode,
  type Rect,
  type AspectRatioResult,
  calculateAspectRatio,
} from './aspectRatio';

export {
  type CompositorConfig,
  Compositor,
  createCompositor,
} from './compositor';
