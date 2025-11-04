import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads')
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000'

function safeExtFromMime(mime: string | undefined) {
  if (!mime) return '.dat'
  if (mime === 'application/pdf') return '.pdf'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg'
  // fallback to last segment
  const parts = mime.split('/')
  return parts[1] ? `.${parts[1]}` : '.dat'
}

export async function saveFileToLocal(file: File, subfolder = 'Students'): Promise<string> {
  // file is a browser File-like object with .name and .type and arrayBuffer()
  const buffer = Buffer.from(await (file as any).arrayBuffer())

  let ext = path.extname((file as any).name || '')
  if (!ext) ext = safeExtFromMime((file as any).type)

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  const folderPath = path.join(UPLOAD_DIR, subfolder)

  await mkdir(folderPath, { recursive: true })
  const filePath = path.join(folderPath, fileName)

  await writeFile(filePath, buffer)

  // Return public URL for the uploaded file
  return `${APP_ORIGIN}/uploads/${subfolder}/${fileName}`
}

export async function saveBase64ToLocal(dataUrl: string, subfolder = 'Students', suggestedName?: string): Promise<string> {
  const matches = String(dataUrl).match(/^data:(.+);base64,(.+)$/)
  if (!matches) throw new Error('Invalid data URL')
  const mime = matches[1]
  const b64 = matches[2]
  const ext = path.extname(suggestedName || '') || safeExtFromMime(mime)
  const safeBase = suggestedName ? path.basename(suggestedName).replace(/[^a-z0-9.\-_]/gi, '_') : `${randomUUID()}`
  const fileName = `${Date.now()}-${safeBase}${ext}`
  const folderPath = path.join(UPLOAD_DIR, subfolder)
  await mkdir(folderPath, { recursive: true })
  const filePath = path.join(folderPath, fileName)
  await writeFile(filePath, Buffer.from(b64, 'base64'))
  return `${APP_ORIGIN}/uploads/${subfolder}/${fileName}`
}

export default { saveFileToLocal, saveBase64ToLocal }
