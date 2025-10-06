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
  roundHistory: [], // Store portfolio values after each round
  // Auction items data
  auctionItems: [
    { 
      id: '1', 
      name: 'Patek Philippe Grand Complications Grandmaster Chime 6300GR-001', 
      price: 125000, 
      image: '/pp watch.jpg' 
    },
    { 
      id: '2', 
      name: 'Richard Mille RM 052 Tourbillon Skull Watch', 
      price: 135000, 
      image: '/rm watch.jpg' 
    },
    { 
      id: '3', 
      name: 'Hermès Birkin Faubourg Bag', 
      price: 100000, 
      image: '/bag.jpg' 
    },
    { 
      id: '4', 
      name: 'Dior x Air Jordan 1 High', 
      price: 95000, 
      image: '/jordan.jpg' 
    },
    { 
      id: '5', 
      name: 'Cartier Love Bracelet', 
      price: 85000, 
      image: '/love.jpg' 
    },
    { 
      id: '6', 
      name: 'Dolce & Gabbana Portofino Light Sneaker', 
      price: 55000, 
      image: '/sneaker.jpg' 
    }
  ],
  // Current auction item being bid on
  currentAuctionItem: null,
  // Flag to indicate if we're in auction round
  isAuctionRound: false
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
    roundHistory: Array.isArray(saved.roundHistory) ? saved.roundHistory : [],
    auctionItems: Array.isArray(saved.auctionItems) ? saved.auctionItems : DEFAULT_STATE.auctionItems,
    currentAuctionItem: saved.currentAuctionItem || null,
    isAuctionRound: saved.isAuctionRound || false
  }
})()

let roundTimerId = null

// Listeners for state changes
let listeners = []

// Subscribe to state changes
export function subscribe(listener) {
  console.log('Subscribing listener');
  listeners.push(listener)
  return () => {
    console.log('Unsubscribing listener');
    listeners = listeners.filter(l => l !== listener)
  }
}

// Get current state (immutable copy)
export function getState() {
  return { ...gameState }
}

// Update state and notify listeners; persist to localStorage
function setState(newState) {
  console.log('Setting game state:', newState);
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
      // Automatically end the round when timer reaches zero
      autoEndRound()
      return
    }
    setState({ timeRemaining: remainingSec })
  }, 1000)
}

// Automatically end the round when timer reaches zero
async function autoEndRound() {
  try {
    console.log('Auto-ending round, sending price changes:', gameState.priceChanges)
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/rounds/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Send current price changes to be applied
        priceChanges: gameState.priceChanges
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('Round ended successfully, received data:', data)
      // Update leaderboard with the new data
      setLeaderboard(data.leaderboard)
      // Reset price changes in the frontend state
      setState({ 
        priceChanges: { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0 }
      })
      // Refresh teams data to get the updated portfolio values
      console.log('Refreshing teams data after auto-end')
      // Set a delay to ensure the backend has time to process
      setTimeout(async () => {
        await initializeTeams()
        // Emit a custom event to notify the admin panel to reset its price data
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('roundEnded'));
        }
      }, 500)
    } else {
      console.error('Failed to end round, response:', response.status, await response.text())
    }
  } catch (err) {
    console.error('Failed to auto-end round:', err)
  }
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

// Update leaderboard based on team values
function updateLeaderboard() {
  const sortedTeams = [...gameState.teams].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
  const leaderboard = sortedTeams.map((team, index) => ({
    rank: index + 1,
    teamName: team.name,
    portfolioValue: team.totalValue || 0,
    change: (team.totalValue || 0) - 500000
  }))
  setState({ leaderboard })
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
  // Recalculate all portfolios when prices change, but only if there are actual changes
  const hasPriceChanges = Object.values(normalized).some(change => change !== 0);
  if (hasPriceChanges) {
    setTimeout(() => {
      recalculateAllPortfolios()
    }, 100)
  }
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
  // Recalculate all portfolios when prices change, but only if there are actual changes
  const hasPriceChanges = Object.values(normalized).some(change => change !== 0);
  if (hasPriceChanges) {
    setTimeout(() => {
      recalculateAllPortfolios()
    }, 100)
  }
}

