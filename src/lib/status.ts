import type { ListingStatus } from './types';

// Listing lifecycle: sold is terminal (conversation history + reviews hang
// off it); a removed listing can be relisted.
const TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  active: ['reserved', 'sold', 'removed'],
  reserved: ['active', 'sold', 'removed'],
  sold: [],
  removed: ['active'],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: ListingStatus): ListingStatus[] {
  return TRANSITIONS[from];
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  reserved: 'Reserved',
  sold: 'Sold',
  removed: 'Removed',
};

/** Body of the system chat message inserted on a status change. */
export function statusChangeSystemMessage(status: ListingStatus, reservedHere: boolean): string {
  switch (status) {
    case 'reserved':
      return reservedHere
        ? 'Seller reserved this listing for this conversation.'
        : 'Seller marked this listing as reserved.';
    case 'sold':
      return 'Seller marked this listing as sold.';
    case 'active':
      return 'Seller relisted this card — it is available again.';
    case 'removed':
      return 'Seller removed this listing.';
  }
}
