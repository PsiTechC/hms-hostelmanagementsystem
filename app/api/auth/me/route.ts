import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ user })
  } catch (err) {
    console.error('Auth me error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
