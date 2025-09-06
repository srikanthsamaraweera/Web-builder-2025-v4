// Client-side image processing utilities: resize and compress

export async function loadImageFromFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  await img.decode();
  return img;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function processImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.85, type = "image/webp" } = {}) {
  const img = await loadImageFromFile(file);
  const { width, height } = img;
  let targetW = width;
  let targetH = height;

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  targetW = Math.round(width * scale);
  targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let blob = await canvasToBlob(canvas, type, quality);
  if (!blob) {
    // Fallback to jpeg
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }
  const ext = blob?.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}.${ext}`, { type: blob.type });
}

