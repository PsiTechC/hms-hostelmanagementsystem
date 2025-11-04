import { verifyToken, JwtPayload } from './jwt'
import { NextRequest } from 'next/server'

/**
 * Extracts the JWT from the incoming Request (or NextRequest) and verifies it.
 * Returns the decoded JwtPayload (containing at least id and role) or null.
 */
export function getUserFromRequest(req: Request | NextRequest): JwtPayload | null {
  try {
    const getHeader = (r: any) => (typeof r.headers?.get === 'function' ? r.headers.get('authorization') : r.headers?.authorization)
    const auth = getHeader(req)
    if (!auth) return null
    const m = (auth as string).match(/Bearer\s+(.*)/)
    if (!m) return null
    const token = m[1]
    const data = verifyToken(token)
    return (data as JwtPayload) || null
  } catch (err) {
    return null
  }
}
