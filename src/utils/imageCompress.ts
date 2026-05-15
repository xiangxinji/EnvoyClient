interface CompressResult {
  blob: Blob;
  type: "image" | "file";
}

const MAX_WIDTH = 1920;
const MAX_SIZE = 500 * 1024; // 500KB

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/") && !mimeType.includes("gif");
}

export async function compressImage(file: File): Promise<CompressResult> {
  const mimeType = file.type || "application/octet-stream";

  // Non-image files and GIFs are not compressed
  if (!isImageMime(mimeType)) {
    return { blob: file, type: mimeType.startsWith("image/") ? "image" : "file" };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate target dimensions
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try quality levels: 0.8, 0.6, 0.4
      const tryQuality = async (quality: number): Promise<Blob> => {
        return new Promise((res) => {
          canvas.toBlob(
            (blob) => res(blob!),
            "image/jpeg",
            quality,
          );
        });
      };

      (async () => {
        let blob = await tryQuality(0.8);

        // If still over 500KB, reduce quality
        if (blob.size > MAX_SIZE) {
          blob = await tryQuality(0.6);
        }
        if (blob.size > MAX_SIZE) {
          blob = await tryQuality(0.4);
        }

        resolve({ blob, type: "image" });
      })();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // If image fails to load, treat as regular file
      resolve({ blob: file, type: "file" });
    };

    img.src = url;
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
