const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  
  if (!accessToken && !refreshToken) return res.redirect('/login');

  jwt.verify(accessToken, process.env.JWT_SECRET, (err, user) => {
    if (err && err.name === 'TokenExpiredError') {
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (refreshErr, decoded) => {
        if (refreshErr) {
          return res.redirect('/login');
        }

        //  new access token
       const newAccessToken = jwt.sign(
  { _id: decoded._id, username: decoded.username, role: decoded.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
);

       
        res.cookie('accessToken', newAccessToken, { httpOnly: true });

        // Inject user info into request
     req.user = { _id: decoded._id, username: decoded.username, role: decoded.role };

        next();
      });

    } else if (err) {
      return res.redirect('/login');
    } else {
      req.user = user;
      next();
    }
  });
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


