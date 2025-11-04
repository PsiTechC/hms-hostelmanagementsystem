// import mongoose, { Document, Schema } from 'mongoose'

// export type Role = 'superadmin' | 'super-admin' | 'warden' | 'hostel-admin' | 'staff' | 'student' | 'guardian'

// export interface IUser extends Document {
//   email: string
//   name?: string
//   passwordHash?: string
//   role: Role
//   createdAt: Date
//   updatedAt: Date
// }

// const UserSchema = new Schema<IUser>(
//   {
//     email: { type: String, required: true, unique: true, lowercase: true, trim: true },
//     name: { type: String },
//     passwordHash: { type: String },
//     role: { type: String, required: true, default: 'student' },
//   },
//   { timestamps: true }
// )

// // Prevent model overwrite upon hot-reload in dev
// export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema)

// export default User
// import mongoose, { Schema } from 'mongoose'

// export type UserRole = 'super-admin' | 'hostel-admin' | 'warden' | 'staff' | 'guardian' | 'student'

// export interface IUser {
//   name: string
//   email: string
//   password: string
//   role: UserRole
//   createdAt?: Date
// }

// const UserSchema = new Schema<IUser>({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   role: { type: String, required: true, default: 'student' },
//   createdAt: { type: Date, default: Date.now },
// })

// export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
