import type { Listing, ListingWithSeller, Profile } from './types';
import { CONDITION_LABELS, GAME_LABELS } from './types';
import { DEFAULT_OG_IMAGE, SITE_URL } from './site';
import type { PageMeta } from './usePageMeta';

/** Schema.org condition for a card's grade of wear. */
function schemaCondition(l: Listing): string {
  return l.condition === 'DMG'
    ? 'https://schema.org/DamagedCondition'
    : 'https://schema.org/UsedCondition';
}

function availability(l: Listing): string {
  if (l.status === 'sold') return 'https://schema.org/SoldOut';
  if (l.status === 'removed') return 'https://schema.org/Discontinued';
  return 'https://schema.org/InStock';
}

/** Head + Product structured data for a listing page. Data-driven, so
    while the listing is loading it falls back to a neutral title. */
export function listingMeta(listing: ListingWithSeller | null, id: string | undefined): PageMeta {
  if (!listing) {
    return { title: 'Card listing', canonicalPath: id ? `/listing/${id}` : undefined };
  }
  const graded = listing.gradeCompany && listing.gradeValue
    ? `${listing.gradeCompany} ${listing.gradeValue}`
    : CONDITION_LABELS[listing.condition];
  const price = `${listing.currency === 'USD' ? '$' : `${listing.currency} `}${listing.price}`;
  const sellerName = listing.seller?.displayName ?? 'a collector';
  const lead = listing.saleType === 'auction' ? `Live auction, current bid ${price}` : price;
  const description =
    `${listing.title} — ${GAME_LABELS[listing.game]}, ${graded}. ${lead}, listed by ${sellerName} on LebanonTCG.` +
    (listing.description ? ` ${listing.description.slice(0, 120)}` : '');
  const image = listing.images[0]?.url ?? DEFAULT_OG_IMAGE;
  const url = `${SITE_URL}/listing/${listing.id}`;
  return {
    title: `${listing.title} — ${price}`,
    description,
    canonicalPath: `/listing/${listing.id}`,
    image,
    type: 'product',
    noindex: listing.status === 'removed',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      image: listing.images.map((i) => i.url),
      description: listing.description || description,
      category: GAME_LABELS[listing.game],
      itemCondition: schemaCondition(listing),
      url,
      offers: {
        '@type': 'Offer',
        url,
        price: listing.price,
        priceCurrency: listing.currency,
        availability: availability(listing),
        itemCondition: schemaCondition(listing),
        seller: listing.seller
          ? {
              '@type': 'Person',
              name: listing.seller.displayName,
              url: listing.seller.username ? `${SITE_URL}/u/${listing.seller.username}` : undefined,
            }
          : undefined,
      },
    },
  };
}

/** Head + Person structured data for a public profile. */
export function profileMeta(profile: Profile | null, username: string | undefined): PageMeta {
  if (!profile) {
    return { title: username ? `@${username}` : 'Collector', canonicalPath: username ? `/u/${username}` : undefined };
  }
  const handle = profile.username ? `@${profile.username}` : profile.displayName;
  const rating =
    profile.ratingCount > 0 && profile.ratingAvg !== null
      ? ` Rated ${profile.ratingAvg.toFixed(1)}/5 from ${profile.ratingCount} review${profile.ratingCount === 1 ? '' : 's'}.`
      : '';
  const description =
    `${profile.displayName} (${handle}) on LebanonTCG.${rating}` +
    (profile.bio ? ` ${profile.bio.slice(0, 140)}` : '');
  const path = `/u/${profile.username ?? ''}`;
  return {
    title: `${profile.displayName} (${handle})`,
    description,
    canonicalPath: path,
    image: profile.avatarUrl && profile.avatarUrl.startsWith('http') ? profile.avatarUrl : DEFAULT_OG_IMAGE,
    type: 'profile',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: profile.displayName,
      alternateName: profile.username ?? undefined,
      description: profile.bio || undefined,
      url: `${SITE_URL}${path}`,
    },
  };
}
