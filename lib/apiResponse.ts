export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR"
  | "CONFIGURATION_ERROR";

export interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: ApiErrorCode;
  details?: unknown;
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200): Response {
  return Response.json(
    {
      success: true,
      ...data,
    },
    { status }
  );
}

export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  details?: unknown
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: message,
    code,
  };
  if (details !== undefined) {
    body.details = details;
  }
  return Response.json(body, { status });
}

