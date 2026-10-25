import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {query,transaction} from '../repositories/database.js';
import {fail} from '../utils/errors.js';
const safeUser=u=>u&&({id:u.id,name:u.name,email:u.email,role:u.role});
export async function registerUser({name,email,password}){if(!name||name.trim().length>100||!email||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||!password||password.length<8||Buffer.byteLength(password,'utf8')>72)fail('Enter a valid name, email, and password (8–72 bytes)');const hash=await bcrypt.hash(password,12);try{const rows=await transaction(async tx=>{const id=await tx.insert('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',[name.trim(),email.toLowerCase(),hash,'USER']);return [{id,name,email:email.toLowerCase(),role:'USER'}]});return safeUser(rows[0]);}catch(e){if(e.code==='ER_DUP_ENTRY'||e.code==='23505')fail('Email already registered',409);throw e;}}
export async function loginUser(email,password){if(!email||!password)fail('Email and password are required');const rows=await query('SELECT id,name,email,password_hash,role FROM users WHERE email=?',[email.toLowerCase()]);if(!rows[0]||!(await bcrypt.compare(password,rows[0].password_hash)))fail('Invalid email or password',401);return safeUser(rows[0]);}
export function issueToken(user){return jwt.sign(user,process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'2h'});}
