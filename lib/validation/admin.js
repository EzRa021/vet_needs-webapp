import { z } from 'zod'
import { NextResponse } from 'next/server'

// Request schemas for the admin CRUD routes.
//
// These routes previously validated by hand — a ladder of ifs after a
// hand-rolled buildPayload() — which meant the rules for what a product or a
// coupon may contain lived in a different shape in every file, and anything the
// ladder forgot went straight to Postgres. The public routes already validate
// with zod (see app/api/contact); this brings admin in line.
//
// Two conventions worth knowing:
//   * Create schemas are strict about required fields. Update schemas make
//     everything optional (PATCH is a partial) and are then checked for
//     emptiness by the route, preserving the existing "Nothing to update".
//   * Limits mirror the column widths the payload builders already sliced to,
//     so validation rejects oversized input with a message instead of silently
//     truncating it.

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Trimmed string that becomes null when blank — matches the DB's nullable text columns. */
const nullableText = (max) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((v) => v || null)
    .nullable()
    .optional()

/** Money / quantity. Rejects NaN and negatives rather than clamping them silently. */
const amount = (max = 1e12) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null ? null : Number(v)))
    .refine((v) => v === null || Number.isFinite(v), 'Enter a valid number.')
    .refine((v) => v === null || v >= 0, "This can't be negative.")
    .refine((v) => v === null || v <= max, `That's above the maximum of ${max}.`)
    .nullable()
    .optional()

/** An id the database will accept.
 *
 * LABELLED, because "That id is not valid." on a form carrying four different
 * ids tells nobody which one to fix. The product form showed exactly that
 * sentence in a red banner over a page whose only edit was a photograph.
 */
const uuid = (what = 'id') => z.string().uuid(`That ${what} is not valid.`)

/** An id a form is allowed to leave blank.
 *
 * '' IS "NONE", NOT A BAD ID. Every payload builder behind these routes already
 * reads it that way — `out.category_id = body.category_id || null` — and the
 * select controls that feed them send '' for their empty option. Validation was
 * added in FRONT of those builders later and refused what they were written to
 * accept, so a blank category could fail a save that had nothing to do with
 * categories.
 *
 * An absent key still means "leave this column alone": `.optional()` omits it
 * rather than writing undefined, which is what `'category_id' in body` in the
 * payload builders depends on.
 */
const optionalUuid = (what) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim() || null : v),
      uuid(what).nullable()
    )
    .optional()

/** An ISO date string, or null. Accepts '' from empty date inputs. */
const dateish = z
  .union([z.string(), z.null()])
  .transform((v) => (v === '' || v == null ? null : v))
  .refine(
    (v) => v === null || !Number.isNaN(Date.parse(v)),
    'Enter a valid date.'
  )
  .nullable()
  .optional()

/* -------------------------------------------------------------------------- */
/* categories                                                                  */
/* -------------------------------------------------------------------------- */

const categoryFields = {
  name: z.string().trim().min(1, 'Name is required').max(200),
  parent_id: optionalUuid('parent category'),
  description: nullableText(500),
  image_url: nullableText(1000),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
  meta_title: nullableText(70),
  meta_description: nullableText(160),
}

export const CategoryCreateSchema = z.object(categoryFields)
export const CategoryUpdateSchema = z
  .object({ ...categoryFields, regenerate_slug: z.boolean().optional() })
  .partial()

/* -------------------------------------------------------------------------- */
/* products                                                                    */
/* -------------------------------------------------------------------------- */

const productFields = {
  name: z.string().trim().min(1, 'Product name is required').max(200),
  sku: nullableText(64),
  brand: nullableText(120),
  description: nullableText(500),
  long_description: nullableText(5000),
  image_url: nullableText(1000),

  price: amount(),
  compare_at_price: amount(),
  cost_price: amount(),
  vat_rate: amount(100),
  stock: amount(),
  low_stock_threshold: amount(),

  vat_enabled: z.boolean().optional(),
  vat_inclusive: z.boolean().optional(),
  allow_backorder: z.boolean().optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),

  unit_type: z.enum(['piece', 'kg']).optional(),
  category_id: optionalUuid('category'),
  tags: z.array(z.string().trim().max(60)).max(50).optional(),
  // Free-form spec bag driving the product page table and the shop facets.
  attributes: z.record(z.string(), z.any()).optional(),
}

