const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  roundNumber: {
    type: Number,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'paused', 'ended'],
    default: 'upcoming'
  },
  duration: { type: Number, default: 6 }, // in minutes
  startTime: Date,
  endTime: Date,
  priceChanges: {
    gold: { type: Number, default: 0 },
    crypto: { type: Number, default: 0 },
    stocks: { type: Number, default: 0 },
    realEstate: { type: Number, default: 0 },
    fd: { type: Number, default: 0 }
  },
  news: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
    publishedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

roundSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Round', roundSchema);
