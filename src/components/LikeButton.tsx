import { useNavigate } from 'react-router-dom';
import { setLikeCount, useLikeCount } from '../lib/likeCounts';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';

/**
 * The ♡ count IS the watch button: the number is how many people watch the
 * listing, and pressing it adds or removes you. The count moves at once
 * (optimistically) and then follows the live feed, so other people's
 * watches show up without a refresh.
 */
export function LikeButton({
  listingId,
  likes: fetched,
  className,
}: {
  listingId: string;
  likes: number;
  className: string;
}) {
  const { client, user, favoriteIds, toggleFavorite } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const watched = favoriteIds.has(listingId);
  const likes = useLikeCount(client, listingId, fetched);

  const press = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/signin');
      return;
    }
    if (user.suspendedAt) {
      toast('Your account is suspended, so you can’t watch listings.');
      return;
    }
    setLikeCount(listingId, Math.max(0, likes + (watched ? -1 : 1)));
    try {
      await toggleFavorite(listingId);
      toast(watched ? 'Removed from watchlist' : 'Added to watchlist');
    } catch (err) {
      setLikeCount(listingId, likes);
      toast(err instanceof Error ? err.message : 'Could not update your watchlist');
    }
  };

  return (
    <button
      type="button"
      aria-label={`${watched ? 'Remove from watchlist' : 'Add to watchlist'} · ${likes} watching`}
      aria-pressed={watched}
      className={`${className}${watched ? ' is-on' : ''}`}
      onClick={(e) => void press(e)}
    >
      <span aria-hidden="true">{watched ? '♥' : '♡'}</span> {likes}
    </button>
  );
}
