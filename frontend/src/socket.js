import { io } from 'socket.io-client'

let socket = null

export function setupRealtime(handlers = {}) {
  if (socket && socket.connected) return socket

  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  socket = io(base, { transports: ['websocket'], autoConnect: true })

  const { onPrices, onNews, onLeaderboard, onRound } = handlers

  socket.on('connect', () => {
    // console.log('Socket connected', socket.id)
  })

  if (onPrices) socket.on('prices', (prices) => onPrices(prices))
  if (onNews) socket.on('news', (news) => onNews(news))
  if (onLeaderboard) socket.on('leaderboard:update', (lb) => onLeaderboard(lb))
  if (onRound) socket.on('round:update', (round) => onRound(round))

  socket.on('disconnect', () => {
    // console.log('Socket disconnected')
  })

  return socket
}
