const CONTACT_EMAIL = "info@lankan.org";

export const metadata = {
  title: "Privacy Policy | Lankan Web Directory",
  description:
    "How Lankan Web Directory collects, uses, publishes and protects account and business listing information.",
};

const sections = [
  { id: "scope", label: "Scope" },
  { id: "information", label: "Information we collect" },
  { id: "public", label: "Public information" },
  { id: "private", label: "Private account information" },
  { id: "use", label: "How we use information" },
  { id: "sharing", label: "Service providers and sharing" },
  { id: "cookies", label: "Cookies and similar technology" },
  { id: "security", label: "Security" },
  { id: "retention", label: "Retention" },
  { id: "rights", label: "Your choices and rights" },
  { id: "children", label: "Children" },
  { id: "changes", label: "Changes and contact" },
];

function PolicySection({ id, number, title, children }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-stone-200 pt-9">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#BF283B]">
        {number}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#211b18] sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-7 text-stone-600">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[#fffaf7] text-[#211b18]">
      <header className="relative overflow-hidden border-b border-red-100">
        <div
          className="absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#BF283B]/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#BF283B]">
            Your information, explained clearly
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
            Lankan Web Directory is designed to publish business information.
            This policy explains the difference between information you choose
            to make public and the private account information we use to
            operate and protect your account.
          </p>
          <p className="mt-5 text-sm font-semibold text-stone-500">
            Last updated: July 30, 2026
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 min-[360px]:px-5 sm:px-6 sm:py-20 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-2xl bg-[#211b18] p-5 text-white lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
            On this page
          </p>
          <nav className="mt-4" aria-label="Privacy policy sections">
            <ol className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-3 py-2 text-sm leading-5 text-stone-300 transition hover:bg-white/10 hover:text-white"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 space-y-10 rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_18px_50px_rgba(31,26,24,0.06)] min-[360px]:p-6 sm:p-10">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-[#BF283B]">
              The essential point
            </h2>
            <p className="mt-2 leading-7 text-stone-700">
              Information entered as part of a published business page is
              intended to be publicly visible. Your account email and password
              are not displayed publicly unless you separately choose to enter
              the same email address as public business contact information.
            </p>
          </div>

          <PolicySection id="scope" number="01" title="Scope">
            <p>
              This policy applies when you visit Lankan Web Directory, create
              or use an account, build or publish a business page, contact us,
              or otherwise use our services. In this policy, “we”, “us” and
              “our” mean Lankan Web Directory.
            </p>
            <p>
              We aim to process personal data fairly, transparently and in
              accordance with applicable data-protection law, including Sri
              Lanka&apos;s Personal Data Protection Act, where it applies.
            </p>
          </PolicySection>

          <PolicySection
            id="information"
            number="02"
            title="Information we collect"
          >
            <p>We may collect the following categories of information:</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-[#BF283B]">
              <li>
                <strong className="text-stone-800">Account information:</strong>{" "}
                your login email, account identifier, account status, plan,
                trial or subscription dates and account-role information.
              </li>
              <li>
                <strong className="text-stone-800">Business-page content:</strong>{" "}
                business name, description, services, location, address, phone
                number, public contact email, social links, images, logos and
                other content you submit.
              </li>
              <li>
                <strong className="text-stone-800">Communications:</strong>{" "}
                information in emails or support requests you send to us.
              </li>
              <li>
                <strong className="text-stone-800">Technical information:</strong>{" "}
                IP address, browser or device information, security events,
                approximate usage information and pages visited, when collected
                by our hosting, security, authentication or advertising
                services.
              </li>
            </ul>
          </PolicySection>

          <PolicySection
            id="public"
            number="03"
            title="Information displayed publicly"
          >
            <p>
              The purpose of the service is to publish business listings.
              Content you add to a business page may be visible to anyone on
              the internet once the page or listing is published or approved.
              Public information may be indexed by search engines, shared by
              other people, or retained in third-party caches outside our
              control.
            </p>
            <p>
              Only provide business-page content that you are authorised and
              comfortable to make public. Do not publish private personal
              information, confidential material, or another person&apos;s data
              without a lawful reason and their permission where required.
            </p>
            <div className="rounded-xl bg-[#fffaf7] p-4 text-stone-700">
              <strong className="text-[#211b18]">Public-email example:</strong>{" "}
              your login email remains private by default. If you type that
              same address into the public contact-email field on your business
              page, it will be displayed publicly because you selected it as
              business contact information.
            </div>
          </PolicySection>

          <PolicySection
            id="private"
            number="04"
            title="Private account information and passwords"
          >
            <p>
              We do not display your account login email as part of your public
              business page unless you separately submit it as public page
              content. Account information may be available to authorised
              administrators when reasonably necessary for account support,
              moderation, security and service administration.
            </p>
            <p>
              Passwords are handled by our authentication provider and are
              stored using secure one-way hashing, not as readable plaintext.
              We and our administrators cannot view or recover your original
              password. If you forget it, you must reset it. You are responsible
              for keeping your password and account access secure.
            </p>
          </PolicySection>

          <PolicySection
            id="use"
            number="05"
            title="How we use information"
          >
            <p>We use information where reasonably necessary to:</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-[#BF283B]">
              <li>create, authenticate and administer accounts;</li>
              <li>build, review, approve, publish and display business pages;</li>
              <li>provide trials, plans and account features;</li>
              <li>respond to support requests and communicate about the service;</li>
              <li>detect abuse, protect accounts and maintain service security;</li>
              <li>operate, troubleshoot and improve the website; and</li>
              <li>meet legal obligations and enforce our rules.</li>
            </ul>
            <p>
              Depending on the context and applicable law, processing may be
              based on providing the service you requested, your consent, our
              legitimate operational and security interests, or a legal
              obligation.
            </p>
          </PolicySection>

          <PolicySection
            id="sharing"
            number="06"
            title="Service providers and sharing"
          >
            <p>
              We do not sell your private account information. We may share or
              process information with service providers that help us operate
              the website, including:
            </p>
            <ul className="list-disc space-y-2 pl-5 marker:text-[#BF283B]">
              <li>
                <strong className="text-stone-800">Supabase</strong> for
                authentication, database services and file storage;
              </li>
              <li>
                <strong className="text-stone-800">Cloudflare Turnstile</strong>{" "}
                for bot and abuse prevention;
              </li>
              <li>
                <strong className="text-stone-800">hosting and infrastructure
                providers</strong> that deliver and secure the website; and
              </li>
              <li>
                <strong className="text-stone-800">Google advertising
                services</strong> where advertisements are displayed.
              </li>
            </ul>
            <p>
              These providers may process data in countries outside Sri Lanka
              under their own terms and privacy practices. We may also disclose
              information when required by law, to protect rights or safety, to
              investigate abuse, or as part of a business reorganisation with
              appropriate safeguards.
            </p>
            <p>
              Public business-page information is, by its nature, shared with
              anyone who visits or accesses the published page.
            </p>
          </PolicySection>

          <PolicySection
            id="cookies"
            number="07"
            title="Cookies and similar technology"
          >
            <p>
              The website and its providers may use cookies, local storage and
              similar technologies to maintain login sessions, protect forms,
              remember limited settings, understand performance and support
              advertising. Google advertising services may use identifiers or
              cookies subject to Google&apos;s settings and policies.
            </p>
            <p>
              You can control cookies through your browser. Blocking essential
              storage or security technology may prevent login or other parts
              of the service from working correctly.
            </p>
          </PolicySection>

          <PolicySection id="security" number="08" title="Security">
            <p>
              We use reasonable technical and organisational measures intended
              to protect account information against unauthorised access,
              alteration, disclosure or loss. These measures include managed
              authentication, access controls and security checks.
            </p>
            <p>
              No online system is completely secure. We cannot guarantee
              absolute security, and public information should be treated as
              available to anyone. Please contact us promptly if you believe
              your account or information has been compromised.
            </p>
          </PolicySection>

          <PolicySection id="retention" number="09" title="Data retention">
            <p>
              We generally retain account and business-page information while
              your account or listing is active and for as long as reasonably
              needed to provide the service, resolve disputes, maintain
              security, comply with legal obligations and keep necessary
              records. Backup copies may remain for a limited period after
              deletion before being overwritten.
            </p>
            <p>
              Removing a listing from our service may not immediately remove
              copies previously indexed, cached or shared by third parties.
            </p>
          </PolicySection>

          <PolicySection
            id="rights"
            number="10"
            title="Your choices and rights"
          >
            <p>
              You can review and update much of your business-page information
              through your account. You may also contact us to request access,
              correction, deletion or restriction of personal data, withdraw
              consent where processing relies on consent, or raise a privacy
              concern. Other rights may apply under relevant law.
            </p>
            <p>
              We may need to verify your identity before acting on a request.
              Some information may be retained where required or permitted by
              law, for security, or to establish or defend legal claims.
            </p>
          </PolicySection>

          <PolicySection id="children" number="11" title="Children">
            <p>
              Lankan Web Directory is intended for business owners and
              authorised business representatives, not children. You must not
              create an account or submit personal information if you are under
              18 unless a parent or legal guardian has authorised and supervises
              your use where permitted by law.
            </p>
          </PolicySection>

          <PolicySection
            id="changes"
            number="12"
            title="Changes to this policy and contact"
          >
            <p>
              We may update this policy when our service, providers or legal
              obligations change. We will publish the revised version here and
              update the date at the top. Material changes may also be
              communicated through the website or by email where appropriate.
            </p>
            <p>
              For privacy questions or requests, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Privacy%20request`}
                className="break-all font-bold text-[#BF283B] underline decoration-red-200 decoration-2 underline-offset-4 hover:text-[#a32131]"
              >
                {CONTACT_EMAIL}
              </a>
              . Please describe your request and include the email associated
              with your account, but never send us your password.
            </p>
          </PolicySection>

          <div className="rounded-2xl bg-[#211b18] p-5 text-sm leading-6 text-stone-300 sm:p-6">
            <strong className="text-white">Important:</strong> This policy is
            intended to explain our current data practices in clear language.
            It does not limit any rights you have under applicable law.
          </div>
        </article>
      </div>
    </main>
  );
}
