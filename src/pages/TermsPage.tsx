import { Link } from 'react-router-dom';
import { LegalPage, type LegalSection } from '../components/legal/LegalPage';
import { OPERATOR_NAME } from '../lib/site';
import { WARNING_LIMIT } from '../lib/types';
import { usePageMeta } from '../lib/usePageMeta';

const SECTIONS: LegalSection[] = [
  {
    id: 'what-we-are',
    title: 'What LebanonTCG is',
    body: (
      <>
        <p>
          {OPERATOR_NAME} is a venue where collectors in Lebanon list trading cards and arrange
          trades with each other. <strong>We connect collectors; you handle the deal.</strong> We
          are not a party to any sale, we do not hold cards or money, and we do not act as an
          agent, escrow, courier or guarantor for anyone.
        </p>
        <p>
          These Terms are the agreement between you and {OPERATOR_NAME} for using the website at
          lebanontcg.com (the “Service”). By creating an account or using the Service you agree to
          them and to our <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use
          the Service.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Who can use it',
    body: (
      <>
        <p>
          You must be at least 18 years old, able to enter a binding agreement, and not currently
          suspended from the Service. One account per person. The information you give us —
          starting with your email address — must be accurate, and you are responsible for
          everything done through your account, so keep your password to yourself.
        </p>
        <p>
          Usernames are claimed once and are permanent. Choose one you can live with; do not
          impersonate another person, shop or brand.
        </p>
      </>
    ),
  },
  {
    id: 'listings',
    title: 'Listing cards',
    body: (
      <>
        <p>
          A listing is a public statement about a real card you own and can hand over. When you
          list, you confirm that:
        </p>
        <ul>
          <li>you own the card, or are authorised to sell it, and have it in hand;</li>
          <li>the photos show the actual card being sold, not a stock image or someone else’s copy;</li>
          <li>
            the title, set, condition, finish and grade are honest — a graded card must be in the
            slab you describe, with the certification number the grader issued;
          </li>
          <li>the card is genuine. Counterfeits, proxies sold as genuine, and stolen goods are forbidden;</li>
          <li>the price is the price. Bait listings and listings created only to advertise something else are forbidden.</li>
        </ul>
        <p>
          A new listing, and a listing you add new photos to, goes public once its photos are
          checked: an automatic check confirms they show a trading card, and when it can&apos;t, a
          moderator looks. Until then only you can see it. We may decline a listing that isn&apos;t
          a trading card, and we tell you why.
        </p>
        <p>
          Listings are free for now; <Link to="/plans">subscription plans</Link> will follow and we
          will say so clearly before anything is charged. We may remove any listing that breaks
          these rules, misleads buyers, or is reported and found wanting, and we may keep a copy
          for moderation after it is removed.
        </p>
      </>
    ),
  },
  {
    id: 'deals',
    title: 'Deals, offers and auctions',
    body: (
      <>
        <p>
          Every deal is arranged directly between buyer and seller in chat.{' '}
          <strong>Offers and bids are not binding.</strong> Accepting an offer or winning an auction
          opens a conversation; it does not create a contract that {OPERATOR_NAME} enforces, and
          it does not move any money. You agree price, payment method, meeting point or shipping,
          and timing with the other person yourselves.
        </p>
        <p>
          Auctions run on a clock we publish on the listing. Bids must beat the current bid by the
          shown minimum; a bid in the final minute extends the clock so nobody is sniped. A seller
          may end an auction early or cancel it; a reserve that is not met means nobody wins. The
          highest bidder when the clock runs out gets a chat with the seller.
        </p>
        <p>
          Because bids are not binding, we keep account of follow-through instead: a winner who
          vanishes can be reported by the seller (and vice versa) a day after the close. Three
          winner no-shows in ninety days block an account from bidding. False reports are
          themselves a breach of these Terms.
        </p>
      </>
    ),
  },
  {
    id: 'payment',
    title: 'Payment, delivery and risk',
    body: (
      <>
        <p>
          {OPERATOR_NAME} takes no payment between users, charges no commission on trades, and has
          no ability to refund, reverse or recover money you send to another collector. Whatever
          you pay with — cash in person, Whish, a bank transfer, anything else — the arrangement
          is between you and the other person, and so is the risk.
        </p>
        <p>
          Read <Link to="/safety">Trading safely</Link> before your first deal. Meet in public,
          verify the card before money moves, use tracked shipping, keep the conversation in chat
          so there is a record, and never send payment before terms are agreed. We cannot step in
          when a deal goes wrong, but a report helps us keep the venue honest for everyone else.
        </p>
      </>
    ),
  },
  {
    id: 'plans',
    title: 'Plans and paid features',
    body: (
      <>
        <p>
          Some features are, or will be, part of a paid subscription — today the Pre-Grade
          estimator, and in future unlimited listings beyond a free allowance. Prices are shown on
          the <Link to="/plans">Plans</Link> page. We do not take card payments on the site: you
          ask for a plan, we contact you to arrange payment by Whish or crypto transfer, and we
          switch the plan on once it lands. A subscription runs for the period you paid for and
          simply lapses when it ends; it does not renew by itself and nothing is charged
          automatically.
        </p>
        <p>
          If we end a paid plan early for any reason other than a breach of these Terms, we will
          refund the unused part. Fees paid for a period you then lose through suspension for a
          breach are not refunded.
        </p>
      </>
    ),
  },
  {
    id: 'pregrade',
    title: 'Pre-Grade is an estimate, not a grade',
    body: (
      <>
        <p>
          The Pre-Grade estimator reads photographs you supply and produces an estimate of how a
          card might grade, with measured centering and a note of visible defects. It uses an
          AI model and your photos, and it is wrong sometimes.{' '}
          <strong>It is decision support, not a grade.</strong> Only a grading company can grade a
          card. {OPERATOR_NAME} is not affiliated with PSA, BGS, CGC or any other grader, and a
          Pre-Grade report is never a certification, a valuation or a promise about what any
          grader will say.
        </p>
        <p>
          Estimates may never be presented as grades: a listing cannot carry an estimated grade
          in the grade field, and a seller who passes an estimate off as a real grade breaks these
          Terms. If you choose to publish a report on your own listing, buyers see it labelled as
          an estimate.
        </p>
      </>
    ),
  },
  {
    id: 'conduct',
    title: 'Conduct',
    body: (
      <>
        <p>Do not:</p>
        <ul>
          <li>harass, threaten or deceive other collectors, or post anything unlawful;</li>
          <li>send spam, or use the chat to sell anything other than the card the thread is about;</li>
          <li>scrape, crawl, or use automated tools against the Service, or try to get around a suspension, a block or a bid ban;</li>
          <li>interfere with the Service, probe it for weaknesses, or try to access data that is not yours;</li>
          <li>post content you do not have the right to post, including other people’s photographs.</li>
        </ul>
        <p>
          Blocking another user ends your conversations with them and prevents new ones. Reports
          are read by moderators and never shown to the person reported.
        </p>
        <p>
          <strong>Your conversations are private.</strong> Moderators and administrators do not
          access or read messages between users. The one exception is a reported message: when
          someone reports a message, a moderator sees that message, and only that message, so the
          report can be handled. Reporting a person or a listing does not open anyone&apos;s
          conversations.
        </p>
      </>
    ),
  },
  {
    id: 'moderation',
    title: 'Warnings, suspension and appeals',
    body: (
      <>
        <p>
          Moderators may remove listings, withdraw reviews, cancel auctions and issue warnings,
          always with a reason that is recorded and shown to you.{' '}
          <strong>{WARNING_LIMIT} active warnings suspend an account automatically.</strong> A
          suspended account keeps its history and can still read and message about existing deals,
          but cannot list, bid, make offers or start new conversations until a moderator lifts the
          suspension. Serious breaches — counterfeits, theft, fraud, threats — may be met with
          immediate suspension without prior warnings.
        </p>
        <p>
          You can see your warnings and standing in Settings. To appeal a warning or a suspension,
          open <Link to="/support">a support ticket</Link> — a suspended account can still do that
          — and say which decision you are appealing and why. A moderator replies in the ticket.
          Every moderation action is logged.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <>
        <p>
          You keep ownership of the photos and text you post. You give {OPERATOR_NAME} a
          non-exclusive, royalty-free, worldwide licence to store, display, resize and distribute
          that content on the Service and in link previews, for as long as it is on the Service
          and for a reasonable period afterwards for moderation and record-keeping. You are
          responsible for having the rights to what you post.
        </p>
        <p>
          Card names, artwork and logos belong to their owners — Pokémon, Wizards of the Coast,
          Konami, Bandai, Disney and others. {OPERATOR_NAME} is not affiliated with or endorsed by
          any of them; their marks appear here only to identify the cards people trade.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability, warranties and liability',
    body: (
      <>
        <p>
          The Service is provided as it is and as it is available. We work to keep it up, accurate
          and safe, but we do not promise that it will be uninterrupted or error-free, that any
          listing is genuine or accurately described, that any other user will follow through, or
          that a Pre-Grade estimate is right.
        </p>
        <p>
          To the fullest extent the law allows, {OPERATOR_NAME} is not liable for any loss arising
          from a deal between users, from content posted by users, from reliance on an estimate,
          or from interruption or loss of data; and our total liability to you for anything
          arising out of the Service in any twelve-month period is limited to the amount you paid
          us for the Service in that period. Nothing in these Terms limits liability that cannot
          be limited by law.
        </p>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Ending your account',
    body: (
      <>
        <p>
          You can stop using the Service at any time and ask us to delete your account by opening{' '}
          <Link to="/support">a support ticket</Link>. We may suspend or close an
          account that breaks these Terms, or that we reasonably believe is being used for fraud or
          to harm others. Sections that by their nature should survive — your content licence for
          moderation records, liability, governing law — survive the end of the agreement.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these Terms',
    body: (
      <>
        <p>
          We may change these Terms as the Service changes. The effective date at the top moves
          when we do, and for changes that matter — fees, your rights, what we do with your data —
          we will tell you in the app or by email before they take effect. Using the Service after
          a change means you accept it.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and contact',
    body: (
      <>
        <p>
          These Terms are governed by the laws of the Republic of Lebanon, and the courts of
          Beirut have jurisdiction over any dispute arising from them, without prejudice to any
          mandatory consumer protection you enjoy where you live.
        </p>
        <p>
          Questions about these Terms: open <Link to="/support">a support ticket</Link>.
        </p>
      </>
    ),
  },
];

export function TermsPage() {
  usePageMeta({
    title: 'Terms of Service',
    description:
      'The agreement for using LebanonTCG: a venue where collectors trade cards directly, with honest listings, non-binding bids, moderation with warnings, and no payments through the site.',
    canonicalPath: '/terms',
  });
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      lede="Plain language, on purpose. This is what you agree to when you use LebanonTCG, and what we commit to in return."
      sections={SECTIONS}
      sibling={{ to: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
