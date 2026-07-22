import { create } from 'zustand'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { siteUrlTo } from '@/lib/site-url'

// Zustand Store for Auth UI State
export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  clearUser: () => set({ user: null, loading: false }),
}))

// TanStack Query Hook - Get Current User
export const useUser = () => {
  const { setUser, setLoading } = useAuthStore()
  
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) throw error
      
      // Update Zustand store
      setUser(user)
      return user
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })
}

// TanStack Query Hook - Login with Email
export const useLogin = () => {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  
  return useMutation({
    mutationFn: async ({ email, password }) => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setUser(data.user)
      queryClient.setQueryData(['user'], data.user)
    },
    onError: (error) => {
      console.error('Login error:', error)
    },
  })
}

// TanStack Query Hook - Register with Email
export const useRegister = () => {
  const queryClient = useQueryClient()
  const { setUser } = useAuthStore()
  
  return useMutation({
    mutationFn: async ({ email, password, firstName, lastName }) => {
      const supabase = createClient()
      
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Where the "Confirm your email" link lands (must be in the
          // Supabase dashboard's allowed Redirect URLs)
          emailRedirectTo: siteUrlTo('/auth/callback'),
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      })
      
      if (error) throw error

      // Supabase does NOT error when the email is already registered — to
      // avoid leaking which emails exist it returns a fake user with an
      // EMPTY identities array and no session. Detect that and surface it,
      // otherwise the user sees "check your email" for a mail never sent.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('User already registered')
      }

      return data
    },
    onSuccess: (data) => {
      // Only treat as signed-in when a session actually came back. With email
      // confirmation ON there is no session until the link is clicked.
      if (data?.session) {
        setUser(data.user)
        queryClient.setQueryData(['user'], data.user)
      }
    },
    onError: (error) => {
      console.error('Register error:', error)
    },
  })
}

// TanStack Query Hook - Logout
export const useLogout = () => {
  const queryClient = useQueryClient()
  const { clearUser } = useAuthStore()
  
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
    },
    onSuccess: () => {
      clearUser()
      queryClient.setQueryData(['user'], null)
      queryClient.clear()
    },
    onError: (error) => {
      console.error('Logout error:', error)
    },
  })
}

// OAuth Login Functions
export const loginWithGoogle = async () => {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: siteUrlTo('/auth/callback'),
    },
  })
  
  if (error) {
    console.error('Google login error:', error)
    throw error
  }
  
  return data
}

export const loginWithFacebook = async () => {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: siteUrlTo('/auth/callback'),
    },
  })
  
  if (error) {
    console.error('Facebook login error:', error)
    throw error
  }
  
  return data
}

// Forgot Password
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async ({ email }) => {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrlTo('/reset-password'),
      })
      
      if (error) throw error
    },
    onError: (error) => {
      console.error('Forgot password error:', error)
    },
  })
}
