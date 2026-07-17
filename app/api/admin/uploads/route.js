import { NextResponse } from 'next/server'

import { getStaffUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const BUCKET = 'product-images'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const MAX_BYTES = 5 * 1024 * 1024

// POST /api/admin/uploads — staff image upload.
//
// Uploads go through the server with the service role rather than straight from
// the browser to Storage. That means Storage needs no RLS policies of its own:
// the only writer is this route, and this route is behind getStaffUser(). It
// follows the same rule as orders — the client asks, the server writes.
export async function POST(request) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const form = await request.formData()
    const file = form.get('file')
    const folder = String(form.get('folder') || 'products').replace(/[^a-z0-9-]/gi, '')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // The bucket enforces both of these too (see the createBucket call), but a
    // clear message beats Storage's generic rejection.
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP or AVIF images are allowed' },
        { status: 400 }
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Image must be under ${MAX_BYTES / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Never reuse the client's filename: it can collide, carry a path
    // ("../"), or leak whatever was on someone's desktop. Keep only the
    // extension, and derive that from the MIME type we just whitelisted.
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
    const name = `${folder}/${crypto.randomUUID()}.${ext}`

    const admin = createAdminClient()
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(name, file, { contentType: file.type, upsert: false })

    if (error) {
      console.error('Upload failed:', error)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(name)

    return NextResponse.json({ data: { url: data.publicUrl, path: name } })
  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE /api/admin/uploads?path=products/abc.jpg
export async function DELETE(request) {
  try {
    const auth = await getStaffUser()
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const path = new URL(request.url).searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.storage.from(BUCKET).remove([path])
    if (error) {
      console.error('Delete upload failed:', error)
      return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete upload API error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
