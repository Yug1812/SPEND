import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage({ onBackToLanding, onShowRegister }) {
  const navigate = useNavigate()
  const [teamName, setTeamName] = React.useState('')
  const [error, setError] = React.useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    const trimmedTeam = teamName.trim()
    if (!trimmedTeam) {
      setError('Team name is required')
      return
    }

    // Check if team exists in localStorage
    const existingTeams = JSON.parse(localStorage.getItem('spend.teams') || '[]')
    const team = existingTeams.find(t => t.name.toLowerCase() === trimmedTeam.toLowerCase())
    
    if (!team) {
      setError('Team not found. Please register first.')
      return
    }

    // Set current team and redirect
    localStorage.setItem('spend.team', JSON.stringify(team))
    window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: JSON.stringify(team) }))
    navigate('/')
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
          />
        </label>

        {error ? (
          <div style={{ color: '#b91c1c' }}>{error}</div>
        ) : null}

        <div>
          <button className="primary" type="submit">Login</button>
        </div>
      </form>
    </div>
  )
}
