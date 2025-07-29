const express = require('express');
const cors = require("cors");
const mongoose = require('mongoose');
const path = require('path');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const moment = require('moment');


const app = express();

// Enable CORS
app.use(cors());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/book-manager', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser()); // For accessing JWT in cookies

// Static file folders
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));

// ✅ Set up express-handlebars with helpers
const hbs = exphbs.create({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  helpers: {
    eq: (a, b) => a === b,
    multiply: (a, b) => a * b,
    formatDate: (date) => moment(date).format("MMMM Do YYYY, h:mm:ss a"),
    encodeURIComponent: (value) => encodeURIComponent(value),

    // ✅ Add this helper
    range: function(start, end, options) {
      let result = '';
      for (let i = start; i <= end; i++) {
        result += options.fn(i);
      }
      return result;
    }
  }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
// Routes
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

app.use('/admin', adminRoutes);
app.use('/', userRoutes); // login, register, books, orders, etc.

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`running at http://localhost:${PORT}`);
});





