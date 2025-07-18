const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import the User model

async function authenticateToken(req, res, next) {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  if (!accessToken && !refreshToken) return res.redirect('/login');

  try {
    // Verify access token
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    // Fetch user from DB using ID from token
    const dbUser = await User.findById(decoded._id);
    if (!dbUser) {
      return res.status(401).send("User not found");
    }

    if (dbUser.isBlocked) {
      return res.status(403).send("🚫 You are blocked by the admin.");
    }

    req.user = {
      _id: dbUser._id,
      username: dbUser.username,
      role: dbUser.role
    };

    next();
  } catch (err) {
    // If access token is expired, try using refresh token
    if (err.name === 'TokenExpiredError' && refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const dbUser = await User.findById(decodedRefresh._id);
        if (!dbUser) {
          return res.redirect('/login');
        }

        if (dbUser.isBlocked) {
          return res.status(403).send("🚫 You are blocked by the admin.");
        }

        // Create new access token
        const newAccessToken = jwt.sign(
          { _id: dbUser._id, username: dbUser.username, role: dbUser.role },
          process.env.JWT_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
        );

        res.cookie('accessToken', newAccessToken, { httpOnly: true });

        req.user = {
          _id: dbUser._id,
          username: dbUser.username,
          role: dbUser.role
        };

        next();
      } catch (refreshErr) {
        return res.redirect('/login');
      }
    } else {
      return res.redirect('/login');
    }
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).send("Access Denied");
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
