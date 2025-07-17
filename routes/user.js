const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Book = require('../models/Book');
const cookieParser = require('cookie-parser');
const User=require('../models/User');
let refreshTokens = [];

// View Routes
router.get('/login', (req, res) => res.render('user/login'));
router.get('/register', (req, res) => res.render('user/register'));




router.post('/register',async(req,res)=>{
const{username,password,role}=req.body

try{
const existingUser=await User.findOne({username}) 
if (existingUser) return res.send('user already exist')

  const newUser=new User({username,password,role})
  await newUser.save()
res.redirect('/login')
}catch (err){
  console.error("reg error",err)
res.send('registration failed')
}

})


router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.send("Invalid credentials");
    }

    const accessToken = jwt.sign({ username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ username }, process.env.JWT_REFRESH_SECRET);

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });

  
    if (user.role === 'admin') {
      res.redirect('/admin/add-book');
    } else {
      res.redirect('/books');
    }
    // res.send({"Login successful": true, "role": user.role, "username": user.username});

  } catch (err) {
    console.error("Login error:", err);
    res.send("Login failed");
  }
});


router.get('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.redirect('/login');
});




router.get('/books', async (req, res) => {
  const booksData = await Book.find().sort({ createdAt: -1 });
  const books = booksData.map(book => book.toObject());
  res.render('user/books', { books });
});

router.get('/', (req, res) => res.redirect('/login'));

module.exports = router;
