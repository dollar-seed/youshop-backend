const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// Populates req.user if a valid token is present, but does not block the request.
// Use this on public routes that behave differently for logged-in users (e.g. checkout).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
    } catch (e) {
      // invalid/expired token — treat as anonymous rather than erroring
    }
  }
  next();
}

// Requires a valid token. Optionally restrict to specific roles:
//   requireAuth() — any logged-in user
//   requireAuth('admin') — admin only
//   requireAuth('admin', 'seller') — admin or seller
function requireAuth(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      if (roles.length && !roles.includes(payload.role)) {
        return res.status(403).json({ error: "Not authorized for this action." });
      }
      req.user = payload;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
  };
}

module.exports = { signToken, optionalAuth, requireAuth };
