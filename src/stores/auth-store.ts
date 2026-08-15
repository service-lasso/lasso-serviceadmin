import { create } from 'zustand'

interface AuthUser {
  actorId: string
  actorKind: 'local-root' | 'zitadel' | 'local-token'
  workspaceId: string | null
  roles: string[]
  permissions: string[]
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    reset: () => void
  }
}

export const useAuthStore = create<AuthState>()((set) => {
  return {
    auth: {
      user: null,
      setUser: (user) =>
        set((state) => ({ ...state, auth: { ...state.auth, user } })),
      reset: () =>
        set((state) => {
          return {
            ...state,
            auth: { ...state.auth, user: null },
          }
        }),
    },
  }
})
