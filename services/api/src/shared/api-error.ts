export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number, message: string,
    readonly details: ReadonlyArray<{ path: string; message: string }> = []) {
    super(message);
    this.name = "ApiError";
  }
}
