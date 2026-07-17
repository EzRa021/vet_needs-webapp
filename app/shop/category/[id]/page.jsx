import { createClient } from '@/lib/supabase/server'
import { LEGAL } from '@/lib/legal'
import CategoryBrowser from './category-browser'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://petdo.ng'

async function getCategory(id) {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('categories')
      // meta_title / meta_description have existed since 000 and no form
      // exposes them yet (see the P2 categories item). Read them anyway: the
      // moment they're editable this starts working with no further change.
      .select('id, name, description, image_url, meta_title, meta_description')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const cat = await getCategory(id)

  if (!cat) return { title: 'Category not found' }

  const title = cat.meta_title?.trim() || cat.name
  const description =
    cat.meta_description?.trim() ||
    cat.description?.trim() ||
    `Shop ${cat.name} at ${LEGAL.brand} — delivered across Nigeria.`

  const url = `${appUrl()}/shop/category/${cat.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: LEGAL.brand,
      images: cat.image_url ? [{ url: cat.image_url, alt: cat.name }] : undefined,
    },
  }
}

export default function CategoryPage() {
  return <CategoryBrowser />
}
