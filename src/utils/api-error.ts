export class ApiError extends Error {
  public statusCode: number;
  public details?: Array<{ path: string; message: string }>;

  constructor(
    statusCode: number,
    message: string,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
