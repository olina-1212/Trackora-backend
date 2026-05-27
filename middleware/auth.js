import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // token format: "Bearer <token>"
    const actualToken = token.split(" ")[1];

    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

    req.userId = decoded.userId;

    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid token" });
  }
};

export default auth;