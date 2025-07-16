const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Book = require('../models/Book');
const cookieParser = require('cookie-parser');

const users = []; // In-memory user list for testing. Use DB later.
let refreshTokens = [];

// View Routes
router.get('/login', (req, res) => res.render('user/login'));
router.get('/register', (req, res) => res.render('user/register'));

// Registration
router.post('/register', (req, res) => {
  const { username, password, role } = req.body;
  users.push({ username, password, role });
  res.redirect('/login');
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).send('Invalid credentials');

  const accessToken = jwt.sign({ username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ username }, process.env.JWT_REFRESH_SECRET);
  refreshTokens.push(refreshToken);

  res.cookie('accessToken', accessToken, { httpOnly: true });
  res.cookie('refreshToken', refreshToken, { httpOnly: true });

  if (user.role === 'admin') {
    res.redirect('/admin/add-book');
  } else {
    res.redirect('/books');
  }
});

// Logout 
router.get('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.redirect('/login');
});

// Books View
router.get('/books', async (req, res) => {
  const booksData = await Book.find().sort({ createdAt: -1 });
  const books = booksData.map(book => book.toObject());
  res.render('user/books', { books });
});

router.get('/', (req, res) => res.redirect('/login'));

module.exports = router;
