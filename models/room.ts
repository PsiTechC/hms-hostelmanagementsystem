import mongoose, { Document, Schema } from 'mongoose'

export interface IRoom extends Document {
  hostelId: mongoose.Types.ObjectId | string
  number: string
  name?: string
  capacity: number
  beds: Array<{ number: string; status: string }>
  occupied: number
  createdAt: Date
  updatedAt: Date
}

const BedSchema = new Schema(
  {
    number: { type: String },
    status: { type: String, default: 'vacant' },
  },
  { _id: false }
)

const RoomSchema = new Schema<IRoom>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', index: true },
    number: { type: String, required: true },
    name: { type: String },
    capacity: { type: Number, default: 1 },
    beds: { type: [BedSchema], default: [] },
    occupied: { type: Number, default: 0 },
  },
  { timestamps: true }
)

RoomSchema.index({ hostelId: 1, number: 1 }, { unique: false })

export const Room = (mongoose.models.Room as mongoose.Model<IRoom>) || mongoose.model<IRoom>('Room', RoomSchema)

export default Room
