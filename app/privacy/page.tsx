import { LegalPage, Section, List } from "@/components/legal-page"
import { LEGAL } from "@/lib/legal"

export const metadata = {
  title: "Privacy Policy",
  description:
    "How VetNeeds collects, uses and protects your personal data, and your rights under the Nigeria Data Protection Act.",
}

// Written against what the app ACTUALLY stores (profiles, orders, reviews,
// wishlists, subscribers, contact_messages) rather than generic boilerplate —
// a privacy policy that describes data you don't collect, or omits data you do,
// is the failure mode here.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`How ${LEGAL.brand} collects, uses and protects your personal data, and the rights you have over it.`}
    >
      <Section id="who-we-are" heading="1. Who we are">
        <p>
          {LEGAL.brand} is a trading name of <strong>{LEGAL.legalName}</strong> (RC{" "}
          {LEGAL.rcNumber}), {LEGAL.address}. We sell poultry feed, pet food and farm
          and pet accessories in Nigeria.
        </p>
        <p>
          We are the data controller for the personal data described here. If you have
          questions or want to exercise any right below, contact{" "}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
        </p>
      </Section>

      <Section id="what-we-collect" heading="2. What we collect">
        <p>
          <strong>Account information.</strong> Your email address, and your name and
          phone number if you provide them. Your password is handled by our
          authentication provider and is stored only as a cryptographic hash — we never
          see it.
        </p>
        <p>
          <strong>Order information.</strong> Delivery address, contact name, email and
          phone number, the items and quantities you bought, prices and VAT at the time
          of purchase, any delivery notes you write, and the order&apos;s status history.
        </p>
        <p>
          <strong>Payment information.</strong> Card and bank details are collected and
          processed <strong>by Paystack on their own pages</strong>. They never pass
          through {LEGAL.brand}&apos;s systems and we never store them. We keep only the
          payment reference and whether the payment succeeded.
        </p>
        <p>
          <strong>Things you choose to add.</strong> Product reviews (rating, title,
          comment), wishlist items, newsletter subscriptions (email address), and
          messages you send us through the contact form (name, email, phone, subject,
          message).
        </p>
        <p>
          <strong>Technical data.</strong> Cookies needed to keep you signed in and to
          remember your cart, plus server logs.
        </p>
      </Section>

      <Section id="why" heading="3. Why we use it, and our lawful basis">
        <List
          items={[
            <>
              <strong>To perform our contract with you</strong> — creating your account,
              taking payment, fulfilling and delivering orders, and handling returns.
            </>,
            <>
              <strong>With your consent</strong> — newsletter marketing. You can withdraw
              this at any time; every email includes an unsubscribe link.
            </>,
            <>
              <strong>For our legitimate interests</strong> — answering support messages,
              preventing fraud and abuse, and keeping the shop working.
            </>,
            <>
              <strong>To comply with the law</strong> — keeping tax and accounting records
              of sales.
            </>,
          ]}
        />
        <p>
          We do not sell your personal data, and we do not use it to make automated
          decisions that produce legal effects about you.
        </p>
      </Section>

      <Section id="sharing" heading="4. Who we share it with">
        <p>We share data only with providers who help us run the shop:</p>
        <List
          items={[
            <>
              <strong>Paystack</strong> — payment processing. They receive your email and
              order amount, and collect payment details directly from you.
            </>,
            <>
              <strong>Supabase</strong> — database, authentication and hosting for the data
              described above.
            </>,
            <>
              <strong>Delivery partners</strong> — the name, address and phone number needed
              to deliver your order.
            </>,
            <>
              <strong>Email providers</strong> — to send order confirmations and, if you have
              subscribed, newsletters.
            </>,
          ]}
        />
        <p>
          Some of these providers store data outside Nigeria. Where that happens we rely
          on their contractual data-protection commitments. We may also disclose data
          where the law requires it.
        </p>
      </Section>

      <Section id="retention" heading="5. How long we keep it">
        <List
          items={[
            <>
              <strong>Order records</strong> — kept for as long as tax and accounting law
              requires, even if you close your account.
            </>,
            <>
              <strong>Account data</strong> — until you ask us to delete your account.
            </>,
            <>
              <strong>Newsletter subscriptions</strong> — until you unsubscribe.
            </>,
            <>
              <strong>Contact messages</strong> — kept while we handle your query and for a
              reasonable period afterwards.
            </>,
          ]}
        />
      </Section>

      <Section id="rights" heading="6. Your rights">
        <p>
          Under the Nigeria Data Protection Act you have the right to access a copy of
          your data, to have inaccurate data corrected, to ask for deletion, to object to
          or restrict certain processing, to receive your data in a portable format, and
          to withdraw consent at any time.
        </p>
        <p>
          To exercise any of these, email{" "}
          <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>. We will
          respond within the timeframe the law allows. If you are not satisfied, you may
          complain to the Nigeria Data Protection Commission (NDPC).
        </p>
      </Section>

      <Section id="security" heading="7. How we protect it">
        <p>
          Traffic between your browser and the shop is encrypted. Access to your data is
          enforced at the database level, so one customer cannot read another&apos;s
          orders. Card details never reach our systems. No system is perfectly secure,
          but if a breach affects your rights we will notify you and the NDPC as
          required.
        </p>
      </Section>

      <Section id="children" heading="8. Children">
        <p>
          The shop is not intended for children under 18, and we do not knowingly collect
          their data. If you believe a child has given us personal data, contact us and we
          will delete it.
        </p>
      </Section>

      <Section id="changes" heading="9. Changes to this policy">
        <p>
          If we change this policy we will update the date at the top of this page. Material
          changes will be communicated to you directly where the law requires it.
        </p>
      </Section>
    </LegalPage>
  )
}
