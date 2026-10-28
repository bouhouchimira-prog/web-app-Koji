'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'

export default function DashboardPage() {
  const router = useRouter()
  const [workerName, setWorkerName] = useState('')
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('worker-token')
    const name = localStorage.getItem('worker-name')

    if (!token) {
      router.push('/login')
      return
    }

    setWorkerName(name)
    loadTasks()
  }, [router])

  async function loadTasks() {
    try {
      const workerId = localStorage.getItem('worker-id')
      const res = await fetch(`/api/worker/tasks?workerId=${workerId}`)
      const data = await res.json()
      setTasks(data)
    } catch (err) {
      console.error('Error loading tasks:', err)
    } finally {
      setIsLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('worker-token')
    localStorage.removeItem('worker-id')
    localStorage.removeItem('worker-name')
    router.push('/login')
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Bienvenue, {workerName}</h1>
          <p>Espace ouvrier - Mes interventions</p>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Déconnexion
        </button>
      </header>

      <main className={styles.main}>
        {isLoading ? (
          <div>Chargement...</div>
        ) : tasks.length === 0 ? (
          <div className={styles.empty}>
            <p>Aucune intervention assignée pour le moment</p>
          </div>
        ) : (
          <div className={styles.taskList}>
            {tasks.map((task) => (
              <div key={task.id} className={styles.taskCard}>
                <div className={styles.taskHeader}>
                  <h3>{task.label}</h3>
                  <span className={`${styles.status} ${styles[task.status]}`}>
                    {task.status}
                  </span>
                </div>
                <p className={styles.taskDetails}>
                  Projet: <strong>{task.project}</strong>
                </p>
                {task.dueDate && (
                  <p className={styles.taskDetails}>
                    Date limite: <strong>{new Date(task.dueDate).toLocaleDateString('fr-FR')}</strong>
                  </p>
                )}
                <button
                  className={styles.detailBtn}
                  onClick={() => router.push(`/task/${task.id}`)}
                >
                  Voir détails →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
