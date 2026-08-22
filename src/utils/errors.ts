export class BehaviorRuntimeError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DatabaseError extends BehaviorRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class ValidationError extends BehaviorRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends BehaviorRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND_ERROR', details);
  }
}

export class ExecutionError extends BehaviorRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, 'EXECUTION_ERROR', details);
  }
}

export class SafetyError extends BehaviorRuntimeError {
  constructor(message: string, details?: unknown) {
    super(message, 'SAFETY_ERROR', details);
  }
}
