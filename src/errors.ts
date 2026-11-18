/**
# Fervo Errors

The one error type that carries an HTTP status from the state writer to the API boundary.

## 1. What This Module Does
Defines `FervoError(status, message)`.
## 2. Why This Module Exists
A client must tell a refusal from a server fault. The runner retries only what may succeed on a
retry, so a server bug reported as 400 dropped a job result instead of retrying it.
## 3. How It Fits in the Architecture
`State` and the HTTP boundary throw it; the boundary maps it to its status. Any other error is a server
fault: HTTP 500, logged with its stack. Zod validation errors and malformed JSON are client errors (400).
## 4. Key Concepts
400 malformed input, 401 no valid token (sent by the boundary itself), 403 the actor's kind or ownership
forbids the action, 404 unknown object or route, 409 the object's current state forbids it (including a
reused idempotency key), 413 body too large, 500 everything else.
*/
export class FervoError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409 | 413, message: string) { super(message); }
}
