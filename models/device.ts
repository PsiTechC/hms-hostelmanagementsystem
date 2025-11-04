import mongoose, { Document, Schema } from 'mongoose'

export interface IDevice extends Document {
  name: string
  ip: string
  port?: number
  commKey?: number
  enabled?: boolean
  hostelId?: mongoose.Types.ObjectId | string
  createdAt: Date
  updatedAt: Date
}

const DeviceSchema = new Schema<IDevice>(
  {
    name: { type: String, required: true, trim: true },
    ip: { type: String, required: true, trim: true },
    port: { type: Number, default: 4370 },
    commKey: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', index: true },
  },
  { timestamps: true }
)

DeviceSchema.index({ hostelId: 1, ip: 1 }, { unique: false })

export const Device = (mongoose.models.Device as mongoose.Model<IDevice>) || mongoose.model<IDevice>('Device', DeviceSchema)

export default Device
