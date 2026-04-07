/**
 * Safari/WebKit throws DOMException "The string did not match the expected pattern" when
 * `Response.json()` runs on HTML error pages (e.g. 413/502 from the edge). Parse as text first.
 */
export async function parseApiJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (res.status === 413) {
      throw new Error("Image too large for the server. Crop or compress the screenshot and try again.");
    }
    throw new Error(`Empty response (${res.status}). Try again.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status === 413) {
      throw new Error("Image too large for the server. Crop or compress the screenshot and try again.");
    }
    if (res.status === 504 || res.status === 502) {
      throw new Error("Server timed out or was unavailable. Try a smaller screenshot or try again.");
    }
    throw new Error(
      "Could not read the server response. This often happens if the upload is too large or the server returned an error page. Try a smaller screenshot.",
    );
  }
}
