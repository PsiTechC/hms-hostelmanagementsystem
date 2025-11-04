const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || ''

type WhatsAppResult = { status: 'success' | 'error'; result?: any; error?: string }

function normalizePhone(n?: string | null) {
  if (!n) return null
  let s = String(n).trim()
  if (!s) return null
  // remove spaces, dashes, parentheses
  s = s.replace(/[\s()-]/g, '')
  // if starts with 0 and length 11 (0XXXXXXXXXX), drop leading 0 and prefix +91
  if (/^0\d{10}$/.test(s)) s = '+91' + s.slice(1)
  // if 10 digits, assume India
  if (/^\d{10}$/.test(s)) s = '+91' + s
  // if starts with + and digits, keep
  if (/^\+\d{9,15}$/.test(s)) return s
  return null
}

export async function sendTemplate(
  toNumber: string,
  templateName: string,
  parameters: string[] = [],
  options?: { mediaUrl?: string; mediaName?: string; type?: 'TEMPLATE_TEXT' | 'TEMPLATE_WITH_DOCUMENT' }
): Promise<WhatsAppResult> {
  if (!WHATSAPP_API_KEY) return { status: 'error', error: 'Missing WHATSAPP_API_KEY' }

  const to = normalizePhone(toNumber)
  if (!to) return { status: 'error', error: 'Invalid phone number' }

  const apiUrl = 'https://whatsapp-api-backend-production.up.railway.app/api/send-message'

  const body: any = {
    to_number: to,
    template_name: templateName,
    parameters: parameters || [],
    whatsapp_request_type: "TEMPLATE",
  }
  if (options?.mediaUrl) {
    body.media_url = options.mediaUrl
    body.media_name = options.mediaName || 'document.pdf'
  }

  try {
    console.log('[WhatsApp] Sending request to API:', { apiUrl, body })

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WHATSAPP_API_KEY,
      },
      body: JSON.stringify(body),
    })

    console.log('[WhatsApp] API response status:', res.status)

    if (!res.ok) {
      const text = await res.text()
      console.error('[WhatsApp] API error response:', text)
      return { status: 'error', error: `HTTP ${res.status} - ${text}` }
    }
    const data = await res.json()
    console.log('[WhatsApp] API success response:', data)
    return { status: 'success', result: data }
  } catch (err: any) {
    console.error('[WhatsApp] Exception:', err)
    return { status: 'error', error: err?.message || String(err) }
  }
}

export { normalizePhone }