export const ProductCreateSchema = z.object(productFields).extend({
  // Price is required on create but may be omitted on a PATCH.
  price: amount().refine((v) => v !== null && v !== undefined, 'Price is required'),
})
export const ProductUpdateSchema = z.object(productFields).partial()

export const ProductBulkSchema = z
  .object({
    action: z.enum(['activate', 'deactivate', 'move', 'price'], {
      errorMap: () => ({ message: 'Unknown bulk action.' }),
    }),
    ids: z
      .array(uuid('product id'))
      .min(1, 'Select at least one product.')
      .max(500, 'Too many products in one operation.'),
    category_id: optionalUuid('category'),
    percent: z.coerce
      .number()
      .min(-100, "A reduction can't exceed 100%.")
      .max(1000)
      .optional(),
  })
  .superRefine((v, ctx) => {
    // UNCATEGORISED IS A DESTINATION. The route says so in as many words —
    // "null is a legitimate destination" — and the dialog offers it, so only a
    // MISSING key is a missing choice. `!v.category_id` refused null and made
    // the option in the menu unusable.
    if (v.action === 'move' && v.category_id === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category_id'],
        message: 'Choose a category to move these products into.',
      })
    }
    if (v.action === 'price' && (v.percent === undefined || v.percent === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['percent'],
        message: 'Enter a non-zero percentage.',
      })
    }
  })

/* -------------------------------------------------------------------------- */
/* coupons                                                                     */
/* -------------------------------------------------------------------------- */

const couponFields = {
  // Length is checked AFTER normalising, so "ab " can't sneak past a raw
  // min(3) and land in the database as a 2-character code.
  code: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v.toUpperCase().replace(/\s+/g, ''))
    .refine((v) => v.length > 0, 'Give the coupon a code.')
    .refine((v) => v.length >= 3, 'Codes must be at least 3 characters.'),
  description: nullableText(300),
  discount_type: z.enum(['percent', 'fixed'], {
    errorMap: () => ({ message: 'Choose a discount type.' }),
  }),
  discount_value: amount(),
  min_order_amount: amount(),
  max_discount_amount: amount(),
  max_uses: amount(),
  max_uses_per_user: amount(),
  first_order_only: z.boolean().optional(),
  is_active: z.boolean().optional(),
  starts_at: dateish,
  expires_at: dateish,
  // Coupon scope (020). These must be listed here or zod's default key
  // stripping would drop them before buildPayload ever sees them, silently
  // turning a category-scoped coupon into a store-wide one. buildPayload
  // re-checks the uuids because they end up in an `= any(...)` against the
  // catalogue.
  applies_to_category_ids: z.array(uuid('category id')).max(50).optional(),
  applies_to_item_ids: z.array(uuid('product id')).max(50).optional(),
}

// Shared rules that must hold whichever fields are present.
const couponRules = (v, ctx) => {
  if (
    v.discount_type === 'percent' &&
    v.discount_value != null &&
    v.discount_value > 100
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discount_value'],
      message: "A percentage discount can't be more than 100%.",
    })
  }
  if (v.starts_at && v.expires_at && new Date(v.expires_at) <= new Date(v.starts_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expires_at'],
      message: 'The expiry date must be after the start date.',
    })
  }
}

export const CouponCreateSchema = z
  .object(couponFields)
  .extend({
    discount_value: amount().refine(
      (v) => v !== null && v !== undefined && v > 0,
      'Enter a discount value.'
    ),
  })
  .superRefine(couponRules)

export const CouponUpdateSchema = z.object(couponFields).partial().superRefine(couponRules)

/* -------------------------------------------------------------------------- */
/* promotions                                                                  */
/* -------------------------------------------------------------------------- */

export const PLACEMENTS = ['home_hero', 'home_banner', 'shop_banner', 'popup']

const promotionFields = {
  title: z.string().trim().min(1, 'Give the promotion a title.').max(200),
  subtitle: nullableText(300),
  image_url: nullableText(1000),
  link_url: nullableText(1000),
  placement: z.enum(PLACEMENTS).optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).optional(),
  is_active: z.boolean().optional(),
  starts_at: dateish,
  ends_at: dateish,
}

