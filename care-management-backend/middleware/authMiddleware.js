const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Token Verification Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ error: "Access denied. No token." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.is_approved) {
      return res.status(403).json({ error: "Your account is pending approval." });
    }

    if (!decoded.hospital_id) {
      return res.status(403).json({ error: "Token missing hospital context." });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err);
    res.status(401).json({ error: "Invalid token." });
  }
};


// 🔒 Role-Based Guards
const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (!req.user?.is_staff) {
    return res.status(403).json({ error: "Staff access required" });
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  requireStaff,
};
