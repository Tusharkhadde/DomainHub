import jwt from 'jsonwebtoken';
import {AppError} from '../utils/errors.js';
export function auth(req,res,next){try{const token=req.cookies?.session;if(!token)throw 0;req.user=jwt.verify(token,process.env.JWT_SECRET);next();}catch{next(new AppError('Authentication required',401));}}
export const admin=(req,res,next)=>req.user?.role==='ADMIN'?next():next(new AppError('Administrator access required',403));
