const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  price: Number,
  cover: String
});

module.exports = mongoose.model('Book', bookSchema);
