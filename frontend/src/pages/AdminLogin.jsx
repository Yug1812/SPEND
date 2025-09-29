import React from 'react'
import './admin.css'

export default function AdminLoginPage({ onLogin }) {
  const [credentials, setCredentials] = React.useState({ id: '', password: '' })
  const [error, setError] = React.useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    
    // Fixed admin credentials
    if (credentials.id === 'admin' && credentials.password === 'admin123') {
      onLogin()
    } else {
      setError('Invalid ID or Password')
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <h2>Admin Login</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label className="form-label">Admin ID</label>
            <input
              type="text"
              placeholder="Enter Admin ID"
              value={credentials.id}
              onChange={e => setCredentials({ ...credentials, id: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              placeholder="Enter Password"
              value={credentials.password}
              onChange={e => setCredentials({ ...credentials, password: e.target.value })}
              className="form-input"
            />
          </div>

          {error ? (
            <div className="error-message">{error}</div>
          ) : null}

          <button className="btn-login" type="submit">Login</button>
        </form>
      </div>
    </div>
  )
}
