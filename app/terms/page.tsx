import Link from "next/link"

import { LegalPage, Section, List } from "@/components/legal-page"
import { LEGAL } from "@/lib/legal"

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms you agree to when you shop with PetDo — orders, pricing, payment, delivery and returns.",
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`The terms that apply when you buy from ${LEGAL.brand}. Please read them before placing an order.`}
    >
      <Section id="who-we-are" heading="1. Who we are">
        <p>
          {LEGAL.brand} is a trading name of <strong>{LEGAL.legalName}</strong> (RC{" "}
          {LEGAL.rcNumber}), {LEGAL.address}. Contact:{" "}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>,{" "}
          {LEGAL.supportPhone}.
        </p>
        <p>
          By placing an order you agree to these terms and to our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </Section>

      <Section id="account" heading="2. Your account">
        <p>
          You need an account to check out. Keep your password confidential — you are
          responsible for activity under your account. Tell us immediately if you think
          someone else has access to it. Give us accurate delivery details; we are not
          responsible for orders that fail because the address or phone number was wrong.
        </p>
        <p>
          We may suspend accounts used for fraud or abuse.
        </p>
      </Section>

      <Section id="products-pricing" heading="3. Products and pricing">
        <List
          items={[
            <>
              All prices are in <strong>Nigerian Naira (₦)</strong>. VAT is shown on your
              order summary — depending on the product, it is either included in the price
              or added at checkout, and the breakdown always says which.
            </>,
            <>
              Some products are sold <strong>per kilogram</strong> and others{" "}
              <strong>per piece</strong>. The unit is shown on the product and carried
              through to your order.
            </>,
            <>
              Product images are for illustration. Packaging and appearance may vary.
            </>,
            <>
              Prices and availability can change at any time before you place your order.
            </>,
            <>
              If a product is listed at an obviously incorrect price, we may cancel the
              order and refund you in full rather than fulfil it.
            </>,
          ]}
        />
      </Section>

      <Section id="orders" heading="4. Orders">
        <p>
          Placing an order is an <strong>offer to buy</strong>, not a completed sale. The
          contract forms when we confirm your order after payment is verified. Until then
          we may decline it — for example if the item is out of stock or we cannot verify
          the payment.
        </p>
        <p>
          Discount codes are subject to their own conditions and may be limited by expiry
          date, minimum spend, or number of uses. We recalculate every discount on our own
          systems when the order is created.
        </p>
      </Section>

      <Section id="payment" heading="5. Payment">
        <p>
          Payments are processed by <strong>Paystack</strong>. Card and bank details are
          entered on Paystack&apos;s pages and never reach us. Your order is only
          confirmed once Paystack tells us the payment succeeded.
        </p>
      </Section>

      <Section id="delivery" heading="6. Delivery">
        <p>
          We deliver within Nigeria. Delivery fees are shown at checkout before you pay.
          Typical delivery takes <strong>{LEGAL.deliveryEstimate}</strong>, but this is an
          estimate and not a guarantee — delays outside our control can happen.
        </p>
        <p>
          Risk in the goods passes to you on delivery.
        </p>
      </Section>

      <Section id="returns" heading="7. Returns, cancellations and refunds">
        <p>
          If something arrives damaged, faulty or not what you ordered, contact us within{" "}
          <strong>{LEGAL.returnWindowDays} days</strong> of delivery and we will arrange a
          replacement or refund.
        </p>
        <p>
          For hygiene and safety reasons we cannot accept returns of{" "}
          <strong>opened feed, food or perishable products</strong> unless they are faulty.
          Unopened items in their original packaging can be returned within{" "}
          <strong>{LEGAL.returnWindowDays} days</strong>.
        </p>
        <p>
          Refunds go back to the payment method you used. Contact us at{" "}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> to start a
          return.
        </p>
      </Section>

      <Section id="reviews" heading="8. Reviews and content">
        <p>
          If you post a review, it must be your honest experience and must not be
          unlawful, misleading, offensive, or infringe anyone&apos;s rights. We may remove
          reviews that breach this. By posting, you allow us to display your review on the
          shop.
        </p>
      </Section>

      <Section id="animal-health" heading="9. Product guidance is not veterinary advice">
        <p>
          Feed and pet-care information on this site is general guidance only. It is{" "}
          <strong>not veterinary advice</strong>. Always follow the manufacturer&apos;s
          feeding instructions, and consult a qualified veterinarian about the health of
          your animals.
        </p>
      </Section>

      <Section id="liability" heading="10. Our liability">
        <p>
          We take responsibility for loss you suffer that is a foreseeable result of us
          breaking these terms or failing to use reasonable care. We are not liable for
          indirect or consequential loss, or for loss caused by events outside our
          reasonable control.
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited by law, including
          your statutory rights as a consumer under Nigerian law.
        </p>
      </Section>

      <Section id="changes" heading="11. Changes and governing law">
        <p>
          We may update these terms; the date at the top of this page shows when they last
          changed. The terms in force when you place an order are the ones that apply to
          it.
        </p>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, and
          disputes are subject to the jurisdiction of the Nigerian courts.
        </p>
      </Section>
    </LegalPage>
  )
}
