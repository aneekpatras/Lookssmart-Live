import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import * as React from 'react';

import { SeoHead } from '@/Components/SeoHead';
import PublicLayout from '@/Layouts/PublicLayout';

interface PrivacyPolicyProps {
  business: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  effectiveDate: string;
}

/**
 * The salon's privacy policy. Contact details in section 1 come from the same admin-editable
 * Settings the rest of the site reads. Every statement describes what this application does
 * (tracking in TrackController and lib/track.ts, retention in FollowUpsController and
 * InsightsController, forms in the Request classes, mail in config/mail.php). If the code
 * changes, update this page and the "Last updated" date in PublicWebsiteController.
 */
export default function PrivacyPolicy({ business, effectiveDate }: PrivacyPolicyProps) {
  return (
    <>
      <SeoHead
        title="Privacy Policy"
        description={`How ${business.name} collects, uses, and protects your personal information.`}
      />

      <div className="bg-ivory min-h-screen px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-ink-muted hover:text-accent-600 inline-flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>

          <h1 className="font-display text-ink mt-6 text-3xl font-medium sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-ink-muted mt-2 text-sm">Last updated: {effectiveDate}</p>

          <div className="mt-10 space-y-10">
            <Section title="1. Who we are">
              <p>
                This page explains how the website of {business.name} handles your information. If
                you have a question about it, please get in touch:
              </p>
              <ul className="text-ink-muted space-y-1.5">
                <li>
                  <strong className="text-ink font-medium">{business.name}</strong>
                </li>
                {business.address && <li>{business.address}</li>}
                {business.phone && (
                  <li>
                    Phone:{' '}
                    <a
                      href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
                      className="hover:text-accent-600 transition-colors"
                    >
                      {business.phone}
                    </a>
                  </li>
                )}
                {business.email && (
                  <li>
                    Email:{' '}
                    <a
                      href={`mailto:${business.email}`}
                      className="hover:text-accent-600 break-all transition-colors"
                    >
                      {business.email}
                    </a>
                  </li>
                )}
              </ul>
            </Section>

            <Section title="2. What we collect">
              <p>We collect only what you give us or what your browser sends while you use the site.</p>
              <ul className="text-ink-muted list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-ink font-medium">When you book:</strong> your name, your
                  WhatsApp number, an optional email address, the services and time you choose, your
                  time zone, and any note you add.
                </li>
                <li>
                  <strong className="text-ink font-medium">When you contact us:</strong> your name,
                  phone number, an optional email address, a subject and your message.
                </li>
                <li>
                  <strong className="text-ink font-medium">When you create an account:</strong> your
                  name, a phone number or email address, and a password. Passwords are stored in a
                  scrambled (hashed) form, never in plain text.
                </li>
                <li>
                  <strong className="text-ink font-medium">When you write a review:</strong> your
                  rating, the service category, your comment and an optional name.
                </li>
                <li>
                  <strong className="text-ink font-medium">Unsent forms:</strong> if you type your
                  name and a valid phone number into the booking or contact form but do not finish,
                  we save what you entered so that we can follow up with you.
                </li>
                <li>
                  <strong className="text-ink font-medium">Visit information:</strong> a random
                  visitor ID kept in your browser, your device type, browser, operating system,
                  screen size, language and time zone, how you reached the site (for example a link
                  or search), the pages you viewed, the services or deals you looked at, what is in
                  your booking cart, and your IP address. We work out an approximate city from your
                  IP address only when a location file is installed on our server.
                </li>
                <li>
                  <strong className="text-ink font-medium">Security records:</strong> sign-in and
                  other security events, with your IP address and browser details.
                </li>
              </ul>
              <p>
                If your browser sends a Do Not Track signal, we do not record visit information or
                unsent forms.
              </p>
            </Section>

            <Section title="3. Why we use it">
              <ul className="text-ink-muted list-disc space-y-1.5 pl-5">
                <li>to confirm, change and remind you about your appointments;</li>
                <li>to reply to your messages and to follow up on a booking or message you started;</li>
                <li>to show your bookings when you are signed in;</li>
                <li>to show reviews on the website;</li>
                <li>to understand which pages and services people look at, so we can improve the site;</li>
                <li>to keep the website and booking system secure.</li>
              </ul>
            </Section>

            <Section title="4. Cookies and local storage">
              <ul className="text-ink-muted list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-ink font-medium">Session cookie:</strong> keeps your
                  place on the site and protects forms from misuse. If you tick &ldquo;remember
                  me&rdquo; when signing in, a second cookie keeps you signed in for longer.
                </li>
                <li>
                  <strong className="text-ink font-medium">Browser storage:</strong> your booking
                  cart, your random visitor ID, and a small note that remembers when the WhatsApp
                  chat prompt was last shown are kept in your browser&rsquo;s local storage.
                </li>
                <li>
                  <strong className="text-ink font-medium">Google Tag Manager and Google
                  Analytics:</strong> loaded only if the salon has switched them on. They may set
                  their own cookies to count visits. They are never loaded in the staff area.
                </li>
              </ul>
              <p>
                You can delete cookies and local storage in your browser settings. Parts of the
                booking process may then stop working.
              </p>
            </Section>

            <Section title="5. Services we use">
              <ul className="text-ink-muted list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-ink font-medium">Google:</strong> Google Maps shows our
                  location in the Visit us section, Google Fonts provides the website&rsquo;s
                  typefaces, and Google Tag Manager and Google Analytics measure visits when
                  switched on. Google receives your IP address and browser details when it serves
                  these. Google Tag Manager and Google Analytics are only loaded if you press
                  Accept in the cookie banner; you can change your choice at any time with Cookie
                  settings in the footer.
                </li>
                <li>
                  <strong className="text-ink font-medium">YouTube:</strong> The home page can show
                  a video hosted by YouTube (via youtube-nocookie.com), which may set cookies or
                  receive technical data from your browser.
                </li>
                <li>
                  <strong className="text-ink font-medium">Brevo:</strong> sends our emails, such as
                  booking confirmations and reminders.
                </li>
                <li>
                  <strong className="text-ink font-medium">WhatsApp:</strong> the WhatsApp buttons
                  on the site open a chat with us (a wa.me link) when you or our team choose to
                  start it. What you write is then handled by WhatsApp under its own terms.
                </li>
                <li>
                  <strong className="text-ink font-medium">Our hosting provider:</strong> stores the
                  website and its database.
                </li>
              </ul>
              <p>
                If the salon connects text-message or WhatsApp sending for reminders, the number and
                message are passed to that sending service so that it can deliver them.
              </p>
            </Section>

            <Section title="6. How long we keep it">
              <ul className="text-ink-muted list-disc space-y-1.5 pl-5">
                <li>Visit information and security records: about 90 days.</li>
                <li>Unsent booking and contact form drafts: about 180 days.</li>
                <li>
                  Bookings, messages, reviews and accounts: until you ask us to correct or delete
                  them.
                </li>
              </ul>
              <p>
                Old visit information and drafts are cleared automatically when our team opens the
                follow-up and insights pages of the staff area.
              </p>
            </Section>

            <Section title="7. Your choices">
              <ul className="text-ink-muted list-disc space-y-1.5 pl-5">
                <li>
                  Ask us on WhatsApp or by email to show you, correct or delete the information we
                  hold about you.
                </li>
                <li>
                  Emails that we send carry an unsubscribe link. Use it to stop receiving them.
                </li>
                <li>Turn on Do Not Track in your browser to stop visit tracking on this site.</li>
                <li>Block or delete cookies and local storage in your browser settings.</li>
              </ul>
            </Section>

            <Section title="8. Security">
              <p>
                We take reasonable steps to protect your information: the site is served over an
                encrypted connection, passwords are hashed, and the staff area is for signed-in
                team members only. No website or online service can be completely secure, so we
                cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="9. Changes to this page">
              <p>
                We may update this page when the website changes. The date at the top shows when it
                was last updated.
              </p>
            </Section>
          </div>

          <div className="border-border-soft mt-12 border-t pt-8">
            <Link
              href="/"
              className="text-ink-muted hover:text-accent-600 inline-flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-ink text-xl font-medium">{title}</h2>
      <div className="text-ink-muted mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

PrivacyPolicy.layout = (page: React.ReactNode) => <PublicLayout>{page}</PublicLayout>;
