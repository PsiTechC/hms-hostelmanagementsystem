import mongoose, { Document, Schema } from 'mongoose'

export interface IStudent extends Document {
  hostelId: mongoose.Types.ObjectId | string
  name: string
  user_id?: string
  studentId?: string
  email?: string
  phone?: string
  course?: string
  year?: string
  department?: string
  emergencyContact?: string
  photoUrl?: string
  govIdFiles?: { filename: string; url: string; mime?: string; uploadedAt?: Date }[]
  govIdType?: string
  govIdValue?: string
  guardian?: {
    name?: string
    primaryPhone?: string
    whatsappPhone?: string
    relationship?: string
    notificationPreference?: 'whatsapp' | 'email' | 'both'
  }
  whatsappHistory?: Array<{ timestamp: Date; status: 'success'|'failure'|'skipped'; templateName?: string; date?: string; details?: any }>
  room?: mongoose.Types.ObjectId | string
  bedNumber?: string
  allocationHistory?: Array<{
    room: mongoose.Types.ObjectId | string
    roomNumber?: string
    bedNumber?: string
    allocatedAt: Date
    deallocatedAt?: Date
  }>
  passwordHash?: string
  passwordSetAt?: Date
  role?: string
  createdAt: Date
  updatedAt: Date
}

const StudentSchema = new Schema<IStudent>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', index: true },
    name: { type: String, required: true },
    studentId: { type: String },
  user_id: { type: String, unique: true, sparse: true },
    email: { type: String, lowercase: true },
    phone: { type: String },
    course: { type: String },
    year: { type: String },
    department: { type: String },
    emergencyContact: { type: String },
    photoUrl: { type: String },
    govIdFiles: [{ filename: String, url: String, mime: String, uploadedAt: Date }],
    govIdType: { type: String },
    govIdValue: { type: String },
    guardian: {
      name: { type: String },
      primaryPhone: { type: String },
      whatsappPhone: { type: String },
      relationship: { type: String },
      notificationPreference: { type: String, enum: ['whatsapp', 'email', 'both'] },
    },
    whatsappHistory: [
      {
        timestamp: { type: Date },
        status: { type: String, enum: ['success', 'failure', 'skipped'] },
        templateName: { type: String },
        date: { type: String },
        details: { type: Schema.Types.Mixed },
      },
    ],
    room: { type: Schema.Types.ObjectId, ref: 'Room' },
    bedNumber: { type: String },
    allocationHistory: [
      {
        room: { type: Schema.Types.ObjectId, ref: 'Room' },
        roomNumber: { type: String },
        bedNumber: { type: String },
        allocatedAt: { type: Date, default: Date.now },
        deallocatedAt: { type: Date },
      },
    ],
    passwordHash: { type: String },
    passwordSetAt: { type: Date },
    role: { type: String, default: 'student' },
  },
  { timestamps: true }
)

StudentSchema.index({ hostelId: 1, studentId: 1 })
StudentSchema.index({ hostelId: 1, email: 1 })

export const Student = (mongoose.models.Student as mongoose.Model<IStudent>) || mongoose.model<IStudent>('Student', StudentSchema)

export default Student
