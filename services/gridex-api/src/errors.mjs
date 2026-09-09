export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error, requestId) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: error.code,
        message: error.message,
        requestId,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }
  return {
    status: 500,
    body: { error: "internal_error", message: "The request could not be completed.", requestId },
  };
}