// End current round and apply price changes
export function endRound() {
  console.log('Ending round manually')
  // Call the backend to end the round and apply price changes
  fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/rounds/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(async data => {
    console.log('Round ended successfully, received data:', data)
    // Update leaderboard with the new data
    setLeaderboard(data.leaderboard)
    // Reset price changes in the frontend state and set round status to ended
    setState({ 
      roundStatus: 'ended',
      timeRemaining: 0,
      priceChanges: { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0 }
    })
    // Clear the round timer
    clearRoundTimer()
    // Refresh teams data to get the updated portfolio values
    console.log('Refreshing teams data after manual end')
    // Set a delay to ensure the backend has time to process
    setTimeout(async () => {
      await initializeTeams()
      // Emit a custom event to notify the admin panel to reset its price data
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('roundEnded'));
      }
    }, 500)
  })
  .catch(err => {
    console.error('Failed to end round:', err)
    // Fallback to local calculation if backend fails
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
      roundStatus: 'ended',
      timeRemaining: 0,
      // Reset price changes
      priceChanges: { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0 }
    })
    // Clear the round timer
    clearRoundTimer()
    updateLeaderboard()
    // Emit a custom event to notify the admin panel to reset its price data
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('roundEnded'));
    }
  })
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
  
  // Restrict transfers to cash only
  if (target !== 'cash') {
    console.warn('Transfers are only allowed to cash')
    return
  }
  
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
  console.log('Recalculating all portfolios with price changes:', gameState.priceChanges);
  const teams = gameState.teams.map(team => {
    let totalValue = team.portfolio.cash
    Object.keys(team.portfolio).forEach(key => {
      if (key !== 'cash' && team.portfolio[key] > 0) {
        const priceChange = gameState.priceChanges[key] || 0
        const value = team.portfolio[key] * (1 + priceChange / 100)
        totalValue += value
        console.log(`Team ${team.name}: ${key} ${team.portfolio[key]} * (1 + ${priceChange}/100) = ${value}, totalValue: ${totalValue}`);
      }
    })
    console.log(`Team ${team.name} recalculated totalValue: ${totalValue}`);
    return { ...team, totalValue }
  })
  console.log('Setting teams state with recalculated values:', teams);
  setState({ teams })
  updateLeaderboard()
}

// Apply round summary from server
export function applyRoundFromServer(round) {
  if (!round) return
  
  const updates = {
    currentRound: Number(round.roundNumber) || gameState.currentRound,
    roundStatus: String(round.status || '').toLowerCase() || gameState.roundStatus
  }
  
  // If round is ended, reset timer
  if (round.status === 'ended') {
    console.log('Round ended, resetting price changes and refreshing teams')
    updates.timeRemaining = 0
    updates.roundStatus = 'ended'
    // Clear the round timer
    clearRoundTimer()
    // Refresh teams data to get the updated portfolio values
    setTimeout(() => {
      console.log('Refreshing teams data after round end')
      initializeTeams()
    }, 100)
    // Reset price changes immediately
    updates.priceChanges = { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0 }
    // Emit a custom event to notify the admin panel to reset its price data
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('roundEnded'));
    }
  }
  
  setState(updates)
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

