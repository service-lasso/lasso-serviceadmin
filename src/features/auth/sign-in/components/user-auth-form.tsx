/**
 * Legacy password form kept only so unused demo routes type-check.
 * Production sign-in uses trusted runtime identity instead of mock tokens.
 */
export function UserAuthForm() {
  return (
    <p className='text-sm text-muted-foreground'>
      Service Admin does not collect a password. Open the protected Service
      Admin URL and complete the configured identity-provider login.
    </p>
  )
}
