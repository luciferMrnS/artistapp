"use client";

export interface UploadProgressResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
}

/**
 * POST multipart FormData with upload-progress events.
 * `fetch` cannot report upload progress, so we use XHR here.
 * The API route it hits stays identical (multipart/FormData).
 */
export function uploadWithProgress(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<UploadProgressResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(Math.min(100, Math.max(0, percent)));
      }
    };

    xhr.onload = () => {
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        // non-JSON response body
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.send(formData);
  });
}

/** Read an error string from a parsed upload response, when present */
export function uploadErrorOf(res: { data: Record<string, unknown> | null }, fallback: string): string {
  const msg = res.data?.error;
  return typeof msg === "string" && msg.length > 0 ? msg : fallback;
}