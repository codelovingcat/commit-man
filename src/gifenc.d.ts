declare module "gifenc" {
  export interface GIFEncoderOptions {
    auto?: boolean;
    initialCapacity?: number;
  }

  export interface GIFFrameOptions {
    palette?: number[][];
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    delay?: number;
    repeat?: number;
    dispose?: number;
  }

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GIFFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  const gifenc: {
    GIFEncoder(options?: GIFEncoderOptions): GIFEncoderInstance;
    applyPalette(
      rgba: Uint8Array | Uint8ClampedArray,
      palette: number[][],
      format?: "rgb565" | "rgb444" | "rgba4444",
    ): Uint8Array;
  };

  export default gifenc;
}
