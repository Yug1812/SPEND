// Global game state store
const DEFAULT_STATE = {
  currentRound: 1,
  roundDuration: 6,
  roundStatus: 'active',
  timeRemaining: 360, // seconds
  news: [
    { id: 1, title: "Market rallies on tech earnings", content: "Technology stocks show strong performance", timestamp: Date.now() - 120000 },
    { id: 2, title: "Bond yields drop amid rate cut hopes", content: "Federal Reserve signals potential rate cuts", timestamp: Date.now() - 300000 }
  ],
  priceChanges: { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0 },
  teams: [],
  leaderboard: [],
  roundHistory: [] // Store portfolio values after each round
}

function safeParse(json, fallback) {
  try { return json ? JSON.parse(json) : fallback } catch { return fallback }
}

// Load saved state from localStorage if present
let gameState = (() => {
  const saved = safeParse(localStorage.getItem('spend.state'), null)
  if (!saved) return { ...DEFAULT_STATE }
  return {
    ...DEFAULT_STATE,
    ...saved,
    priceChanges: { ...DEFAULT_STATE.priceChanges, ...(saved.priceChanges || {}) },
    teams: Array.isArray(saved.teams) ? saved.teams : [],
    leaderboard: Array.isArray(saved.leaderboard) ? saved.leaderboard : [],
    roundHistory: Array.isArray(saved.roundHistory) ? saved.roundHistory : []
  }
})()

let roundTimerId = null

// Listeners for state changes
let listeners = []

// Subscribe to state changes
export function subscribe(listener) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

// Get current state (immutable copy)
export function getState() {
  return { ...gameState }
}

// Update state and notify listeners; persist to localStorage
function setState(newState) {
  gameState = { ...gameState, ...newState }
  try { localStorage.setItem('spend.state', JSON.stringify(gameState)) } catch {}
  listeners.forEach(listener => listener(gameState))
}

function clearRoundTimer() {
  if (roundTimerId) {
    clearInterval(roundTimerId)
    roundTimerId = null
  }
}

function startRoundTimer() {
  clearRoundTimer()
  roundTimerId = setInterval(() => {
    const now = Date.now()
    const endAt = gameState.roundEndAt || 0
    const remainingMs = Math.max(0, endAt - now)
    const remainingSec = Math.floor(remainingMs / 1000)
    if (remainingSec <= 0) {
      clearRoundTimer()
      setState({ timeRemaining: 0, roundStatus: 'ended' })
      // Recalculate at end as safeguard (optional: keep using explicit End Round)
      return
    }
    setState({ timeRemaining: remainingSec })
  }, 1000)
}

export function startRound(params) {
  const nextRound = Number(params?.round) || gameState.currentRound
  const durationMinutes = Number(params?.duration) || gameState.roundDuration
  const endAt = Date.now() + durationMinutes * 60 * 1000
  setState({
    currentRound: nextRound,
    roundDuration: durationMinutes,
    roundStatus: 'active',
    roundEndAt: endAt,
    timeRemaining: durationMinutes * 60
  })
  startRoundTimer()
}

// Admin actions
export function updateRound(roundData) {
  const newRound = roundData.round
  const currentRound = gameState.currentRound
  
  // If moving to a new round, save current portfolio values
  if (newRound > currentRound && gameState.roundStatus === 'ended') {
    const roundSnapshot = {
      round: currentRound,
      timestamp: Date.now(),
      teams: gameState.teams.map(team => ({
        teamName: team.name,
        portfolio: { ...team.portfolio },
        totalValue: team.totalValue
      }))
    }
    
    setState({
      currentRound: newRound,
      roundDuration: roundData.duration,
      roundStatus: roundData.status,
      roundHistory: [...gameState.roundHistory, roundSnapshot]
    })
  } else {
    setState({
      currentRound: newRound,
      roundDuration: roundData.duration,
      roundStatus: roundData.status
    })
  }
}

export function addNews(newsData) {
  const newNews = {
    id: Date.now(),
    title: newsData.title,
    content: newsData.content,
    timestamp: Date.now()
  }
  setState({
    news: [newNews, ...gameState.news]
  })
}

export function deleteNews(newsId) {
  const filtered = gameState.news.filter(n => n.id !== newsId)
  setState({ news: filtered })
}

export function updatePrices(priceData) {
  const normalized = {
    gold: Number(priceData.gold) || 0,
    crypto: Number(priceData.crypto) || 0,
    stocks: Number(priceData.stocks) || 0,
    realEstate: Number(priceData.realEstate) || 0,
    fd: Number(priceData.fd) || 0
  }
  setState({
    priceChanges: normalized
  })
  // Recalculate all portfolios when prices change
  setTimeout(() => {
    recalculateAllPortfolios()
  }, 100)
}

// Directly set price changes from server (no admin form side-effects)
export function setPriceChanges(prices) {
  const normalized = {
    gold: Number(prices?.gold) || 0,
    crypto: Number(prices?.crypto) || 0,
    stocks: Number(prices?.stocks) || 0,
    realEstate: Number(prices?.realEstate) || 0,
    fd: Number(prices?.fd) || 0
  }
  setState({ priceChanges: normalized })
}

// End current round and apply price changes
export function endRound() {
  // Apply price changes to all portfolios
  const teams = gameState.teams.map(team => {
    let totalValue = team.portfolio.cash
    
    Object.keys(team.portfolio).forEach(key => {
      if (key !== 'cash' && team.portfolio[key] > 0) {
        const priceChange = gameState.priceChanges[key] || 0
        const value = team.portfolio[key] * (1 + priceChange / 100)
        totalValue += value
      }
    })
    
    return {
      ...team,
      totalValue
    }
  })
  
  setState({ 
    teams,
    roundStatus: 'ended'
  })
  updateLeaderboard()
}

