import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import net from 'net'

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req)
    if (!user || user.role !== 'hostel-admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const ip = String(body.ip || '').trim()
    const port = body.port ? Number(body.port) : 4370

    if (!ip) {
      return NextResponse.json({ error: 'Missing IP address' }, { status: 400 })
    }

    console.log(`[Test Connection] Testing TCP connection to ${ip}:${port}`)

    // Simple TCP socket test
    const testResult = await new Promise<{success: boolean, message: string, errorCode?: string}>((resolve) => {
      const socket = new net.Socket()
      const timeout = 5000 // 5 second timeout

      const timer = setTimeout(() => {
        socket.destroy()
        resolve({
          success: false,
          message: 'Connection timeout - device not reachable',
          errorCode: 'ETIMEDOUT'
        })
      }, timeout)

      socket.on('connect', () => {
        clearTimeout(timer)
        socket.destroy()
        console.log(`[Test Connection] Successfully connected to ${ip}:${port}`)
        resolve({
          success: true,
          message: 'Device is online and port is accessible'
        })
      })

      socket.on('error', (err: any) => {
        clearTimeout(timer)
        console.error(`[Test Connection] Connection error:`, err)

        let message = 'Failed to connect to device'
        if (err.code === 'ECONNREFUSED') {
          message = 'Connection refused - device may be offline or port is incorrect'
        } else if (err.code === 'EHOSTUNREACH') {
          message = 'Host unreachable - check IP address and network connectivity'
        } else if (err.code === 'ENETUNREACH') {
          message = 'Network unreachable - check your network connection'
        } else if (err.message) {
          message = err.message
        }

        resolve({
          success: false,
          message,
          errorCode: err.code
        })
      })

      socket.connect(port, ip)
    })

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: 'Connection successful! Device is reachable.',
        deviceInfo: {
          serialNumber: 'TCP Connection OK',
          version: 'ZKTeco Device',
          ip,
          port,
          note: 'Device is online and responding on port ' + port
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        message: testResult.message,
        errorType: testResult.errorCode || 'connection_failed',
        details: {
          ip,
          port,
          error: testResult.message
        }
      }, { status: 400 })
    }
  } catch (err) {
    console.error('[Test Connection] Error:', err)
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: String(err)
    }, { status: 500 })
  }
}
