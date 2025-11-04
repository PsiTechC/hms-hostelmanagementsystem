import nodemailer from 'nodemailer'

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT || 587)
const secure = process.env.SMTP_SECURE === 'true'
const user = process.env.SMTP_USER || ''
const pass = process.env.SMTP_PASS || ''

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  tls: {
    rejectUnauthorized: false,
  },
})

export async function checkSMTP() {
  try {
    await transporter.verify()
    console.log('✅ SMTP server is ready')
    return true
  } catch (err) {
    console.error('❌ SMTP connection failed:', err)
    return false
  }
}

export async function sendHostelCreatedEmail(opts: {
  to: string
  hostelName: string
  licenseExpiry?: string
  adminName?: string
  emailForLogin?: string
  loginUrl?: string
  plainPassword?: string
}) {
  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>Hostel Created: ${opts.hostelName}</h2>
      <p>Hello ${opts.adminName || 'Hostel Admin'},</p>
      <p>The hostel <b>${opts.hostelName}</b> has been created in the system.</p>
      ${opts.licenseExpiry ? `<p><b>License expiry:</b> ${opts.licenseExpiry}</p>` : ''}
      ${opts.emailForLogin ? `<p><b>Login email:</b> ${opts.emailForLogin}</p>` : ''}
      ${opts.plainPassword ? `<p><b>Temporary password:</b> <code>${opts.plainPassword}</code></p>` : ''}
      ${opts.loginUrl ? `<p>Login here: <a href="${opts.loginUrl}">${opts.loginUrl}</a></p>` : ''}
      <p>Please change this temporary password after first login.</p>
      <p>If you did not expect this email, please contact your administrator.</p>
    </div>
  `

  return transporter.sendMail({
    from: `"Hostel Management" <${user}>`,
    to: opts.to,
    subject: `Hostel created: ${opts.hostelName}`,
    html,
  })
}

export async function sendInviteEmail(opts: {
  to: string
  clientName: string
  loginUrl: string
  emailForLogin: string
  plainPassword: string
  role?: string
}) {
  const roleLine = opts.role ? `<p><strong>Role:</strong> ${opts.role}</p>` : ''
  const html = `
    <div style="font-family:Arial,sans-serif">
      <h2>Welcome to the Hostel Management system, ${opts.clientName}</h2>
      ${roleLine}
      <p>Your account has been created. Use the following credentials to sign in:</p>
      <ul>
        <li><b>URL:</b> <a href="${opts.loginUrl}">${opts.loginUrl}</a></li>
        <li><b>Email:</b> ${opts.emailForLogin}</li>
        <li><b>Password:</b> ${opts.plainPassword}</li>
      </ul>
      <p>Please change this temporary password after first login.</p>
      <p>For security, keep this email safe.</p>
    </div>
  `

  const subject = opts.role ? `Your ${opts.role} account is ready` : 'Your account is ready'

  return transporter.sendMail({
    from: `"System" <${user}>`,
    to: opts.to,
    subject,
    html,
  })
}
