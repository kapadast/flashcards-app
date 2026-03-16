import { supabase } from './supabase'

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
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