export function updateTimeRemaining(seconds) {
  setState({
    timeRemaining: seconds
  })
}

export function addTeam(team) {
  const newTeam = {
    ...team,
    id: Date.now(),
    portfolio: {
      gold: 0,
      crypto: 0,
      stocks: 0,
      realEstate: 0,
      fd: 0,
      cash: 500000
    },
    totalValue: 500000
  }
  setState({
    teams: [...gameState.teams, newTeam]
  })
  updateLeaderboard()
}

export function updateTeamPortfolio(teamId, investments) {
  const teams = gameState.teams.map(team => {
    if (team.id === teamId || team.name === teamId) {
      const newPortfolio = { ...team.portfolio }
      let totalInvested = 0
      
      Object.keys(investments).forEach(key => {
        if (investments[key] > 0) {
          newPortfolio[key] = (newPortfolio[key] || 0) + investments[key]
          totalInvested += investments[key]
        }
      })
      
      newPortfolio.cash = Math.max(0, newPortfolio.cash - totalInvested)
      
      // Calculate total value with price changes
      let totalValue = newPortfolio.cash
      Object.keys(newPortfolio).forEach(key => {
        if (key !== 'cash' && newPortfolio[key] > 0) {
          const priceChange = gameState.priceChanges[key] || 0
          const value = newPortfolio[key] * (1 + priceChange / 100)
          totalValue += value
        }
      })
      
      return {
        ...team,
        portfolio: newPortfolio,
        totalValue
      }
    }
    return team
  })
  
  setState({ teams })
  updateLeaderboard()
}

export function transferFunds(teamId, fromKey, toKey, rawAmount) {
  const source = String(fromKey)
  const target = String(toKey)
  const amount = Number(rawAmount)
  if (!source || !target || source === target) return
  if (!['cash','gold','crypto','stocks','realEstate','fd'].includes(source)) return
  if (!['cash','gold','crypto','stocks','realEstate','fd'].includes(target)) return
  if (!(amount > 0)) return

  const teams = gameState.teams.map(team => {
    if (team.id === teamId || team.name === teamId) {
      const newPortfolio = { ...team.portfolio }
      const available = Number(newPortfolio[source] || 0)
      if (available < amount) {
        // Not enough balance, ignore
        return team
      }
      newPortfolio[source] = available - amount
      newPortfolio[target] = Number(newPortfolio[target] || 0) + amount

      // Recompute total value using current price changes
      let totalValue = newPortfolio.cash
      Object.keys(newPortfolio).forEach(key => {
        if (key !== 'cash' && newPortfolio[key] > 0) {
          const priceChange = gameState.priceChanges[key] || 0
          const value = newPortfolio[key] * (1 + priceChange / 100)
          totalValue += value
        }
      })

      return {
        ...team,
        portfolio: newPortfolio,
        totalValue
      }
    }
    return team
  })

  setState({ teams })
  updateLeaderboard()
}

// Recalculate all team portfolios when prices change
export function recalculateAllPortfolios() {
  const teams = gameState.teams.map(team => {
    let totalValue = team.portfolio.cash
    Object.keys(team.portfolio).forEach(key => {
      if (key !== 'cash' && team.portfolio[key] > 0) {
        const priceChange = gameState.priceChanges[key] || 0
        const value = team.portfolio[key] * (1 + priceChange / 100)
        totalValue += value
      }
    })
    return { ...team, totalValue }
  })
  setState({ teams })
  updateLeaderboard()
}

// Apply round summary from server
export function applyRoundFromServer(round) {
  if (!round) return
  setState({
    currentRound: Number(round.roundNumber) || gameState.currentRound,
    roundStatus: String(round.status || '').toLowerCase() || gameState.roundStatus
  })
}

// Replace leaderboard from server
export function setLeaderboard(lb) {
  const mapped = Array.isArray(lb) ? lb.map(item => ({
    rank: Number(item.rank) || 0,
    teamName: String(item.teamName || ''),
    portfolioValue: Number(item.portfolioValue) || 0,
    change: (Number(item.portfolioValue) || 0) - 500000
  })) : []
  setState({ leaderboard: mapped })
}

// Push incoming news from server to the top
export function pushNewsFromServer(news) {
  const newNews = {
    id: Date.now(),
    title: String(news?.title || 'Update'),
    content: String(news?.content || ''),
    timestamp: Date.now()
  }
  setState({ news: [newNews, ...gameState.news] })
}

// Fetch teams from backend and sync to local store
export async function initializeTeams() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams`)
    if (response.ok) {
      const teams = await response.json()
      setState({ teams: teams || [] })
      updateLeaderboard()
    }
  } catch (err) {
    console.warn('Failed to fetch teams from backend:', err)
    // Fallback to localStorage
    const existingTeams = JSON.parse(localStorage.getItem('spend.teams') || '[]')
    existingTeams.forEach(team => {
      if (!gameState.teams.find(t => t.name === team.name)) {
        addTeam(team)
      }
    })
  }
}

// Poll for team updates every 5 seconds
let pollInterval = null
export function startPollingTeams() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams`)
      if (response.ok) {
        const teams = await response.json()
        setState({ teams: teams || [] })
        updateLeaderboard()
      }
    } catch (err) {
      console.warn('Polling failed:', err)
    }
  }, 5000)
}

export function stopPollingTeams() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// Update a specific team in the store (after invest/transfer)
export function updateTeamInStore(updatedTeam) {
  const teams = gameState.teams.map(team => 
    (team._id === updatedTeam._id || team.id === updatedTeam._id || team.name === updatedTeam.name) 
      ? updatedTeam 
      : team
  )
  setState({ teams })
  updateLeaderboard()
}
