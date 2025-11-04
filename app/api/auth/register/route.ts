// import { NextResponse } from 'next/server'
// import bcrypt from 'bcrypt'
// import { z } from 'zod'
// import mongooseConnect from '@/lib/mongoose'
// import { User } from '@/models/user'
// import { signToken } from '@/lib/auth'

// const RegisterSchema = z.object({
//   name: z.string().min(1),
//   email: z.string().email(),
//   password: z.string().min(6),
//   role: z.string().optional(),
// })

// export async function POST(req: Request) {
//   const body = await req.json()
//   const parsed = RegisterSchema.safeParse(body)
//   if (!parsed.success) {
//     return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
//   }

//   await mongooseConnect()

//   const existing = await User.findOne({ email: parsed.data.email }).lean()
//   if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

//   const hashed = await bcrypt.hash(parsed.data.password, 10)
//   const user = await User.create({
//     name: parsed.data.name,
//     email: parsed.data.email,
//     password: hashed,
//     role: (parsed.data.role as any) || 'student',
//   })

//   const token = signToken({ id: user._id.toString(), email: user.email })

//   return NextResponse.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
// }
