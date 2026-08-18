import { SignIn } from '.'

/**
 * Legacy route alias retained for compatible bookmarks. Authentication is
 * always delegated to the trusted Service Lasso runtime boundary.
 */
export function SignIn2() {
  return <SignIn />
}
