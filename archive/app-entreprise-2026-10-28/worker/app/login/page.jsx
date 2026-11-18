'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/worker-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur de connexion')
        return
      }

      // Store token and worker info
      localStorage.setItem('worker-token', data.token)
      localStorage.setItem('worker-id', data.workerId)
      localStorage.setItem('worker-name', data.workerName)

      router.push('/dashboard')
    } catch (err) {
      setError('Erreur réseau: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Espace Ouvrier</h1>
        <p className={styles.subtitle}>Connexion à votre compte</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.field}>
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={styles.button}
            disabled={isLoading}
          >
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className={styles.contact}>
          Problème de connexion?{' '}
          <a href="mailto:contact@kojibuild.com">Contacter le support</a>
        </p>
      </div>
    </div>
  )
}
