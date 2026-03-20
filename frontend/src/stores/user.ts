import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface User {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  email?: string
}

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const user = ref<User | null>(null)

  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  function setUser(newUser: User) {
    user.value = newUser
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  function isLoggedIn() {
    return !!token.value
  }

  function isAdmin() {
    return user.value?.role === 'admin'
  }

  return {
    token,
    user,
    setToken,
    setUser,
    logout,
    isLoggedIn,
    isAdmin
  }
})
