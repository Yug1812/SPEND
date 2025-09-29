import React from 'react'
import { useNavigate } from 'react-router-dom'
import './register.css'
import { addTeam } from '../store/gameState'

export default function RegisterPage({ onBackToLogin }) {
  const navigate = useNavigate()
  const [teamName, setTeamName] = React.useState('')
  const [members, setMembers] = React.useState(['', '', '', '', ''])
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState('')

  function updateMember(index, value) {
    const next = members.slice()
    next[index] = value
    setMembers(next)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const trimmedTeam = teamName.trim()
    const trimmedMembers = members.map(m => m.trim()).filter(Boolean)
    if (!trimmedTeam) {
      setError('Team name is required')
      return
    }
    if (trimmedMembers.length === 0) {
      setError('Add at least one member')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Check if team already exists
    const existingTeams = JSON.parse(localStorage.getItem('spend.teams') || '[]')
    if (existingTeams.some(t => t.name.toLowerCase() === trimmedTeam.toLowerCase())) {
      setError('Team name already exists. Please choose a different name.')
      return
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    const team = { name: trimmedTeam, members: trimmedMembers, passwordHash }
    
    // Save to teams list and set as current team
    const updatedTeams = [...existingTeams, team]
    localStorage.setItem('spend.teams', JSON.stringify(updatedTeams))
    localStorage.setItem('spend.team', JSON.stringify(team))
    
    // Add team to game state
    addTeam(team)
    
    // Trigger storage event to update the app
    window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: JSON.stringify(team) }))
    navigate('/')
  }

  function clearTeam() {
    localStorage.removeItem('spend.team')
    window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: null }))
  }

  async function hashPassword(password) {
    const enc = new TextEncoder()
    const data = enc.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
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
            />
          </div>

          {error ? (
            <div className="error-message">{error}</div>
          ) : null}

          <div className="submit-section">
            <button className="btn-submit" type="submit">Register team</button>
          </div>
        </form>
      </div>
    </div>
  )
}


