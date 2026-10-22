import { APP_NAME } from '@beso/shared';
import { Link } from 'react-router';
import { OPERATOR_NAME } from '@/lib/env';
import { ContactLine, LegalLayout, LegalList, LegalSection } from './legal-layout';

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy notice"
      intro={`${APP_NAME} is a small social network run by ${OPERATOR_NAME} as a personal project. This notice explains what personal data it processes, why, for how long, and what you can do about it.`}
    >
      <LegalSection title="Who is responsible">
        <p>
          The controller of your data is {OPERATOR_NAME}, who hosts {APP_NAME} on a server in the
          European Union.
        </p>
        <ContactLine />
      </LegalSection>

      <LegalSection title="What we collect">
        <LegalList>
          <li>
            <strong>Account data:</strong> your email address, the name and username you choose, and
            a hashed form of your password (the password itself is never stored). When you register
            we also record when your email address was confirmed.
          </li>
          <li>
            <strong>Profile data you add:</strong> a short bio, a city, a website, a profile picture
            and a cover picture. All of it is optional and visible to other members.
          </li>
          <li>
            <strong>What you publish:</strong> posts, pictures, comments, reactions, likes, who you
            follow, and messages you send in direct and group conversations, including pictures sent
            there. Edits keep the previous versions so that members can see what changed.
          </li>
          <li>
            <strong>Settings and what follows from your activity:</strong> your preferences (such as
            notifications and chat options), the time zone your device reports (used for the badges
            tied to the time of day; you can change it in Settings), the badges you earned, whose
            invite you joined with, and, for each device where you switch on push notifications, the
            address its push service gave it.
          </li>
          <li>
            <strong>Technical data:</strong> the IP address and browser identification of each
            sign-in session (kept with the session so that unusual activity can be noticed), and
            short-lived server logs that record requests, errors and, when something goes wrong,
            enough context to fix it.
          </li>
        </LegalList>
        <p>
          We do not collect anything else, and we do not buy or combine data from other sources.
        </p>
      </LegalSection>

      <LegalSection title="Why we process it">
        <LegalList>
          <li>
            <strong>To provide the service you signed up for</strong> (performance of a contract):
            showing your profile and posts to other members, delivering messages, telling you who is
            online, sending the email that confirms your address or lets you reset your password.
          </li>
          <li>
            <strong>To keep the service safe</strong> (legitimate interest): limiting abusive
            traffic, detecting stolen sessions, investigating reports.
          </li>
        </LegalList>
        <p>
          We do not profile you, we show no advertising, and we do not sell or rent your data to
          anyone.
        </p>
      </LegalSection>

      <LegalSection title="Who else sees it">
        <LegalList>
          <li>
            <strong>Other members</strong> see your public profile, your posts and comments, your
            reactions and follows, your badges (unless you hide them in Settings) and whether you
            are online. Messages are visible only to the members of that conversation.
          </li>
          <li>
            <strong>Cloudflare</strong> sits in front of the server: it terminates the encrypted
            connection and protects against attacks, so it sees your IP address and the requests you
            make, under its own privacy terms.
          </li>
          <li>
            <strong>Resend</strong> delivers our email: it receives your email address, your name
            and the content of the confirmation and password reset messages we send you.
          </li>
          <li>
            <strong>Your browser's push service</strong> (Google for Chrome and most other browsers,
            Mozilla for Firefox, Apple for Safari, Microsoft for Edge) delivers push notifications,
            only if you switch them on for a device. The notification's content is encrypted for
            your browser alone, so the push service cannot read it; it sees that a notification is
            on its way to your device.
          </li>
        </LegalList>
        <p>
          Nobody else receives your data unless the law requires it. We do not transfer your data
          outside the European Union ourselves; Cloudflare, Resend and the push services operate
          globally under their own EU data transfer arrangements.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          {APP_NAME} uses two cookies, both strictly necessary: one carries your session for a few
          minutes, the other lets the app renew that session for up to seven days. They cannot be
          read by scripts and are never used for tracking. Your light or dark theme preference is
          kept in your browser's local storage, and so is which account switched on push
          notifications in that browser (so nobody else signing in there receives them). There are
          no analytics or advertising cookies, so there is no cookie banner.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <LegalList>
          <li>Your account and everything you published: until you delete it or ask us to.</li>
          <li>Sessions: at most seven days of inactivity, or until you sign out.</li>
          <li>
            Links we mail you: 24 hours (confirming your address) or one hour (resetting your
            password), and they work once.
          </li>
          <li>Server logs: a few days.</li>
          <li>Backups: 14 days, after which deleted data is gone from them too.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          Under the GDPR you can ask what we hold about you, have it corrected, have it deleted,
          receive a copy in a machine-readable form, and object to processing based on our
          legitimate interest. You can change your profile, email and password yourself in{' '}
          <Link to="/settings" className="text-primary underline underline-offset-4">
            Settings
          </Link>
          . Under <strong>Your account</strong> there you can download a copy of everything your
          account holds as a JSON file and delete the account yourself; deletion is immediate and
          removes your posts, comments, messages and pictures (backups follow within 14 days). You
          also have the right to complain to the data protection authority of the country you live
          in.
        </p>
        <ContactLine />
      </LegalSection>

      <LegalSection title="Children">
        <p>
          {APP_NAME} is not meant for children. You must be at least 16 years old to create an
          account.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Connections are encrypted, passwords are stored only as salted hashes, uploaded pictures
          are re-encoded so that nothing but pixels is kept, and sessions are bound to cookies that
          scripts cannot read. No system is perfect; if we learn of a breach that affects you, we
          will tell you.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          When this notice changes, the date at the top changes with it. Material changes will also
          be announced inside the app before they take effect.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
