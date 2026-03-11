// middleware/auth.js
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET ; // move to env in prod

function getToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  if (req.cookies?.heroz_token) return req.cookies.heroz_token; // optional cookie support
  return null;
}

exports.protectAPI = (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.status(401).json({ message: "Unauthorized: missing token" });

  try {
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ["HS256"],
      issuer: "heroz-auth",     // match what you used when  
      audience: "heroz-clients" // match what you used when  
    });
    req.user = decoded; // { prtuserid, sub, iat, exp, ... }
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: invalid/expired token" });
  }
};

// OPTIONAL: guard by role/usertype if you include it in the JWT
exports.requireUserTypes = (...allowed) => (req, res, next) => {
  const t = req.user?.usertype; // include usertype in token at   if you need this
  if (!t || !allowed.includes(t)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};
