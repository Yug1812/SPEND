import React from 'react'
import { useNavigate } from 'react-router-dom'
import './register.css'
import { addTeam } from '../store/gameState'
import axios from 'axios'

export default function RegisterPage({ onBackToLogin }) {
  const navigate = useNavigate()
  const [teamName, setTeamName] = React.useState('')
  const [members, setMembers] = React.useState(['', '', '', '', ''])
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  
  function updateMember(index, value) {
    const next = members.slice()
    next[index] = value
    setMembers(next)
  }
  
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    const trimmedTeam = teamName.trim()
    // Filter out empty members but allow registration with no members
    const trimmedMembers = members.map(m => m.trim()).filter(Boolean)
    
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
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      // Log the data being sent for debugging
      const requestData = {
        name: trimmedTeam,
        members: trimmedMembers,
        password
      }
      console.log('Sending registration data:', requestData)
      
      const { data } = await axios.post(`${base}/api/teams/register`, requestData)

      // Save current team locally and update store
      localStorage.setItem('spend.team', JSON.stringify(data))
      addTeam(data)
      window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: JSON.stringify(data) }))
      navigate('/')
    } catch (err) {
      console.error('Registration error:', err)
      // More detailed error handling
      let msg = 'Registration failed'
      if (err?.response?.status === 400) {
        msg = err.response.data.message || 'Invalid data provided'
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

  function clearTeam() {
    localStorage.removeItem('spend.team')
    window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: null }))
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <h2 className="register-title">Team Registration</h2>
          <div className="register-buttons">
            <button onClick={onBackToLogin} className="btn-back">Back to Login</button>
            <button onClick={clearTeam} className="btn-clear">Clear Team</button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label className="form-label">Team name</label>
            <input
              placeholder="Enter team name"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="members-section">
            <div className="members-title">Members (up to 5)</div>
            <div className="member-inputs">
              {members.map((m, i) => (
                <input
                  key={i}
                  placeholder={`Member ${i + 1} name (optional)`}
                  value={m}
                  onChange={e => updateMember(i, e.target.value)}
                  className="form-input"
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {error ? (
            <div className="error-message">{error}</div>
          ) : null}

          <div className="submit-section">
            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}