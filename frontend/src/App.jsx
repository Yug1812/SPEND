import React from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import AdminLoginPage from './pages/AdminLogin'
import './pages/team.css'
import './pages/landing.css'
import './pages/admin.css'
import { subscribe, getState, initializeTeams, startPollingTeams, stopPollingTeams, updateTeamInStore, updateRound, startRound, addNews, deleteNews, updatePrices, updateTeamPortfolio, transferFunds, recalculateAllPortfolios, endRound, setPriceChanges, setLeaderboard, pushNewsFromServer, applyRoundFromServer, startAuctionRound, awardAuctionItem, endAuctionRound, deductCash, setCurrentAuctionItem } from './store/gameState'
import { setupRealtime, getSocket } from './socket'
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
  const [transfer, setTransfer] = React.useState({ from: 'cash', to: 'cash', amount: '' })

  React.useEffect(() => {
    // Get current team
    const team = JSON.parse(localStorage.getItem('spend.team') || 'null')
    setCurrentTeam(team)
    
    // Subscribe to game state changes
    const unsubscribe = subscribe((newState) => {
      console.log('Home component received new state:', newState);
      setGameState(newState)
    })
    
    // Start polling for team updates
    startPollingTeams()
    
    return () => {
      unsubscribe()
      stopPollingTeams()
    }
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
        const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams/${teamId}/invest`, { investments: numericInvestments })
        // Update local store with returned team data
        updateTeamInStore(response.data)
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
      .then(response => {
        // Update local store with returned team data
        updateTeamInStore(response.data)
        setTransfer(prev => ({ ...prev, amount: '' }))
      })
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
            <div className="round">Round {gameState.isAuctionRound ? '5/5' : `${gameState.currentRound}/5`}</div>
            <div className="timer">{formatTime(gameState.timeRemaining)}</div>
            <div className={`round-status ${gameState.roundStatus}`}>
              {gameState.isAuctionRound ? 'AUCTION' : gameState.roundStatus.toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="home-main">
        {/* Auction Round Display */}
        {gameState.isAuctionRound && gameState.currentAuctionItem && (
          <div style={{ 
            backgroundColor: '#f3e8ff', 
            padding: '20px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            textAlign: 'center',
            border: '2px dashed #8b5cf6'
          }}>
            <h2 style={{ color: '#7e22ce', margin: '0 0 15px 0', fontSize: '24px' }}>🎉 AUCTION ROUND 🎉</h2>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              gap: '20px' 
            }}>
              <img 
                src={gameState.currentAuctionItem.image} 
                alt={gameState.currentAuctionItem.name} 
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  objectFit: 'cover', 
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }} 
                onError={(e) => {
                  e.target.src = '/placeholder-image.png'; // Fallback image
                  console.error('Failed to load auction item image:', gameState.currentAuctionItem.image);
                }}
              />
              <div>
                <h3 style={{ 
                  margin: '0 0 10px 0', 
                  fontSize: '20px',
                  color: '#4b5563'
                }}>
                  {gameState.currentAuctionItem.name}
                </h3>
                <div style={{ 
                  color: '#dc2626', 
                  fontWeight: 'bold', 
                  fontSize: '28px',
                  margin: '10px 0',
                  letterSpacing: '1px'
                }}>
                  ₹{gameState.currentAuctionItem.price.toLocaleString('en-IN')}
                </div>
                <p style={{ 
                  color: '#6b7280', 
                  margin: '10px 0',
                  fontSize: '16px',
                  maxWidth: '500px'
                }}>
                  This luxury item is being auctioned offline. The winning team will have this amount deducted from their cash balance.
                </p>
                {/* Display team's current cash */}
                {teamData && (
                  <div style={{ 
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: '#e0f2fe',
                    borderRadius: '6px',
                    border: '1px solid #0ea5e9'
                  }}>
                    <div style={{ 
                      fontWeight: '600',
                      color: '#0c4a6e',
                      fontSize: '16px'
                    }}>
                      Your Team's Cash: ₹{teamData.portfolio.cash.toLocaleString('en-IN')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
                    />
                  </div>
                </div>
                <button className="primary submit-btn" type="submit" disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}>Submit Investments</button>
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
                    >
                      <option value="cash">Cash</option>
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
                      disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
                    />
                  </div>
                </div>
                <button className="primary submit-btn" type="submit"
                  disabled={gameState.roundStatus !== 'active' || (gameState.timeRemaining || 0) <= 0 || gameState.isAuctionRound}
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
                
                {/* Display auction items if any */}
                {portfolio.auctionItems && portfolio.auctionItems.length > 0 && (
                  <div className="portfolio-item">
                    <span className="portfolio-label">Auction Items:</span>
                    <div style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                      {portfolio.auctionItems.map((item, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '15px', 
                          padding: '12px', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '6px', 
                          marginBottom: '12px',
                          backgroundColor: '#f9fafb'
                        }}>
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            style={{ 
                              width: '50px', 
                              height: '50px', 
                              objectFit: 'cover', 
                              borderRadius: '4px',
                              border: '1px solid #e5e7eb'
                            }} 
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '15px', 
                              fontWeight: '500',
                              color: '#1f2937'
                            }}>
                              {item.name}
                            </div>
                            <div style={{ 
                              fontSize: '14px', 
                              color: '#ef4444',
                              fontWeight: '600'
                            }}>
                              ₹{item.price.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#10b981',
                            fontWeight: '600',
                            padding: '4px 8px',
                            backgroundColor: '#ecfdf5',
                            borderRadius: '4px'
                          }}>
                            OWNED
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
  const [selectedAuctionItem, setSelectedAuctionItem] = React.useState('')
  const [winningTeam, setWinningTeam] = React.useState('')
  const [deductionAmount, setDeductionAmount] = React.useState('') // New state for deduction amount

  // Prebuilt news data for each round
  const prebuiltNews = {
    1: [
      { title: "RBI cuts repo rate by 1% to boost growth", content: "The Reserve Bank of India has announced a 1% cut in the repo rate to stimulate economic growth and boost investor confidence." },
      { title: "OPEC announces sharp oil production cut", content: "OPEC member countries have agreed to significantly reduce oil production, potentially affecting global energy prices." },
      { title: "Bitcoin legalized for payments in all top countries of BRICS", content: "Major BRICS nations have legalized Bitcoin for commercial transactions, boosting cryptocurrency adoption globally." },
      { title: "Major Indian IT company posts record quarterly profits", content: "One of India's leading IT companies has reported record-breaking quarterly profits, signaling strong growth in the technology sector." }
    ],
    2: [
      { title: "New pro-business government elected with reforms agenda in INDIA and USA creating history", content: "Pro-business governments have been elected in both India and the USA, promising significant economic reforms and business-friendly policies." },
      { title: "Civil war burst in country's top religion results in curfew area and lockdown announced", content: "A civil conflict has erupted in a region with religious significance, leading to curfews and lockdowns that may impact regional markets." },
      { title: "Gold prices surge globally as investors rush to safe assets", content: "Global gold prices have surged as investors seek safe-haven assets amid geopolitical tensions and economic uncertainty." },
      { title: "U.S. Fed hikes interest rates sharply", content: "The U.S. Federal Reserve has implemented a sharp interest rate hike to combat inflation, potentially affecting global markets." }
    ],
    3: [
      { title: "India launches Digital Rupee (CBDC)", content: "India has officially launched its Central Bank Digital Currency (CBDC), the Digital Rupee, marking a significant step in financial digitization." },
      { title: "Global recession fears rise", content: "Economic indicators suggest increasing likelihood of a global recession, causing market volatility and investor caution." },
      { title: "AI boom drives record growth in Indian tech sector", content: "The artificial intelligence boom has driven record growth in India's technology sector, with several startups achieving unicorn status." },
      { title: "Large corporate fraud exposed in top Indian company", content: "A major corporate fraud has been uncovered in one of India's leading companies, leading to regulatory investigations and market concerns." }
    ],
    4: [
      { title: "FTX the Major crypto exchange of USA collapses", content: "FTX, one of the world's largest cryptocurrency exchanges, has collapsed amid allegations of mismanagement and fund misappropriation." },
      { title: "Government announces ₹10 lakh crore infrastructure push", content: "The Indian government has announced a massive ₹10 lakh crore infrastructure development plan to boost economic growth and employment." },
      { title: "Peace deal ends war in Europe, global optimism rises", content: "A peace agreement has been signed to end a major conflict in Europe, leading to increased global optimism and market stability." },
      { title: "RBI increases repo rate by 0.5% to fight inflation", content: "The Reserve Bank of India has increased the repo rate by 0.5% to combat rising inflation and stabilize the economy." }
    ],
    5: [
      { title: "Major foreign company announces $10B investment in India", content: "A leading multinational corporation has announced a $10 billion investment in India, signaling strong confidence in the Indian economy." },
      { title: "Rupee hits record low against US Dollar", content: "The Indian Rupee has hit a record low against the US Dollar, affecting import costs and foreign investment flows." },
      { title: "India bans private cryptocurrencies", content: "The Indian government has announced a ban on private cryptocurrencies, promoting the use of the official Digital Rupee." },
      { title: "Government waives corporate taxes for startups", content: "The government has announced a waiver of corporate taxes for eligible startups to promote innovation and entrepreneurship." }
    ]
  }

  React.useEffect(() => {
    const unsubscribe = subscribe((newState) => {
      console.log('AdminPanel received new state:', newState);
      setGameState(newState)
      setRoundData({
        round: newState.currentRound,
        duration: newState.roundDuration,
        status: newState.roundStatus
      })
      
      // Reset price data when round ends
      if (newState.roundStatus === 'ended') {
        console.log('Round ended, resetting price data')
        setPriceData({
          gold: 0,
          crypto: 0,
          stocks: 0,
          realEstate: 0,
          fd: 0
        })
      }
      
      // Automatically select the first auction item when auction round starts
      if (newState.isAuctionRound && !selectedAuctionItem && newState.auctionItems && newState.auctionItems.length > 0) {
        setSelectedAuctionItem(newState.auctionItems[0].id);
      }
      
      // Log when currentAuctionItem changes
      console.log('AdminPanel currentAuctionItem:', newState.currentAuctionItem);
    })
    
    // Listen for round ended event to reset price data
    const handleRoundEnded = () => {
      console.log('Round ended event received, resetting price data')
      setPriceData({
        gold: 0,
        crypto: 0,
        stocks: 0,
        realEstate: 0,
        fd: 0
      })
    }
    
    // Listen for auction ended event
    const handleAuctionEnded = () => {
      console.log('Auction ended event received');
      // Force a re-render by updating the game state
      const currentGameState = getState();
      console.log('Setting game state with isAuctionRound: false');
      setGameState({ ...currentGameState });
    }
    
    // Listen for general state updates
    const handleStateUpdate = () => {
      console.log('State update event received');
      const currentGameState = getState();
      setGameState({ ...currentGameState });
    }
    
    window.addEventListener('roundEnded', handleRoundEnded)
    window.addEventListener('auctionEnded', handleAuctionEnded)
    window.addEventListener('stateUpdate', handleStateUpdate)
    
    return () => {
      unsubscribe()
      window.removeEventListener('roundEnded', handleRoundEnded)
      window.removeEventListener('auctionEnded', handleAuctionEnded)
      window.removeEventListener('stateUpdate', handleStateUpdate)
    }
  })

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

  // Function to publish all prebuilt news for the current round
  function handlePublishRoundNews() {
    const currentRound = gameState.currentRound;
    const newsForRound = prebuiltNews[currentRound] || [];
    
    // Publish all news items for the current round
    newsForRound.forEach(newsItem => {
      // Add a small delay between publishing each news item to simulate real-time publishing
      setTimeout(() => {
        addNews(newsItem)
      }, 100)
    })
  }

  function handlePriceSubmit(e) {
    e.preventDefault()
    updatePrices(priceData)
  }

  function handleEndRound() {
    endRound()
  }

  // Function to start auction round
  function handleStartAuction() {
    startAuctionRound()
    // Automatically select the first auction item in the dropdown
    if (gameState.auctionItems && gameState.auctionItems.length > 0) {
      setSelectedAuctionItem(gameState.auctionItems[0].id);
    }
  }

  // Function to end auction round
  function handleEndAuction() {
    console.log('handleEndAuction called');
    endAuctionRound()
    // Force an immediate state update
    setTimeout(() => {
      const newState = getState();
      console.log('Forcing state update after endAuctionRound:', newState);
      setGameState({ ...newState });
    }, 200);
  }

  // Function to award auction item to a team
  function handleAwardItem() {
    if (selectedAuctionItem && winningTeam) {
      awardAuctionItem(winningTeam, selectedAuctionItem)
      
      // Emit socket event to notify all teams
      const item = gameState.auctionItems.find(item => item.id === selectedAuctionItem);
      if (item) {
        const socket = getSocket();
        if (socket) {
          socket.emit('auction:win', {
            teamName: winningTeam,
            itemName: item.name,
            itemPrice: item.price
          });
        }
      }
      
      // Automatically select the next auction item
      const currentIndex = gameState.auctionItems.findIndex(item => item.id === selectedAuctionItem);
      if (currentIndex !== -1 && currentIndex < gameState.auctionItems.length - 1) {
        // Select the next item
        setSelectedAuctionItem(gameState.auctionItems[currentIndex + 1].id);
      } else if (gameState.auctionItems.length > 0) {
        // If we were at the last item, select the first item
        setSelectedAuctionItem(gameState.auctionItems[0].id);
      } else {
        // No items left
        setSelectedAuctionItem('');
      }
      
      setWinningTeam('')
      
      // Show success message
      alert(`Item awarded to ${winningTeam} successfully!`)
    }
  }

  // Function to deduct cash from a team
  function handleDeductCash() {
    if (deductionAmount && winningTeam) {
      const amount = parseFloat(deductionAmount);
      if (amount > 0) {
        deductCash(winningTeam, amount);
        setDeductionAmount('');
        // Show success message
        alert(`₹${amount.toLocaleString('en-IN')} deducted from ${winningTeam} successfully!`);
      } else {
        alert('Please enter a valid amount');
      }
    }
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
              {/* Auction Round Buttons */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '5px' }}>
                  Auction Round Status: {gameState.isAuctionRound ? 'Active' : 'Inactive'}
                </div>
                {!gameState.isAuctionRound ? (
                  <button onClick={handleStartAuction} className="admin-btn" style={{ background: '#8b5cf6' }}>
                    Start Auction Round
                  </button>
                ) : (
                  <button onClick={handleEndAuction} className="admin-btn" style={{ background: '#ef4444' }}>
                    End Auction Round
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Auction Management Section */}
          {gameState.isAuctionRound && (
            <div className="admin-card">
              <h3>Auction Management</h3>
              <div className="admin-form-group">
                <label className="admin-form-label">Select Auction Item</label>
                <select
                  value={selectedAuctionItem}
                  onChange={e => {
                    const itemId = e.target.value;
                    console.log('Selected auction item changed to:', itemId);
                    setSelectedAuctionItem(itemId);
                    // Automatically set as current item when selected
                    console.log('Setting current auction item to:', itemId);
                    setCurrentAuctionItem(itemId);
                  }}
                  className="admin-form-input"
                >
                  <option value="">Select an item</option>
                  {gameState.auctionItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (₹{item.price.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  onClick={handleAwardItem} 
                  className="admin-btn" 
                  style={{ background: '#f59e0b' }}
                  disabled={!selectedAuctionItem || !winningTeam}
                >
                  Award Item to Team
                </button>
              </div>
              
              {/* Cash Deduction Section */}
              <div className="admin-form-group" style={{ marginTop: '20px' }}>
                <h4>Deduct Cash from Team</h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
                  <div style={{ flex: 1 }}>
                    <label className="admin-form-label">Amount (₹)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={deductionAmount}
                      onChange={e => setDeductionAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                      className="admin-form-input"
                      placeholder="Enter amount"
                    />
                  </div>
                  
                  <div style={{ flex: 2 }}>
                    <label className="admin-form-label">Select Team</label>
                    <select
                      value={winningTeam}
                      onChange={e => setWinningTeam(e.target.value)}
                      className="admin-form-input"
                    >
                      <option value="">Select a team</option>
                      {gameState.teams.map(team => (
                        <option key={team.name} value={team.name}>
                          {team.name} (Cash: ₹{team.portfolio.cash.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button 
                    onClick={handleDeductCash} 
                    className="admin-btn" 
                    style={{ background: '#ef4444', height: 'fit-content', marginTop: 'auto' }}
                    disabled={!deductionAmount || !winningTeam}
                  >
                    Deduct Cash
                  </button>
                </div>
              </div>
              
              <div className="admin-form-group" style={{ marginTop: '15px' }}>
                <label className="admin-form-label">Select Winning Team for Auction Item</label>
                <select
                  value={winningTeam}
                  onChange={e => setWinningTeam(e.target.value)}
                  className="admin-form-input"
                >
                  <option value="">Select a team</option>
                  {gameState.teams.map(team => (
                    <option key={team.name} value={team.name}>
                      {team.name} (Cash: ₹{team.portfolio.cash.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Display current auction item if set */}
              {gameState.currentAuctionItem && (
                <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                  <h4>Current Auction Item</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img 
                      src={gameState.currentAuctionItem.image} 
                      alt={gameState.currentAuctionItem.name} 
                      style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} 
                      onError={(e) => {
                        e.target.src = '/placeholder-image.png'; // Fallback image
                        console.error('Failed to load auction item image:', gameState.currentAuctionItem.image);
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: '600' }}>{gameState.currentAuctionItem.name}</div>
                      <div style={{ color: '#ef4444', fontWeight: '600', fontSize: '18px' }}>
                        ₹{gameState.currentAuctionItem.price.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
              {gameState.isAuctionRound && (
                <div className="status-item">
                  <span className="status-label">Auction Round:</span>
                  <span className="status-value" style={{ color: '#8b5cf6' }}>Active</span>
                </div>
              )}
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
            
            {/* Prebuilt News Section */}
            <div className="admin-form-group" style={{ marginTop: '20px' }}>
              <h4>Prebuilt News for Round {gameState.currentRound}</h4>
              <button 
                type="button" 
                className="admin-btn" 
                style={{ background: '#3b82f6', marginTop: '10px' }}
                onClick={handlePublishRoundNews}
              >
                Publish All Round {gameState.currentRound} News
              </button>
              
              {/* Display prebuilt news for current round */}
              <div className="prebuilt-news-list" style={{ marginTop: '15px' }}>
                {(prebuiltNews[gameState.currentRound] || []).map((newsItem, index) => (
                  <div key={index} className="prebuilt-news-item" style={{ 
                    padding: '10px', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '4px', 
                    marginBottom: '10px' 
                  }}>
                    <div className="prebuilt-news-title" style={{ 
                      fontWeight: '600', 
                      marginBottom: '5px' 
                    }}>
                      {newsItem.title}
                    </div>
                    <div className="prebuilt-news-content" style={{ 
                      fontSize: '14px', 
                      color: '#6b7280' 
                    }}>
                      {newsItem.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

  React.useEffect(() => {
    // initialize real-time updates once
    setupRealtime({
      onPrices: (prices) => setPriceChanges(prices),
      onNews: (news) => pushNewsFromServer(news),
      onLeaderboard: (lb) => setLeaderboard(lb),
      onRound: (round) => applyRoundFromServer(round),
      onAuctionStart: (data) => {
        console.log('Handling auction start event in App:', data);
        // Update local state when auction starts
        applyRoundFromServer({
          isAuctionRound: true,
          roundStatus: 'active',
          roundNumber: 5, // Auction round
          timeRemaining: data.timeRemaining || 300 // 5 minutes
        });
      },
      onAuctionEnd: (data) => {
        console.log('Handling auction end event in App:', data);
        // Update local state when auction ends
        applyRoundFromServer({
          isAuctionRound: false,
          roundStatus: 'ended',
          currentAuctionItem: null
        });
      },
      onAuctionSetItem: (data) => {
        console.log('Handling auction set item event in App:', data);
        // Update current auction item
        const gameState = getState();
        const item = gameState.auctionItems.find(item => item.id === data.itemId);
        if (item) {
          applyRoundFromServer({
            currentAuctionItem: item
          });
        }
      },
      onAuctionWin: (data) => {
        console.log('Handling auction win event in App:', data);
        // Show notification to all teams
        if (data.teamName && data.itemName) {
          alert(`Team ${data.teamName} has won the ${data.itemName}!`);
        }
      }
    })
  }, [])
  const [showAdmin, setShowAdmin] = React.useState(false)
  const [adminLoggedIn, setAdminLoggedIn] = React.useState(false)
  
  // Initialize teams from backend
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
