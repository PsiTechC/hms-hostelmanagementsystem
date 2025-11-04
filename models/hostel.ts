import mongoose, { Document, Schema } from 'mongoose'

export interface IHostel extends Document {
  name: string
  code?: string
  address?: string
  totalRooms?: number
  // Night-In / curfew time stored as HH:mm string
  nightInTime?: string
  roomsUnlimited?: boolean
  capacityUnlimited?: boolean
  capacity?: number
  adminName?: string
  licenseExpiry?: string
  occupied?: number
  contactEmail?: string
  contactPhone?: string
  createdAt: Date
  updatedAt: Date
  // temporary password (stored hashed) for hostel admin login
  passwordHash?: string
  passwordSetAt?: Date
}

const HostelSchema = new Schema<IHostel>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, index: true, unique: false },
    address: { type: String },
    // optional admin/contact info and meta
    adminName: { type: String },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    licenseExpiry: { type: String },
      // Night-In / curfew time for the hostel, stored as HH:mm (24h) string, e.g. "22:00"
      nightInTime: { type: String },
    occupied: { type: Number, default: 0 },
    roomsUnlimited: { type: Boolean, default: false },
    totalRooms: { type: Number, default: 0 },
    capacityUnlimited: { type: Boolean, default: false },
    capacity: { type: Number, default: 0 },
    // Store hashed temporary password for admin login. Mark select:false so it
    // is not returned by default in queries / toObject() unless explicitly
    // requested.
    passwordHash: { type: String, select: false },
    passwordSetAt: { type: Date },
    // contactEmail/contactPhone moved above for clarity
  },
  { timestamps: true }
)

export const Hostel = (mongoose.models.Hostel as mongoose.Model<IHostel>) || mongoose.model<IHostel>('Hostel', HostelSchema)

export default Hostel
// import mongoose, { Schema } from 'mongoose'

// export interface IHostel {
//   name: string
//   address?: string
//   capacity?: number
//   adminId?: mongoose.Types.ObjectId
//   createdAt?: Date
// }

// const HostelSchema = new Schema<IHostel>({
//   name: { type: String, required: true },
//   address: { type: String },
//   capacity: { type: Number },
//   adminId: { type: Schema.Types.ObjectId, ref: 'User' },
//   createdAt: { type: Date, default: Date.now },
// })

// export const Hostel = (mongoose.models.Hostel as mongoose.Model<IHostel>) || mongoose.model<IHostel>('Hostel', HostelSchema)
