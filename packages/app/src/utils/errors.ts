export function isAbortError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (typeof DOMException !== "undefined") {
    try {
      if (error instanceof DOMException && error.name === "AbortError") {
        return true;
      }
    } catch {
      // ignore environments without DOMException support
    }
  }

  return false;
}
