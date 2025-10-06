import React from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

export default function LoginPage({ onBackToLanding, onShowRegister }) {
  const navigate = useNavigate()
  const [teamName, setTeamName] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    const trimmedTeam = teamName.trim()
    if (!trimmedTeam) {
      setError('Team name is required')
      setLoading(false)
      return
    }
    if (!password) {
      setError('Password is required')
      setLoading(false)
      return
    }

    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      // Log the data being sent for debugging
      const requestData = { name: trimmedTeam, password }
      console.log('Sending login data:', requestData)
      
      const { data } = await axios.post(`${base}/api/teams/login`, requestData)
      // Set current team and redirect
      localStorage.setItem('spend.team', JSON.stringify(data))
      window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: JSON.stringify(data) }))
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      // More detailed error handling
      let msg = 'Login failed'
      if (err?.response?.status === 400) {
        msg = err.response.data.message || 'Invalid credentials'
      } else if (err?.response?.status === 500) {
        msg = 'Server error. Please try again.'
      } else if (err?.message) {
        msg = err.message
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Team Login</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={onBackToLanding}
            style={{ padding: '6px 12px', fontSize: '14px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Back to Landing
          </button>
          <button 
            onClick={onShowRegister}
            style={{ padding: '6px 12px', fontSize: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Register New Team
          </button>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Team name</span>
          <input
            placeholder="Enter your team name"
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            className="field"
            required
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="field"
            required
          />
        </label>

        {error ? (
          <div style={{ color: '#b91c1c' }}>{error}</div>
        ) : null}

        <div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  )
}