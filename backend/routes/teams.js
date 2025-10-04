const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Team = require('../models/Team');

// Utility to remove sensitive fields
function sanitize(teamDoc) {
  if (!teamDoc) return null
  const obj = teamDoc.toObject ? teamDoc.toObject() : teamDoc
  const { passwordHash, __v, ...rest } = obj
  return rest
}

// GET /api/teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find({}, '-passwordHash -__v').lean()
    res.json(teams)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/teams/register
router.post('/register', async (req, res) => {
  try {
    const { name, members, password } = req.body || {}
    if (!name || !password) return res.status(400).json({ message: 'Name and password are required' })

    const exists = await Team.findOne({ name: new RegExp(`^${name}$`, 'i') })
    if (exists) return res.status(400).json({ message: 'Team name already exists' })

    const passwordHash = await bcrypt.hash(password, 10)
    const team = await Team.create({ name, members: members || [], passwordHash })
    res.status(201).json(sanitize(team))
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/teams/login
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body || {}
    if (!name || !password) return res.status(400).json({ message: 'Name and password are required' })

    const team = await Team.findOne({ name: new RegExp(`^${name}$`, 'i') })
    if (!team) return res.status(400).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, team.passwordHash)
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' })

    res.json(sanitize(team))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/teams/:id
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id, '-passwordHash -__v')
    if (!team) return res.status(404).json({ message: 'Team not found' })
    res.json(team)
  } catch (err) {
    res.status(400).json({ message: 'Invalid team id' })
  }
})

module.exports = router;
