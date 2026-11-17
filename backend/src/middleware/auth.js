import jwt from 'jsonwebtoken';
import {AppError} from '../utils/errors.js';

export function auth(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    const token = req.cookies?.session || bearer;
    if (!token) throw 0;
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new AppError('Authentication required', 401));
  }
}

export const admin = (req, res, next) =>
  req.user?.role === 'ADMIN' ? next() : next(new AppError('Administrator access required', 403));