const promotionRules = (v, ctx) => {
  if (v.starts_at && v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ends_at'],
      message: 'The end date must be after the start date.',
    })
  }
}

export const PromotionCreateSchema = z.object(promotionFields).superRefine(promotionRules)
export const PromotionUpdateSchema = z
  .object(promotionFields)
  .partial()
  .superRefine(promotionRules)

/* -------------------------------------------------------------------------- */
/* orders, refunds, reviews, customers, settings                               */
/* -------------------------------------------------------------------------- */

// Statuses staff may set by hand. 'paid' and 'refunded' are deliberately absent
// — they're written only by the payment and refund webhooks. See the route.
export const SETTABLE_ORDER_STATUS = ['processing', 'shipped', 'delivered', 'canceled']

export const OrderUpdateSchema = z
  .object({
    status: z.enum(SETTABLE_ORDER_STATUS, {
      errorMap: () => ({ message: 'That status cannot be set by hand.' }),
    }).optional(),
    tracking_number: nullableText(120),
    admin_notes: nullableText(2000),
  })
  .refine(
    (v) => Object.keys(v).length > 0,
    'Nothing to update'
  )

export const RefundActionSchema = z
  .object({
    action: z.enum(['approve', 'reject'], {
      errorMap: () => ({ message: 'Choose approve or reject.' }),
    }),
    amount: amount(),
    restock: z.boolean().optional(),
    admin_notes: nullableText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'approve' && (v.amount == null || v.amount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Enter the amount to refund.',
      })
    }
  })

export const ReviewUpdateSchema = z.object({
  is_approved: z.boolean({
    errorMap: () => ({ message: 'Approval must be true or false.' }),
  }),
})

export const ROLES = ['customer', 'staff', 'admin']

export const CustomerRoleSchema = z.object({
  role: z.enum(ROLES, {
    errorMap: () => ({ message: 'That role is not valid.' }),
  }),
})

export const SettingsUpdateSchema = z.object({
  // Settings are a free-form key/value bag; the route whitelists the keys.
  values: z.record(z.string(), z.any()),
})

/* -------------------------------------------------------------------------- */
/* route helper                                                                */
/* -------------------------------------------------------------------------- */

/**
 * First readable message out of a ZodError.
 *
 * Schema-authored messages are returned untouched. Only zod's own defaults are
 * rewritten, because they either name no field ("Required") or leak the schema
 * at the operator ("Invalid enum value. Expected 'piece' | 'kg'...").
 */
export function zodMessage(error) {
  const issue = error.issues?.[0]
  if (!issue) return 'That request was not valid.'

  const field = (issue.path || []).filter((p) => typeof p === 'string').pop()
  const label = field ? field.replace(/_/g, ' ') : null
  const sentence = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  // Only zod's own wording gets replaced. A schema that supplied its own
  // message said something we can't reconstruct here — the order route's
  // "That status cannot be set by hand" explains a rule, where a generated
  // "not a valid choice" would just restate the rejection.
  const isZodDefault =
    /^Required$/.test(issue.message) ||
    /^Expected .*, received/.test(issue.message) ||
    /^Invalid enum value/.test(issue.message)

  if (isZodDefault) {
    if (issue.code === 'invalid_type' && issue.received === 'undefined') {
      return label ? `${sentence(label)} is required.` : 'A required field is missing.'
    }
    if (issue.code === 'invalid_enum_value') {
      return label ? `That ${label} is not a valid choice.` : 'That value is not allowed.'
    }
    if (issue.code === 'invalid_type') {
      return label
        ? `${sentence(label)} is the wrong type.`
        : 'One of the values is the wrong type.'
    }
  }
  return issue.message
}

/**
 * Parses and validates a JSON request body.
 *
 * Mirrors parseBody() in lib/api.js but returns the `{ error }` + status shape
 * the admin routes already use, so callers keep their existing error handling:
 *
 *   const { data: body, response } = await parseAdminBody(request, Schema)
 *   if (response) return response
 */
export async function parseAdminBody(request, schema) {
  let raw
  try {
    raw = await request.json()
  } catch {
    return {
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      response: NextResponse.json(
        { error: zodMessage(result.error) },
        { status: 400 }
      ),
    }
  }
  return { data: result.data }
}
