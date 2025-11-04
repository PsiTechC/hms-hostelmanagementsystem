import mongoose, { Document, Schema } from 'mongoose'

export interface IStaff extends Document {
  name: string
  role?: string
  email?: string
  passwordHash?: string
  passwordSetAt?: Date
  phone?: string
  hostelId?: mongoose.Types.ObjectId | string
  createdAt: Date
  updatedAt: Date
}

const StaffSchema = new Schema<IStaff>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    email: { type: String, trim: true },
      passwordHash: { type: String },
      passwordSetAt: { type: Date },
    phone: { type: String, trim: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', index: true },
  },
  { timestamps: true }
)

StaffSchema.index({ hostelId: 1, email: 1 }, { unique: false })

export const Staff = (mongoose.models.Staff as mongoose.Model<IStaff>) || mongoose.model<IStaff>('Staff', StaffSchema)

export default Staff
