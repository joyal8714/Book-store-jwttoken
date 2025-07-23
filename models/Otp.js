const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true},
  otp: { type: Number, required: true },
  username: String,
  password: String,
  role: String,
  createdAt: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Otp', otpSchema);


