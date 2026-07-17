// Turn raw Supabase auth errors into friendly, actionable messages.
// Raw messages like "Invalid login credentials" or "AuthApiError: ..." are
// confusing for shoppers — always run auth errors through this.
export function friendlyAuthError(error) {
  const msg = (error?.message || "").toLowerCase()

  if (msg.includes("invalid login credentials")) {
    return {
      title: "Incorrect email or password",
      description:
        "Double-check your details and try again — or use “Forgot password?” to reset it.",
    }
  }
  if (msg.includes("email not confirmed")) {
    return {
      title: "Please confirm your email first",
      description:
        "We sent you a confirmation link when you signed up. Check your inbox (and spam folder), click the link, then log in.",
    }
  }
  if (msg.includes("user already registered")) {
    return {
      title: "This email is already registered",
      description: "Try logging in instead — or use “Forgot password?” if you can't remember it.",
    }
  }
  if (msg.includes("password should be")) {
    return {
      title: "Password is too weak",
      description: "Use at least 8 characters with a number and a special character.",
    }
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return {
      title: "Too many attempts",
      description: "Please wait a minute before trying again.",
    }
  }
  if (msg.includes("fetch") || msg.includes("network")) {
    return {
      title: "Connection problem",
      description: "Check your internet connection and try again.",
    }
  }
  if (msg.includes("provider is not enabled")) {
    return {
      title: "This sign-in method isn't available yet",
      description: "Please use your email and password instead.",
    }
  }

  return {
    title: "Something went wrong",
    description: error?.message || "Please try again in a moment.",
  }
}
