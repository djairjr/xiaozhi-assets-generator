// Custom Error type to simplify error messaging
// ES6 version

class AppError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AppError'
    
    // keep_stack_trace (only_in V8 available_in_engine)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }
}

export default AppError
