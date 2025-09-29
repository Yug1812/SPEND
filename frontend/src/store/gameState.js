// Global game state store
let gameState = {
  currentRound: 1,
  roundDuration: 6,
  roundStatus: 'active',
  timeRemaining: 360, // seconds
  news: [
    { id: 1, title: "Market rallies on tech earnings", content: "Technology stocks show strong performance", timestamp: Date.now() - 120000 },
    { id: 2, title: "Bond yields drop amid rate cut hopes", content: "Federal Reserve signals potential rate cuts", timestamp: Date.now() - 300000 }
  ],
  priceChanges: {
    gold: 0,
    crypto: 0,
    stocks: 0,
    realEstate: 0,
    fd: 0
  },
  teams: [],
  leaderboard: [],
  roundHistory: [] // Store portfolio values after each round
}

// Listeners for state changes
let listeners = []

// Subscribe to state changes
export function subscribe(listener) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

// Get current state
export function getState() {
  return { ...gameState }
}

// Update state and notify listeners
function setState(newState) {
  gameState = { ...gameState, ...newState }
  listeners.forEach(listener => listener(gameState))
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

export function updatePrices(priceData) {
  setState({
    priceChanges: { ...priceData }
  })
  // Recalculate all portfolios when prices change
  setTimeout(() => {
    recalculateAllPortfolios()
  }, 100)
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
    
    return {
      ...team,
      totalValue
    }
  })
  
  setState({ teams })
  updateLeaderboard()
}

function updateLeaderboard() {
  const leaderboard = gameState.teams
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((team, index) => ({
      rank: index + 1,
      teamName: team.name,
      portfolioValue: team.totalValue,
      change: team.totalValue - 500000 // Change from initial value
    }))
  
  setState({ leaderboard })
}

// Initialize with existing teams from localStorage
export function initializeTeams() {
  const existingTeams = JSON.parse(localStorage.getItem('spend.teams') || '[]')
  existingTeams.forEach(team => {
    if (!gameState.teams.find(t => t.name === team.name)) {
      addTeam(team)
    }
  })
}
