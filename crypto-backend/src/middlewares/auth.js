import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';

export default async function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No or invalid token format' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: 'Invalid token' });
    if (user.isBlocked) return res.status(403).json({ message: 'Account blocked' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired', error: err.message });
  }
}