// Poll for team updates every 5 seconds
let pollInterval = null
export function startPollingTeams() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    try {
      console.log('Polling teams, current price changes:', gameState.priceChanges, 'round status:', gameState.roundStatus)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams`)
      if (response.ok) {
        const teams = await response.json()
        console.log('Received teams data from polling:', teams)
        // Apply current price changes to calculate updated total values
        // But only if the totalValue hasn't been updated by the backend (e.g., after round end)
        const teamsWithUpdatedValues = teams.map(team => {
          if (!team.portfolio) return team
          
          // After a round ends, we should always use the backend-calculated totalValue
          // Only calculate based on current price changes during an active round
          const hasCurrentPriceChanges = Object.values(gameState.priceChanges || {}).some(change => change !== 0);
          
          // Check if the round has ended based on either the current gameState or the round status
          const isRoundEnded = gameState.roundStatus === 'ended' || 
                              (gameState.timeRemaining !== undefined && gameState.timeRemaining <= 0);
          
          if (isRoundEnded && team.totalValue && team.totalValue !== 500000) {
            console.log(`Using backend-calculated totalValue for team ${team.name} during polling:`, team.totalValue)
            // Use the backend-calculated totalValue
            return {
              ...team
            }
          }
          
          // During active rounds, calculate based on current price changes
          let totalValue = team.portfolio.cash || 0
          Object.keys(team.portfolio).forEach(key => {
            if (key !== 'cash' && key !== 'auctionItems' && team.portfolio[key] > 0) {
              // Apply current price changes from gameState
              const priceChange = gameState.priceChanges[key] || 0
              const value = team.portfolio[key] * (1 + priceChange / 100)
              totalValue += value
            }
          })
          
          // Add value of auction items
          if (team.portfolio.auctionItems && Array.isArray(team.portfolio.auctionItems)) {
            team.portfolio.auctionItems.forEach(item => {
              totalValue += item.price || 0;
            });
          }
          
          console.log(`Calculated totalValue for team ${team.name} during polling:`, totalValue)
          return {
            ...team,
            totalValue
          }
        })
        setState({ teams: teamsWithUpdatedValues || [] })
        updateLeaderboard()
      }
    } catch (err) {
      console.warn('Polling failed:', err)
    }
  }, 5000)
}

// Fetch teams from backend and sync to local store
export async function initializeTeams() {
  try {
    console.log('Initializing teams, current price changes:', gameState.priceChanges, 'round status:', gameState.roundStatus)
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams`)
    if (response.ok) {
      const teams = await response.json()
      console.log('Received teams data:', teams)
      // Apply current price changes to calculate updated total values
      // But only if the totalValue hasn't been updated by the backend (e.g., after round end)
      const teamsWithUpdatedValues = teams.map(team => {
        if (!team.portfolio) return team
        
        // After a round ends, we should always use the backend-calculated totalValue
        // Only calculate based on current price changes during an active round
        const hasCurrentPriceChanges = Object.values(gameState.priceChanges || {}).some(change => change !== 0);
        
        // Check if the round has ended based on either the current gameState or the round status
        const isRoundEnded = gameState.roundStatus === 'ended' || 
                            (gameState.timeRemaining !== undefined && gameState.timeRemaining <= 0);
        
        if (isRoundEnded && team.totalValue && team.totalValue !== 500000) {
          console.log(`Using backend-calculated totalValue for team ${team.name}:`, team.totalValue)
          // Use the backend-calculated totalValue
          return {
            ...team
          }
        }
        
        // During active rounds, calculate based on current price changes
        let totalValue = team.portfolio.cash || 0
        Object.keys(team.portfolio).forEach(key => {
          if (key !== 'cash' && key !== 'auctionItems' && team.portfolio[key] > 0) {
            // Apply current price changes from gameState
            const priceChange = gameState.priceChanges[key] || 0
            const value = team.portfolio[key] * (1 + priceChange / 100)
            totalValue += value
          }
        })
        
        // Add value of auction items
        if (team.portfolio.auctionItems && Array.isArray(team.portfolio.auctionItems)) {
          team.portfolio.auctionItems.forEach(item => {
            totalValue += item.price || 0;
          });
        }
        
        console.log(`Calculated totalValue for team ${team.name}:`, totalValue)
        return {
          ...team,
          totalValue
        }
      })
      setState({ teams: teamsWithUpdatedValues || [] })
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

// Deduct cash from a team for purchasing an auction item
export function deductCashForAuctionItem(teamName, itemId) {
  const item = gameState.auctionItems.find(item => item.id === itemId)
  if (!item) {
    throw new Error('Invalid auction item')
  }

  const teams = gameState.teams.map(team => {
    if (team.name === teamName) {
      // Check if team has enough cash
      if (team.portfolio.cash < item.price) {
        throw new Error('Insufficient funds')
      }

      // Deduct price from cash
      const newPortfolio = {
        ...team.portfolio,
        cash: team.portfolio.cash - item.price
      }

      // Recalculate total value
      let totalValue = newPortfolio.cash
      Object.keys(newPortfolio).forEach(key => {
        if (key !== 'cash' && key !== 'auctionItems' && newPortfolio[key] > 0) {
          const priceChange = gameState.priceChanges[key] || 0
          const value = newPortfolio[key] * (1 + priceChange / 100)
          totalValue += value
        }
      })
      
      // Add value of auction items
      if (newPortfolio.auctionItems && Array.isArray(newPortfolio.auctionItems)) {
        newPortfolio.auctionItems.forEach(item => {
          totalValue += item.price || 0;
        });
      }

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

// Award auction item to a team
export function awardAuctionItem(teamName, itemId) {
  const item = gameState.auctionItems.find(item => item.id === itemId)
  if (!item) return

  // Find the team object by name to get its MongoDB ID
  const team = gameState.teams.find(t => t.name === teamName);
  if (!team) {
    console.error('Team not found:', teamName);
    alert('Team not found. Please try again.');
    return;
  }
  
  // Use the team's MongoDB ID for the API call
  const teamId = team._id || team.id;
  if (!teamId) {
    console.error('Team ID not found:', team);
    alert('Team ID not found. Please try again.');
    return;
  }

  // Call backend endpoint to award item
  fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams/${teamId}/award-auction-item`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      itemId: item.id,
      auctionItems: gameState.auctionItems
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(updatedTeam => {
    // Update local store with returned team data
    updateTeamInStore(updatedTeam)
  })
  .catch(err => {
    console.error('Failed to award auction item:', err)
    // Show error to user
    alert('Failed to award auction item. Please try again.')
    
    // Fallback to local update if backend fails
    try {
      // First deduct cash from team
      deductCashForAuctionItem(teamName, itemId)
      
      // Then add item to team's auction items
      const teams = gameState.teams.map(team => {
        if (team.id === teamId || team.name === teamName) {
          const newPortfolio = {
            ...team.portfolio,
            auctionItems: [...(team.portfolio.auctionItems || []), item]
          }

          // Recalculate total value
          let totalValue = newPortfolio.cash
          Object.keys(newPortfolio).forEach(key => {
            if (key !== 'cash' && key !== 'auctionItems' && newPortfolio[key] > 0) {
              const priceChange = gameState.priceChanges[key] || 0
              const value = newPortfolio[key] * (1 + priceChange / 100)
              totalValue += value
            }
          })
          
          // Add value of auction items
          if (newPortfolio.auctionItems && Array.isArray(newPortfolio.auctionItems)) {
            newPortfolio.auctionItems.forEach(item => {
              totalValue += item.price || 0;
            });
          }

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
    } catch (error) {
      console.error('Failed to update team locally:', error)
      alert('Failed to update team. Please try again.')
    }
  })
}

// Deduct cash from a team
export function deductCash(teamName, amount) {
  // Find the team object by name to get its MongoDB ID
  const team = gameState.teams.find(t => t.name === teamName);
  if (!team) {
    console.error('Team not found:', teamName);
    alert('Team not found. Please try again.');
    return;
  }
  
  // Use the team's MongoDB ID for the API call
  const teamId = team._id || team.id;
  if (!teamId) {
    console.error('Team ID not found:', team);
    alert('Team ID not found. Please try again.');
    return;
  }
  
  // Call backend endpoint to deduct cash
  fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/teams/${teamId}/deduct-cash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(updatedTeam => {
    // Update local store with returned team data
    updateTeamInStore(updatedTeam)
  })
  .catch(err => {
    console.error('Failed to deduct cash:', err)
    // Show error to user
    alert('Failed to deduct cash. Please try again.')
  })
}

// Start auction round
export function startAuctionRound() {
  // Automatically select the first auction item when starting the auction round
  const firstAuctionItem = gameState.auctionItems && gameState.auctionItems.length > 0 ? gameState.auctionItems[0] : null;
  
  setState({
    isAuctionRound: true,
    currentAuctionItem: firstAuctionItem,
    roundStatus: 'active',
    timeRemaining: 300 // 5 minutes for auction round
  })
  startRoundTimer()
}

// Set current auction item
export function setCurrentAuctionItem(itemId) {
  console.log('setCurrentAuctionItem called with itemId:', itemId);
  const item = gameState.auctionItems.find(item => item.id === itemId)
  console.log('Found item:', item);
  if (item) {
    console.log('Setting current auction item to:', item);
    setState({ currentAuctionItem: item })
  } else {
    console.log('Item not found, clearing current auction item');
    setState({ currentAuctionItem: null })
  }
}

// End auction round
export function endAuctionRound() {
  console.log('Ending auction round, current state:', gameState);
  setState({
    isAuctionRound: false,
    currentAuctionItem: null,
    roundStatus: 'ended'
  })
  clearRoundTimer()
  
  // Emit a custom event to notify the admin panel
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('auctionEnded'));
    // Also dispatch a general state update event
    window.dispatchEvent(new CustomEvent('stateUpdate'));
  }
  console.log('Auction round ended, new state:', { isAuctionRound: false, roundStatus: 'ended' });
}
