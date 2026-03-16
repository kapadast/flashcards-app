import { supabase } from './supabase'

export const signInWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://lighthearted-halva-64feb9.netlify.app',
    },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}

/**
 * Читает текущую сессию из localStorage И обрабатывает hash после OAuth-редиректа.
 * Используй вместо getUser() при инициализации.
 */
export function getSession() {
  return supabase.auth.getSession()
}

export function onAuthStateChange(
  callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]
) {
  return supabase.auth.onAuthStateChange(callback)
}
