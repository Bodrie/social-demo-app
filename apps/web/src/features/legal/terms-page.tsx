import { APP_NAME } from '@beso/shared';
import { Link } from 'react-router';
import { OPERATOR_NAME } from '@/lib/env';
import { ContactLine, LegalLayout, LegalList, LegalSection } from './legal-layout';

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of use"
      intro={`These are the rules for using ${APP_NAME}, a small social network run by ${OPERATOR_NAME}. By creating an account you agree to them.`}
    >
      <LegalSection title="What this is">
        <p>
          {APP_NAME} is a personal, non-commercial project that shows what a small social network
          can look like. It is offered free of charge, as it is, and it may change, pause or close
          at any time. Please do not rely on it as your only copy of anything you care about.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalList>
          <li>You must be at least 16 years old.</li>
          <li>One account per person, registered with an email address you control and confirm.</li>
          <li>
            Keep your password to yourself. Everything done with your account counts as done by you,
            so sign out everywhere (Settings) if you suspect it was used by someone else.
          </li>
          <li>Use a name and username that do not impersonate another person or organisation.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="What you may not do">
        <LegalList>
          <li>
            Post or send anything unlawful, threatening, harassing, hateful, pornographic or that
            infringes somebody else’s rights.
          </li>
          <li>Share other people’s private information without their consent.</li>
          <li>Spam, scam, spread malware, or mislead people about who you are.</li>
          <li>
            Scrape the service, run automated accounts, or try to get around its limits and
            protections.
          </li>
          <li>Interfere with the service or other members’ use of it.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          What you publish stays yours. So that the service can work, you give {OPERATOR_NAME} a
          non-exclusive, royalty-free licence to store, display and transmit your posts, pictures,
          comments and messages to the members they are meant for, for as long as they are on the
          service. You are responsible for having the right to publish what you publish.
        </p>
        <p>
          We may remove content or restrict an account that breaks these terms or the law, with or
          without notice, and we may keep what is needed to deal with a dispute or a legal
          obligation.
        </p>
      </LegalSection>

      <LegalSection title="Our content">
        <p>
          The {APP_NAME} name, logo and design belong to {OPERATOR_NAME}. The source code of the
          application is published separately under its own licence; see the project repository.
        </p>
      </LegalSection>

      <LegalSection title="No warranty, limited liability">
        <p>
          {APP_NAME} is provided as it is and as available, without any warranty of availability,
          accuracy or fitness for a particular purpose. To the extent the law allows,{' '}
          {OPERATOR_NAME} is not liable for indirect damage or for loss of data or content. Nothing
          here limits rights that consumer law grants you and that cannot be waived.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          How personal data is handled is described in the{' '}
          <Link to="/privacy" className="text-primary underline underline-offset-4">
            Privacy notice
          </Link>
          , which is part of these terms.
        </p>
      </LegalSection>

      <LegalSection title="Changes and ending">
        <p>
          We may update these terms; the date at the top shows the current version, and material
          changes are announced in the app. You can stop using {APP_NAME} at any time and ask for
          your account to be deleted. We may close accounts that break these terms.
        </p>
      </LegalSection>

      <LegalSection title="Law and contact">
        <p>
          These terms are governed by the law of the European Union member state where{' '}
          {OPERATOR_NAME} is established, without prejudice to mandatory consumer protection rules
          of the country you live in.
        </p>
        <ContactLine />
      </LegalSection>
    </LegalLayout>
  );
}
