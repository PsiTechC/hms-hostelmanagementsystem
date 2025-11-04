import React from 'react'
import HostelForm from '@/components/features/super-admin/hostel-form'

export const metadata = {
  title: 'Create Hostel',
}

export default function Page() {
  return (
    <div className="p-6">
      <HostelForm />
    </div>
  )
}
