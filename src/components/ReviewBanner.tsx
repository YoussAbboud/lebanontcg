import type { Listing } from '../lib/types';
import './reviewbanner.css';

/** Shown on a listing that isn't public yet (migration 0031). Only the
    seller, moderators and people already chatting about it can see such
    a listing, so the copy speaks to the seller. */
export function ReviewBanner({ listing, isOwner }: { listing: Listing; isOwner: boolean }) {
  if (listing.reviewState === 'approved') return null;
  const rejected = listing.reviewState === 'rejected';
  return (
    <div className={`review-banner ${rejected ? 'review-banner-no' : ''}`} role="status">
      <div className="mono-label review-banner-label">{rejected ? 'Not approved' : 'In review'}</div>
      {isOwner ? (
        rejected ? (
          <>
            {listing.reviewNote && <p className="review-banner-note">“{listing.reviewNote}”</p>}
            <p>
              A moderator turned this listing down, so only you can see it. Add photos of the
              actual card to send it back for review, or remove it.
            </p>
          </>
        ) : (
          <p>
            Only you can see this listing for now. It goes live once it&apos;s confirmed that the
            photos show a card, and we&apos;ll let you know when it does.
          </p>
        )
      ) : (
        <p>{rejected ? 'This listing was not approved.' : 'This listing is waiting for review.'}</p>
      )}
    </div>
  );
}
