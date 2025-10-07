import { io } from 'socket.io-client'

let socket = null

export function setupRealtime(handlers = {}) {
  if (socket && socket.connected) return socket

  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  console.log('Setting up Socket.IO connection to:', base)
  
  // Add more transport options and reconnect settings
  socket = io(base, { 
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  })

  const { onPrices, onNews, onLeaderboard, onRound, onAuctionStart, onAuctionEnd, onAuctionSetItem, onAuctionWin } = handlers

  socket.on('connect', () => {
    console.log('Socket connected', socket.id)
  })

  if (onPrices) socket.on('prices', (prices) => {
    console.log('Received prices update:', prices)
    onPrices(prices)
  })
  if (onNews) socket.on('news', (news) => {
    console.log('Received news update:', news)
    onNews(news)
  })
  if (onLeaderboard) socket.on('leaderboard:update', (lb) => {
    console.log('Received leaderboard update:', lb)
    onLeaderboard(lb)
  })
  if (onRound) socket.on('round:update', (round) => {
    console.log('Received round update:', round)
    onRound(round)
  })
  
  // Auction events
  if (onAuctionStart) socket.on('auction:start', (data) => {
    console.log('Received auction start event:', data)
    onAuctionStart(data)
  })
  if (onAuctionEnd) socket.on('auction:end', (data) => {
    console.log('Received auction end event:', data)
    onAuctionEnd(data)
  })
  if (onAuctionSetItem) socket.on('auction:set-item', (data) => {
    console.log('Received auction set item event:', data)
    onAuctionSetItem(data)
  })
  if (onAuctionWin) socket.on('auction:win', (data) => {
    console.log('Received auction win event:', data)
    onAuctionWin(data)
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected')
  })

  socket.on('connect_error', (error) => {
    console.log('Socket connection error:', error)
    console.log('Failed to connect to:', base)
  })

  return socket
}

export function getSocket() {
  return socket
}