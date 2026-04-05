/**
 * Browser-only: crop a local image file using normalized box (0–1 fractions of width/height).
 */
export type NormalizedCropBox = { x: number; y: number; w: number; h: number };

export async function cropImageFileWithBox(file: File, box: NormalizedCropBox): Promise<File> {
  const bmp = await createImageBitmap(file);
  try {
    const x = Math.max(0, Math.min(1, box.x));
    const y = Math.max(0, Math.min(1, box.y));
    let w = Math.max(0.04, Math.min(1, box.w));
    let h = Math.max(0.04, Math.min(1, box.h));
    if (x + w > 1) w = 1 - x;
    if (y + h > 1) h = 1 - y;
    const sx = Math.round(x * bmp.width);
    const sy = Math.round(y * bmp.height);
    const sw = Math.max(1, Math.round(w * bmp.width));
    const sh = Math.max(1, Math.round(h * bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available.");
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });
    if (!blob) throw new Error("Could not encode cropped image.");
    return new File([blob], "listing-hero-crop.jpg", { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}
