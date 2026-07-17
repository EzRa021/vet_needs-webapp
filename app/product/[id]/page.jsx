import { createClient } from '@/lib/supabase/server'
import { LEGAL } from '@/lib/legal'
import ProductDetail from './product-detail'

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://petdo.ng'

// Server-side read for metadata + structured data. The page body still fetches
// client-side (it needs cart/wishlist interactivity); this is the half a crawler
// and a link preview actually see.
async function getProduct(id) {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('items')
      .select(
        'id, name, description, long_description, brand, sku, price, image_url, stock, allow_backorder, is_active, rating_avg, rating_count, unit_type, category:categories!items_category_id_fkey (name)'
      )
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle()
    return data
  } catch {
    // Metadata must never take the page down — a failed lookup just means
    // generic tags.
    return null
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const item = await getProduct(id)

  if (!item) {
    return { title: 'Product not found' }
  }

  // Fall back through the fields most likely to say something useful. Truncated
  // because search engines cut descriptions around 160 chars anyway.
  const description =
    item.description?.trim() ||
    item.long_description?.trim()?.slice(0, 160) ||
    `Buy ${item.name} from ${LEGAL.brand}. Delivered across Nigeria.`

  const url = `${appUrl()}/product/${item.id}`

  return {
    title: item.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: item.name,
      description,
      url,
      type: 'website',
      siteName: LEGAL.brand,
      // The product photo IS the OG image. A generated card would look tidier,
      // but the thing someone wants to see in a WhatsApp preview is the bag of
      // feed they're being sent.
      images: item.image_url
        ? [{ url: item.image_url, alt: item.name }]
        : undefined,
    },
    twitter: {
      card: item.image_url ? 'summary_large_image' : 'summary',
      title: item.name,
      description,
      images: item.image_url ? [item.image_url] : undefined,
    },
  }
}

export default async function ProductPage({ params }) {
  const { id } = await params
  const item = await getProduct(id)

  // Product structured data. Everything here is asserted to Google as fact, so
  // it only ever contains what's actually true:
  //   · aggregateRating ONLY when there are real reviews. Emitting a rating with
  //     reviewCount 0 — or a made-up 5 — is exactly what earns a structured-data
  //     penalty, and it would be a lie in the same breath as the review system
  //     that was built to stop fake testimonials.
  //   · availability from real stock, not optimism.
  const jsonLd = item
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: item.name,
        description: item.description || item.long_description || undefined,
        image: item.image_url ? [item.image_url] : undefined,
        sku: item.sku || undefined,
        brand: item.brand ? { '@type': 'Brand', name: item.brand } : undefined,
        category: item.category?.name || undefined,
        offers: {
          '@type': 'Offer',
          url: `${appUrl()}/product/${item.id}`,
          priceCurrency: 'NGN',
          price: Number(item.price),
          availability:
            item.allow_backorder || item.stock === null || Number(item.stock) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          seller: { '@type': 'Organization', name: LEGAL.brand },
        },
        ...(item.rating_count > 0
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Number(item.rating_avg),
                reviewCount: Number(item.rating_count),
              },
            }
          : {}),
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetail />
    </>
  )
}
