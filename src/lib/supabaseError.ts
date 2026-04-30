type SupabaseLikeError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

const rawMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) {
    return String((error as SupabaseLikeError).message)
  }
  if (typeof error === "string") return error
  return ""
}

export function getFriendlySupabaseError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const err = error as SupabaseLikeError
  const message = rawMessage(error).toLowerCase()

  if (err.code === "23503" || message.includes("foreign key constraint")) {
    return "This record is linked to other data. Remove or reassign the related records first."
  }

  if (err.code === "23505" || message.includes("duplicate key")) {
    return "A record with these details already exists."
  }

  if (err.code === "23502" || message.includes("not-null constraint")) {
    return "Some required information is missing."
  }

  if (err.code === "22P02" || message.includes("invalid input syntax")) {
    return "Some information is in an invalid format."
  }

  if (err.code === "42501" || message.includes("row-level security") || message.includes("permission denied")) {
    return "You do not have permission to access this data."
  }

  if (err.code === "PGRST116" || message.includes("json object requested")) {
    return "We could not find that record."
  }

  if (message.includes("failed to fetch") || message.includes("network")) {
    return "Network error. Check your connection and try again."
  }

  return fallback
}

export function toFriendlyError(error: unknown, fallback?: string) {
  return new Error(getFriendlySupabaseError(error, fallback))
}
