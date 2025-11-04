import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment')
}

// Type assertion after validation
const SECRET: string = JWT_SECRET

export type JwtPayload = {
  id: string
  email: string
  role: string
}

export function signToken(payload: JwtPayload, expiresIn: string | number = '7d') {
  return jwt.sign(payload, SECRET, { expiresIn } as jwt.SignOptions)
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET) as JwtPayload
  } catch (err) {
    return null
  }
}