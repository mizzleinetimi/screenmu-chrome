// Compositor for rendering video at target resolution
// LLM-assisted: initial scaffold generated with AI assistance per hackathon disclosure rules.

import type { Size } from './resolutions';
import { getTargetDimensions, type ResolutionPreset } from './resolutions';
import { calculateAspectRatio, type AspectRatioMode } from './aspectRatio';

/**
 * Configuration for the export compositor
 */
export interface CompositorConfig {
  preset: ResolutionPreset;
  aspectRatioMode: AspectRatioMode;
  sourceSize: Size;
}

/**
 * Compositor handles rendering frames at the target resolution
 * with proper aspect ratio handling
 */
export class Compositor {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private targetSize: Size;
  private sourceSize: Size;
  private aspectRatioMode: AspectRatioMode;

  constructor(config: CompositorConfig) {
    this.sourceSize = config.sourceSize;
    this.aspectRatioMode = config.aspectRatioMode;
    this.targetSize = getTargetDimensions(config.preset, config.sourceSize);

    this.canvas = new OffscreenCanvas(this.targetSize.width, this.targetSize.height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2d context from OffscreenCanvas');
    }
    this.ctx = ctx;
  }

  /**
   * Get the target output dimensions
   */
  getTargetSize(): Size {
    return { ...this.targetSize };
  }

  /**
   * Get the underlying canvas for stream capture
   */
  getCanvas(): OffscreenCanvas {
    return this.canvas;
  }

  /**
   * Render a video frame to the compositor canvas
   * Applies aspect ratio handling (letterbox or crop)
   *
   * @param source - Video element or ImageBitmap to render
   */
  renderFrame(source: HTMLVideoElement | ImageBitmap | VideoFrame): void {
    // Clear canvas with black (for letterbox bars)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.targetSize.width, this.targetSize.height);

    // Calculate source and destination rectangles
    const { sourceRect, destRect } = calculateAspectRatio(
      this.sourceSize,
      this.targetSize,
      this.aspectRatioMode
    );

    // Draw the frame with aspect ratio handling
    this.ctx.drawImage(
      source,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      destRect.x,
      destRect.y,
      destRect.width,
      destRect.height
    );
  }

  /**
   * Get the current frame as an ImageBitmap
   */
  async getFrameBitmap(): Promise<ImageBitmap> {
    return createImageBitmap(this.canvas);
  }

  /**
   * Get the current frame as ImageData
   */
  getFrameImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.targetSize.width, this.targetSize.height);
  }
}

/**
 * Create a compositor for export with the given settings
 */
export function createCompositor(
  preset: ResolutionPreset,
  aspectRatioMode: AspectRatioMode,
  sourceSize: Size
): Compositor {
  return new Compositor({
    preset,
    aspectRatioMode,
    sourceSize,
  });
}
