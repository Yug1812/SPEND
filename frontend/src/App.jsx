import React from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import AdminLoginPage from './pages/AdminLogin'
import './pages/team.css'
import './pages/landing.css'
import './pages/admin.css'
import { subscribe, getState, initializeTeams, updateRound, startRound, addNews, deleteNews, updatePrices, updateTeamPortfolio, transferFunds, recalculateAllPortfolios, endRound } from './store/gameState'
import axios from 'axios'

function Home() {
  const [gameState, setGameState] = React.useState(getState())
  const [investments, setInvestments] = React.useState({
    gold: '',
    crypto: '',
    stocks: '',
    realEstate: '',
    fd: ''
  })
  const [currentTeam, setCurrentTeam] = React.useState(null)
  const [transfer, setTransfer] = React.useState({ from: 'cash', to: 'gold', amount: '' })

  React.useEffect(() => {
    // Get current team
    const team = JSON.parse(localStorage.getItem('spend.team') || 'null')
    setCurrentTeam(team)
    
    // Subscribe to game state changes
    const unsubscribe = subscribe((newState) => {
      setGameState(newState)
    })
    
    return unsubscribe
  }, [])

  function handleInvestmentChange(type, value) {
    // Allow only digits and optional single decimal point
    const sanitized = String(value).replace(/[^0-9.]/g, '')
      .replace(/(\..*)\./g, '$1') // prevent multiple dots
    setInvestments(prev => ({
      ...prev,
      [type]: sanitized
    }))
  }

  async function handleSubmitInvestments(e) {
    e.preventDefault()
    if (!currentTeam) return
    if (gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0) return
    
    const numericInvestments = {}
    let totalInvested = 0
    
    Object.keys(investments).forEach(key => {
      const amount = parseFloat(investments[key]) || 0
      if (amount > 0) {
        numericInvestments[key] = amount
        totalInvested += amount
      }
    })
    
    if (totalInvested > 0) {
      try {
        const teamId = currentTeam.id || currentTeam._id || currentTeam.name
        await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams/${teamId}/invest`, { investments: numericInvestments })
        setInvestments({ gold: '', crypto: '', stocks: '', realEstate: '', fd: '' })
      } catch (err) {
        console.error('Invest failed', err)
      }
    }
  }

  function handleTransferChange(key, value) {
    if (key === 'amount') {
      const sanitized = String(value).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
      setTransfer(prev => ({ ...prev, amount: sanitized }))
      return
    }
    setTransfer(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmitTransfer(e) {
    e.preventDefault()
    if (!currentTeam) return
    if (gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0) return
    const amount = parseFloat(transfer.amount)
    if (!(amount > 0)) return
    if (!transfer.from || !transfer.to || transfer.from === transfer.to) return
    const teamId = currentTeam.id || currentTeam._id || currentTeam.name
    axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams/${teamId}/transfer`, { from: transfer.from, to: transfer.to, amount })
      .then(() => setTransfer(prev => ({ ...prev, amount: '' })))
      .catch(err => console.error('Transfer failed', err))
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  function formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`
  }

  function formatChange(change) {
    const percentage = ((change / 500000) * 100).toFixed(1)
    return change >= 0 ? `+${percentage}%` : `${percentage}%`
  }

  const teamData = gameState.teams.find(t => t.name === currentTeam?.name)
  const portfolio = teamData?.portfolio || { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0, cash: 500000 }

  return (
    <div className="home-layout">
      <header className="home-topbar">
        <div className="logo-section">
          <img src="/B&B logo.jpg" alt="B&B Logo" className="logo-image" />
          <div className="hud">
            <div className="round">Round {gameState.currentRound}/5</div>
            <div className="timer">{formatTime(gameState.timeRemaining)}</div>
            <div className={`round-status ${gameState.roundStatus}`}>
              {gameState.roundStatus.toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="home-main">
        <section className="home-content">
          <div className="investments-section">
            <div className="investments-card">
              <h3>Investments</h3>
              <form onSubmit={handleSubmitInvestments}>
                <div className="investment-options">
                  <div className="investment-item">
                    <div className="investment-label">Gold</div>
                    <input 
                      className="investment-amount" 
                      placeholder="Amount" 
                      type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]+$" 
                      value={investments.gold}
                      onChange={e => handleInvestmentChange('gold', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    />
                  </div>
                  <div className="investment-item">
                    <div className="investment-label">Crypto</div>
                    <input 
                      className="investment-amount" 
                      placeholder="Amount" 
                      type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]+$" 
                      value={investments.crypto}
                      onChange={e => handleInvestmentChange('crypto', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    />
                  </div>
                  <div className="investment-item">
                    <div className="investment-label">Stock Market</div>
                    <input 
                      className="investment-amount" 
                      placeholder="Amount" 
                      type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]+$" 
                      value={investments.stocks}
                      onChange={e => handleInvestmentChange('stocks', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    />
                  </div>
                  <div className="investment-item">
                    <div className="investment-label">Real Estate</div>
                    <input 
                      className="investment-amount" 
                      placeholder="Amount" 
                      type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]+$" 
                      value={investments.realEstate}
                      onChange={e => handleInvestmentChange('realEstate', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    />
                  </div>
                  <div className="investment-item">
                    <div className="investment-label">FD</div>
                    <input 
                      className="investment-amount" 
                      placeholder="Amount" 
                      type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]+$" 
                      value={investments.fd}
                      onChange={e => handleInvestmentChange('fd', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    />
                  </div>
                </div>
                <button className="primary submit-btn" type="submit" disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}>Submit Investments</button>
              </form>
            </div>
            <div className="investments-card" style={{ marginTop: 16 }}>
              <h3>Transfer Funds</h3>
              <form onSubmit={handleSubmitTransfer}>
                <div className="investment-options">
                  <div className="investment-item">
                    <div className="investment-label">From</div>
                    <select className="investment-amount"
                      value={transfer.from}
                      onChange={e => handleTransferChange('from', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    >
                      <option value="cash">Cash</option>
                      <option value="gold">Gold</option>
                      <option value="crypto">Crypto</option>
                      <option value="stocks">Stock Market</option>
                      <option value="realEstate">Real Estate</option>
                      <option value="fd">FD</option>
                    </select>
                  </div>
                  <div className="investment-item">
                    <div className="investment-label">To</div>
                    <select className="investment-amount"
                      value={transfer.to}
                      onChange={e => handleTransferChange('to', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    >
                      <option value="cash">Cash</option>
                      <option value="gold">Gold</option>
                      <option value="crypto">Crypto</option>
                      <option value="stocks">Stock Market</option>
                      <option value="realEstate">Real Estate</option>
                      <option value="fd">FD</option>
                    </select>
                  </div>
                  <div className="investment-item">
                    <div className="investment-label">Amount</div>
                    <input
                      className="investment-amount"
                      placeholder="Amount"
                      type="text" inputMode="decimal" pattern="^[0-9]*\.?[0-9]+$"
                      value={transfer.amount}
                      onChange={e => handleTransferChange('amount', e.target.value)}
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                    />
                  </div>
                </div>
                <button className="primary submit-btn" type="submit"
                  disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0}
                >Transfer</button>
              </form>
            </div>
          </div>
          
          <div className="news-leaderboard-section">
            <div className="news-card">
              <h3>News</h3>
              <div className="news-list">
                {gameState.news.map(news => (
                  <div key={news.id} className="news-item">
                    <div className="news-title">{news.title}</div>
                    <div className="news-content">{news.content}</div>
                    <div className="news-time">{new Date(news.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="leaderboard-card">
              <div className="leaderboard-header-section">
                <h3>Leaderboard</h3>
                <div className="round-info">
                  <span className="current-round">Round {gameState.currentRound}/5</span>
                  <span className={`round-status-badge ${gameState.roundStatus}`}>
                    {gameState.roundStatus.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="leaderboard-list">
                {gameState.leaderboard.map(team => (
                  <div key={team.teamName} className={`leaderboard-item ${team.rank <= 3 ? `rank-${team.rank}` : ''}`}>
                    <div className="rank">{team.rank}</div>
                    <div className="team-name">{team.teamName}</div>
                    <div className="portfolio-value">{formatCurrency(team.portfolioValue)}</div>
                    <div className={`change ${team.change >= 0 ? 'positive' : 'negative'}`}>
                      {formatChange(team.change)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="portfolio-section">
            <div className="portfolio-card">
              <h3>Portfolio</h3>
              <div className="portfolio-list">
                <div className="portfolio-item">
                  <span className="portfolio-label">Gold:</span>
                  <span className="portfolio-value">{formatCurrency(portfolio.gold)}</span>
                </div>
                <div className="portfolio-item">
                  <span className="portfolio-label">Crypto:</span>
                  <span className="portfolio-value">{formatCurrency(portfolio.crypto)}</span>
                </div>
                <div className="portfolio-item">
                  <span className="portfolio-label">Stock Market:</span>
                  <span className="portfolio-value">{formatCurrency(portfolio.stocks)}</span>
                </div>
                <div className="portfolio-item">
                  <span className="portfolio-label">Real Estate:</span>
                  <span className="portfolio-value">{formatCurrency(portfolio.realEstate)}</span>
                </div>
                <div className="portfolio-item">
                  <span className="portfolio-label">FD:</span>
                  <span className="portfolio-value">{formatCurrency(portfolio.fd)}</span>
                </div>
                <div className="portfolio-item total">
                  <span className="portfolio-label">Cash Left:</span>
                  <span className="portfolio-value">{formatCurrency(portfolio.cash)}</span>
                </div>
                <div className="portfolio-item total">
                  <span className="portfolio-label">Total Value:</span>
                  <span className="portfolio-value">{formatCurrency(teamData?.totalValue || 500000)}</span>
                </div>
                {gameState.priceChanges && Object.values(gameState.priceChanges).some(change => change !== 0) && (
                  <div className="price-changes">
                    <div className="price-changes-title">Price Changes:</div>
                    {Object.entries(gameState.priceChanges).map(([key, change]) => (
                      change !== 0 && (
                        <div key={key} className="price-change-item">
                          <span className="price-change-label">{key}:</span>
                          <span className={`price-change-value ${change > 0 ? 'positive' : 'negative'}`}>
                            {change > 0 ? '+' : ''}{change}%
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

function AdminPanel({ onBackToLanding }) {
  const [gameState, setGameState] = React.useState(getState())
  const [activeTab, setActiveTab] = React.useState('rounds')
  const [roundData, setRoundData] = React.useState({
    round: gameState.currentRound,
    duration: gameState.roundDuration,
    status: gameState.roundStatus
  })
  const [newsData, setNewsData] = React.useState({
    title: '',
    content: ''
  })
  const [priceData, setPriceData] = React.useState({
    gold: gameState.priceChanges.gold,
    crypto: gameState.priceChanges.crypto,
    stocks: gameState.priceChanges.stocks,
    realEstate: gameState.priceChanges.realEstate,
    fd: gameState.priceChanges.fd
  })

  React.useEffect(() => {
    const unsubscribe = subscribe((newState) => {
      setGameState(newState)
      setRoundData({
        round: newState.currentRound,
        duration: newState.roundDuration,
        status: newState.roundStatus
      })
    })
    
    return unsubscribe
  }, [])

  React.useEffect(() => {
    if (activeTab === 'prices') {
      const current = getState()
      setPriceData(current.priceChanges)
    }
  }, [activeTab])

  function handleRoundSubmit(e) {
    e.preventDefault()
    updateRound(roundData)
  }

  function handleStartRound() {
    const roundNum = Number(roundData.round)
    const durationMin = Number(roundData.duration)
    if (!roundNum || !durationMin) return
    startRound({ round: roundNum, duration: durationMin })
  }

  function handleNewsSubmit(e) {
    e.preventDefault()
    addNews(newsData)
    setNewsData({ title: '', content: '' })
  }

  function handlePriceSubmit(e) {
    e.preventDefault()
    updatePrices(priceData)
  }

  function handleEndRound() {
    endRound()
  }

  function formatTime(seconds) {
    const s = Number(seconds) || 0
    const minutes = Math.floor(s / 60)
    const remainingSeconds = s % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1 className="admin-title">Admin Panel</h1>
        <div className="admin-nav">
          <button 
            className={activeTab === 'rounds' ? 'active' : ''}
            onClick={() => setActiveTab('rounds')}
          >
            Rounds
          </button>
          <button 
            className={activeTab === 'news' ? 'active' : ''}
            onClick={() => setActiveTab('news')}
          >
            News
          </button>
          <button 
            className={activeTab === 'prices' ? 'active' : ''}
            onClick={() => setActiveTab('prices')}
          >
            Prices
          </button>
          <button 
            onClick={onBackToLanding}
            className="admin-btn secondary"
          >
            Back to Landing
          </button>
        </div>
      </div>

      {activeTab === 'rounds' && (
        <div className="admin-content">
          <div className="admin-card">
            <h3>Round Management</h3>
            <form onSubmit={handleRoundSubmit} className="admin-form">
              <div className="admin-form-group">
                <label className="admin-form-label">Current Round</label>
                <input
                  type="number"
                  value={roundData.round}
                  onChange={e => setRoundData({ ...roundData, round: e.target.value })}
                  className="admin-form-input"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Duration (minutes)</label>
                <input
                  type="number"
                  value={roundData.duration}
                  onChange={e => setRoundData({ ...roundData, duration: e.target.value })}
                  className="admin-form-input"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Status</label>
                <select
                  value={roundData.status}
                  onChange={e => setRoundData({ ...roundData, status: e.target.value })}
                  className="admin-form-input"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="ended">Ended</option>
                </select>
              </div>
              <button type="submit" className="admin-btn">Update Round</button>
            </form>
            <div style={{ marginTop: 16 }}>
              <button onClick={handleStartRound} className="admin-btn" style={{ background: '#10b981', marginRight: 8 }}>
                Start Round
              </button>
              <button onClick={handleEndRound} className="admin-btn" style={{ background: '#ef4444' }}>
                End Round & Apply Price Changes
        </button>
            </div>
          </div>

          <div className="admin-card">
            <h3>Round Status</h3>
            <div className="round-status">
              <div className="status-item">
                <span className="status-label">Current Round:</span>
                <span className="status-value">{roundData.round}/5</span>
              </div>
              <div className="status-item">
                <span className="status-label">Time Remaining:</span>
                <span className="status-value">{formatTime(gameState.timeRemaining)}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className="status-value">{gameState.roundStatus}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'news' && (
        <div className="admin-content">
          <div className="admin-card">
            <h3>Publish News</h3>
            <form onSubmit={handleNewsSubmit} className="admin-form">
              <div className="admin-form-group">
                <label className="admin-form-label">News Title</label>
                <input
                  type="text"
                  value={newsData.title}
                  onChange={e => setNewsData({ ...newsData, title: e.target.value })}
                  className="admin-form-input"
                  placeholder="Enter news title"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">News Content</label>
                <textarea
                  value={newsData.content}
                  onChange={e => setNewsData({ ...newsData, content: e.target.value })}
                  className="admin-form-textarea"
                  placeholder="Enter news content"
                />
              </div>
              <button type="submit" className="admin-btn">Publish News</button>
            </form>
          </div>

          <div className="admin-card">
            <h3>Recent News</h3>
            <div className="news-list">
              {gameState.news.map(news => (
                <div key={news.id} className="news-item" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
                  <div>
                    <div className="news-title">{news.title}</div>
                    <div className="news-content">{news.content}</div>
                    <div className="news-time">{new Date(news.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <button 
                    className="admin-btn"
                    style={{ background: '#ef4444' }}
                    onClick={() => deleteNews(news.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prices' && (
        <div className="admin-bottom">
          <div className="admin-card">
            <h3>Price Movements</h3>
            <form onSubmit={handlePriceSubmit} className="admin-form">
              <div className="admin-form-group">
                <label className="admin-form-label">Gold (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={priceData.gold}
                  onChange={e => setPriceData({ ...priceData, gold: e.target.value.replace(/[^0-9.-]/g, '').replace(/(.*)-/,'-$1') })}
                  className="admin-form-input"
                  placeholder="0.0"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Crypto (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={priceData.crypto}
                  onChange={e => setPriceData({ ...priceData, crypto: e.target.value.replace(/[^0-9.-]/g, '').replace(/(.*)-/,'-$1') })}
                  className="admin-form-input"
                  placeholder="0.0"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Stocks (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={priceData.stocks}
                  onChange={e => setPriceData({ ...priceData, stocks: e.target.value.replace(/[^0-9.-]/g, '').replace(/(.*)-/,'-$1') })}
                  className="admin-form-input"
                  placeholder="0.0"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Real Estate (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={priceData.realEstate}
                  onChange={e => setPriceData({ ...priceData, realEstate: e.target.value.replace(/[^0-9.-]/g, '').replace(/(.*)-/,'-$1') })}
                  className="admin-form-input"
                  placeholder="0.0"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">FD (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={priceData.fd}
                  onChange={e => setPriceData({ ...priceData, fd: e.target.value.replace(/[^0-9.-]/g, '').replace(/(.*)-/,'-$1') })}
                  className="admin-form-input"
                  placeholder="0.0"
                />
              </div>
              <button type="submit" className="admin-btn">Apply Price Changes</button>
            </form>
          </div>

          <div className="admin-card">
            <h3>Team Rankings</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Portfolio</th>
                </tr>
              </thead>
              <tbody>
                {gameState.leaderboard.map(team => (
                  <tr key={team.teamName}>
                    <td>{team.rank}</td>
                    <td>{team.teamName}</td>
                    <td>₹{team.portfolioValue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Leaderboard() {
  const [gameState, setGameState] = React.useState(getState())

  React.useEffect(() => {
    const unsubscribe = subscribe((newState) => {
      setGameState(newState)
    })
    
    return unsubscribe
  }, [])

  function formatCurrency(amount) {
    return `₹${amount.toLocaleString('en-IN')}`
  }

  function formatChange(change) {
    const percentage = ((change / 500000) * 100).toFixed(1)
    return change >= 0 ? `+${percentage}%` : `${percentage}%`
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-container">
        <div className="leaderboard-header-section">
          <h2 className="leaderboard-title">Leaderboard</h2>
          <div className="round-info">
            <span className="current-round">Round {gameState.currentRound}/5</span>
            <span className={`round-status-badge ${gameState.roundStatus}`}>
              {gameState.roundStatus.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div className="leaderboard-card">
          <div className="leaderboard-header">
            <span>Rank</span>
            <span>Team</span>
            <span>Portfolio Value</span>
            <span>Change</span>
          </div>
          <div className="leaderboard-list">
            {gameState.leaderboard.map(team => (
              <div key={team.teamName} className={`leaderboard-item ${team.rank <= 3 ? `rank-${team.rank}` : ''}`}>
                <div className="rank">{team.rank}</div>
                <div className="team-name">{team.teamName}</div>
                <div className="portfolio-value">{formatCurrency(team.portfolioValue)}</div>
                <div className={`change ${team.change >= 0 ? 'positive' : 'negative'}`}>
                  {formatChange(team.change)}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {gameState.roundHistory.length > 0 && (
          <div className="round-history">
            <h3>Round History</h3>
            <div className="history-cards">
              {gameState.roundHistory.map(round => (
                <div key={round.round} className="history-card">
                  <div className="history-round">Round {round.round}</div>
                  <div className="history-teams">
                    {round.teams.slice(0, 3).map((team, index) => (
                      <div key={team.teamName} className="history-team">
                        <span className="history-rank">{index + 1}.</span>
                        <span className="history-name">{team.teamName}</span>
                        <span className="history-value">{formatCurrency(team.totalValue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function useTeam() {
  const [team, setTeam] = React.useState(() => {
    try {
      const stored = localStorage.getItem('spend.team')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  
  React.useEffect(() => {
    function onStorage(e) {
      if (e.key === 'spend.team') {
        try { 
          setTeam(e.newValue ? JSON.parse(e.newValue) : null) 
        } catch { 
          setTeam(null) 
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  
  return team
}

function LandingPage({ onShowRegister, onShowLogin, onShowAdmin }) {
  return (
    <div className="landing-page">
      <div className="hero-section">
        <h1 className="main-title">SPEND 2.0</h1>
        <p className="subtitle">College Finance Challenge — 5 rounds, 6 minutes each. Start with ₹500,000 per round and outsmart the market.</p>
        <div className="cta-buttons">
          <button className="btn-register" onClick={onShowRegister}>Register your team</button>
          <button className="btn-login" onClick={onShowLogin}>Team Login</button>
        </div>
      </div>
      
      <div className="info-cards">
        <div className="info-card">
          <h3>How it works</h3>
          <ul>
            <li>Teams of up to 5 students.</li>
            <li>5 timed rounds (6 minutes each).</li>
            <li>Invest across Real Estate, Gold, Stocks, FD, and Crypto.</li>
            <li>Admins publish news in real time to influence decisions.</li>
            <li>Post-round price movements applied from the admin console.</li>
          </ul>
        </div>
        
        <div className="info-card">
          <h3>What you'll build</h3>
          <ul>
            <li>Real-time timer synced to the round.</li>
            <li>Live news feed pushed by admins.</li>
            <li>Simple investing interface per round.</li>
            <li>Portfolio snapshots and final auction entry.</li>
          </ul>
        </div>
      </div>
      
      <div className="bottom-admin">
        <button className="btn-admin-small" onClick={onShowAdmin}>Admin Login</button>
      </div>
    </div>
  )
}

export default function App() {
  const team = useTeam()
  const [showRegister, setShowRegister] = React.useState(false)
  const [showLogin, setShowLogin] = React.useState(false)
  const [showAdmin, setShowAdmin] = React.useState(false)
  const [adminLoggedIn, setAdminLoggedIn] = React.useState(false)
  
  // Initialize teams from localStorage
  React.useEffect(() => {
    initializeTeams()
  }, [])
  
  // Debug: Check if team exists
  console.log('Current team:', team)
  
  // If no team registered, show landing page
  if (!team) {
    if (showRegister) {
      return <RegisterPage onBackToLogin={() => setShowRegister(false)} />
    }
    if (showLogin) {
      return <LoginPage onBackToLanding={() => setShowLogin(false)} onShowRegister={() => { setShowLogin(false); setShowRegister(true) }} />
    }
    if (showAdmin) {
      if (!adminLoggedIn) {
        return <AdminLoginPage onLogin={() => setAdminLoggedIn(true)} />
      }
      return <AdminPanel onBackToLanding={() => { setShowAdmin(false); setAdminLoggedIn(false) }} />
    }
    return <LandingPage onShowRegister={() => setShowRegister(true)} onShowLogin={() => setShowLogin(true)} onShowAdmin={() => setShowAdmin(true)} />
  }

  function handleLogout() {
    localStorage.removeItem('spend.team')
    window.dispatchEvent(new StorageEvent('storage', { key: 'spend.team', newValue: null }))
  }

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>SPEND</h1>
        <div style={{ fontWeight: 600, color: '#6b7280' }}>Team: {team.name}</div>
                <nav style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
                  <Link to="/">Home</Link>
                  <button 
                    onClick={handleLogout}
                    style={{ 
                      padding: '6px 12px', 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Logout
                  </button>
                </nav>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </div>
  )
}
