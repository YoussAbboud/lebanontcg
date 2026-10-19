import { Link } from 'react-router-dom';
import { LegalPage, type LegalSection } from '../components/legal/LegalPage';
import { OPERATOR_NAME } from '../lib/site';
import { usePageMeta } from '../lib/usePageMeta';

const SECTIONS: LegalSection[] = [
  {
    id: 'who',
    title: 'Who is responsible',
    body: (
      <>
        <p>
          {OPERATOR_NAME} runs lebanontcg.com and decides how the personal data described here is
          used. For anything about your data, open{' '}
          <Link to="/support">a support ticket</Link> — a moderator reads every one. This policy
          covers the website
          and the account you hold on it; it does not cover what another collector does with
          information you share with them in a deal.
        </p>
      </>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <p>Only what the marketplace needs to work. Concretely:</p>
        <ul>
          <li>
            <strong>Account:</strong> your email address and password (stored as a hash by our
            authentication provider, never readable by us), your username, display name, avatar
            and bio, and when you joined.
          </li>
          <li>
            <strong>Listings:</strong> the cards you list — title, set, condition, price, photos,
            description — and their status over time.
          </li>
          <li>
            <strong>Activity:</strong> messages and offers in your conversations, bids, cards you
            watch, reviews you write and receive, reports you file, and the notifications we send
            you.
          </li>
          <li>
            <strong>Moderation:</strong> warnings issued to your account, with the reason, and any
            suspension. Moderator actions are logged with who did what and why.
          </li>
          <li>
            <strong>Pre-Grade:</strong> the photographs you submit to the estimator, the
            measurements and the report. These are private to you unless you publish a report on
            your own listing.
          </li>
          <li>
            <strong>Plans:</strong> which plan you asked for and the note you left about how you
            want to pay. We never see or store card numbers — payments are arranged outside the
            site.
          </li>
          <li>
            <strong>Technical:</strong> our hosting providers keep ordinary server logs (IP
            address, browser, time of request) for security and troubleshooting. While you are on
            the site, other collectors can see that you are online.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'not-collect',
    title: 'What we do not do',
    body: (
      <>
        <ul>
          <li>No advertising trackers, no analytics scripts, no third-party cookies.</li>
          <li>We do not sell, rent or trade your data, and we do not send it to anyone for marketing.</li>
          <li>We do not read private messages unless a message is reported, and then only the reported message is shown to a moderator.</li>
          <li>We do not take or store payment card details.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <>
        <ul>
          <li>To run the marketplace: show your listings, deliver your messages, run auctions, count likes, and tell you when something happens.</li>
          <li>To keep it honest: handle reports, issue warnings, suspend accounts that break the <Link to="/terms">Terms</Link>, and keep a record of moderation decisions.</li>
          <li>To produce Pre-Grade estimates from the photos you submit.</li>
          <li>To secure the service and investigate abuse.</li>
          <li>To contact you about your account, a plan you asked for, or changes to these documents. We do not send marketing email.</li>
        </ul>
        <p>
          We rely on the agreement you entered when you created an account, on our legitimate
          interest in running a safe venue, and on your consent where you choose to share something
          — a published Pre-Grade report, a review.
        </p>
      </>
    ),
  },
  {
    id: 'visibility',
    title: 'What is public and what is private',
    body: (
      <>
        <p>
          <strong>Public to anyone:</strong> your username, display name, avatar, bio, join date,
          rating, the reviews you receive, your listings and their photos, how many people watch a
          listing, whether you are online right now, and any Pre-Grade report you publish. Your
          public profile and listings can be found through search engines and appear in link
          previews when someone shares them.
        </p>
        <p>
          <strong>Private to you and the other party:</strong> conversations, offers and the
          outcome of a deal. <strong>Private to you and moderators:</strong> your warnings, your
          reports, and a message that has been reported. <strong>Private to you:</strong> your
          email, watchlist, notifications, unpublished Pre-Grade reports and plan requests.
        </p>
      </>
    ),
  },
  {
    id: 'processors',
    title: 'Who processes it for us',
    body: (
      <>
        <p>
          We use a small number of providers to run the site. Each processes data only on our
          instructions and under its own security commitments:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — the database, authentication, file storage (photos) and
            realtime messaging. Your data lives in Supabase’s data centres.
          </li>
          <li>
            <strong>Vercel</strong> — hosting for the website and the small server functions
            behind it, including request logs.
          </li>
          <li>
            <strong>Anthropic</strong> — when you run a Pre-Grade estimate, the photographs you
            submitted are sent to Anthropic’s API to produce the assessment. We send the photos
            and nothing that identifies you. Under the API terms we use, your photos are not used
            to train their models.
          </li>
        </ul>
        <p>
          These providers operate servers outside Lebanon, so your data is transferred
          internationally — principally to the United States and the European Union — and
          protected by those providers’ safeguards.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>
          For as long as you have an account, so your history, reviews and conversations keep
          working. When a listing is removed, we keep it so moderators and the people in its
          conversations can still see what was said. When you delete your account, we delete your
          profile, listings, photos, watchlist, notifications and Pre-Grade material. Reviews you
          wrote and messages you sent to others remain in their conversations without your name
          attached; moderation records (warnings, reports, the audit log) are kept for as long as
          we need them to keep the venue safe, then removed.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and storage on your device',
    body: (
      <>
        <p>
          We set no tracking cookies. Your browser keeps the token that proves you are signed in,
          plus small conveniences such as the page to return to after signing in. Clearing site
          data signs you out and forgets them. Nothing on your device is read by anyone else.
        </p>
      </>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <ul>
          <li><strong>See and correct</strong> your profile in Settings at any time.</li>
          <li><strong>Get a copy</strong> of the data we hold about you.</li>
          <li><strong>Delete</strong> your account.</li>
          <li><strong>Object</strong> to a use of your data you think is wrong, or ask us to restrict it.</li>
        </ul>
        <p>
          For any of these, open <Link to="/support">a support ticket</Link> under “My data”. We
          answer within thirty days. If you are unhappy with our answer you may complain to the data protection
          authority where you live.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <>
        <p>
          Everything travels over TLS. Passwords are hashed, never stored. Every table in our
          database enforces row-level access rules, so a request can only ever read or change what
          its owner is allowed to; moderator actions require a moderator account and are logged.
          The site sends strict browser security headers. No system is perfectly secure, and if a
          breach ever affects your data we will tell you.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Age',
    body: (
      <>
        <p>
          The Service is for adults. We do not knowingly collect data from anyone under 18; if we
          learn that we have, we delete the account.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: (
      <>
        <p>
          When this policy changes in substance we update the effective date at the top and tell
          you in the app or by email first. Questions, requests and complaints: open{' '}
          <Link to="/support">a support ticket</Link>.
        </p>
      </>
    ),
  },
];

export function PrivacyPage() {
  usePageMeta({
    title: 'Privacy Policy',
    description:
      'What LebanonTCG collects, why, who processes it, what is public, how long it is kept, and your rights. No trackers, no data sales, no card details.',
    canonicalPath: '/privacy',
  });
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      lede="What we collect, what we do with it, and what we never do. Written to be read, not skimmed past."
      sections={SECTIONS}
      sibling={{ to: '/terms', label: 'Terms of Service' }}
    />
  );
}
