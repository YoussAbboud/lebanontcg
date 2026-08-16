import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ConversationSummary, Message } from '../lib/types';
import { MESSAGE_MAX_LENGTH } from '../lib/types';
import { groupMessages } from '../lib/chat';
import { formatPrice, relativeTime, timeOfDay } from '../lib/format';
import { STATUS_LABELS } from '../lib/status';
import { glyphOf, thumbBackground } from '../lib/face';
import { useApp } from '../state/AppContext';
import { useToast } from '../state/ToastContext';
import { ReviewPrompt } from '../components/ReviewPrompt';
import { ReportDialog } from '../components/ReportDialog';
import './chat.css';

let clientIdCounter = 0;
const nextClientId = () => `cid-${Date.now()}-${++clientIdCounter}`;

type InboxFilter = 'all' | 'buying' | 'selling' | 'unread';

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { client, user, refreshUnread } = useApp();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');

  const loadList = useCallback(async () => {
    try {
      setConversations(await client.listConversations());
      setListError(false);
    } catch {
      setListError(true);
    }
  }, [client]);

  useEffect(() => {
    if (!user) return;
    void loadList();
    return client.subscribeToInbox(() => void loadList());
  }, [client, user, loadList]);

  if (!user) {
    return (
      <main className="chat-gate">
        <div className="empty-dashed">
          <h3>Messages</h3>
          <p>Sign in to negotiate deals with other collectors.</p>
          <Link to="/signin" className="btn-acid">Sign in</Link>
        </div>
      </main>
    );
  }

  const filtered = (conversations ?? []).filter((c) => {
    switch (inboxFilter) {
      case 'buying':
        return c.buyerId === user.id;
      case 'selling':
        return c.sellerId === user.id;
      case 'unread':
        return c.unreadCount > 0;
      default:
        return true;
    }
  });

  const FILTERS: Array<{ key: InboxFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'buying', label: 'Buying' },
    { key: 'selling', label: 'Selling' },
    { key: 'unread', label: 'Unread' },
  ];

  return (
    <main className={`chat ${conversationId ? 'chat-thread-open' : ''}`}>
      <aside aria-label="Inbox" className="chat-inbox">
        <h1 className="display chat-inbox-title">Messages</h1>
        <div className="chat-inbox-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="pill chat-filter"
              aria-pressed={inboxFilter === f.key}
              onClick={() => setInboxFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {conversations === null && !listError && (
          <div className="chat-inbox-skeletons" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 72 }} />
            ))}
          </div>
        )}
        {listError && (
          <div className="chat-inbox-error">
            <p>Couldn&apos;t load conversations.</p>
            <button className="btn-outline" onClick={() => void loadList()}>Retry</button>
          </div>
        )}
        {conversations !== null && filtered.length === 0 && !listError && (
          <div className="chat-inbox-empty">
            <p className="mono-label">
              {inboxFilter === 'all' ? 'No conversations yet' : `Nothing under ${inboxFilter}`}
            </p>
            <p>
              Find a card and hit “Message seller” — every deal starts and ends here.
            </p>
            <Link to="/browse" className="btn-acid">Browse cards</Link>
          </div>
        )}

        <div className="chat-rows">
          {filtered.map((c) => {
            const preview = c.lastMessage
              ? c.lastMessage.kind === 'system'
                ? c.lastMessage.body
                : c.lastMessage.kind === 'offer'
                  ? `${c.lastMessage.senderId === user.id ? 'You offered' : 'Offered'} ${formatPrice(c.lastMessage.amount ?? 0, c.listing.currency)}`
                  : `${c.lastMessage.senderId === user.id ? 'You: ' : ''}${c.lastMessage.body}`
              : 'No messages yet';
            const cover = c.listing.images[0];
            return (
              <Link
                key={c.id}
                to={`/chat/${c.id}`}
                className={`chat-row ${c.id === conversationId ? 'chat-row-on' : ''}`}
                aria-current={c.id === conversationId ? 'page' : undefined}
              >
                <div
                  className="chat-row-thumb"
                  style={
                    cover
                      ? { backgroundImage: `url(${cover.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: thumbBackground(c.listing.id) }
                  }
                  aria-hidden="true"
                >
                  {!cover && glyphOf(c.listing.title)}
                </div>
                <div className="chat-row-main">
                  <div className="chat-row-top">
                    <span className="chat-row-handle">
                      @{c.otherParty.username ?? c.otherParty.displayName}
                    </span>
                    <span className="mono-value chat-row-time">{relativeTime(c.lastMessageAt)}</span>
                    {c.unreadCount > 0 && <span className="chat-row-unread" aria-label={`${c.unreadCount} unread`} />}
                  </div>
                  <div className="chat-row-snippet">{preview}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </aside>

      {conversationId ? (
        <Thread key={conversationId} conversationId={conversationId} onAnyChange={refreshUnread} />
      ) : (
        <section aria-label="No conversation selected" className="chat-placeholder">
          <p className="mono-label">Pick a conversation</p>
          <p>Offers, photos and the deal itself all live in the thread.</p>
        </section>
      )}
    </main>
  );
}

function Thread({ conversationId, onAnyChange }: { conversationId: string; onAnyChange(): void }) {
  const { client, user, refreshPendingReviews } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [conv, setConv] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [draft, setDraft] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [typing, setTyping] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [reviewState, setReviewState] = useState<
    'none' | 'pending' | 'done' | 'awaiting_buyer' | 'buyer_rated'
  >('none');
  const [blockedOther, setBlockedOther] = useState(false);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const typingTimer = useRef<number | null>(null);
  const lastTypingSent = useRef(0);
  const meId = user?.id ?? '';

  const scrollLog = useCallback((smooth = false) => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    atBottomRef.current = true;
    setNewBelow(false);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setState('loading');
    Promise.all([client.getConversation(conversationId), client.getMessages(conversationId)])
      .then(([c, msgs]) => {
        if (cancelled) return;
        if (!c) {
          setState('missing');
          return;
        }
        setConv(c);
        setMessages(msgs);
        setState('ready');
        void client.markConversationRead(conversationId);
        requestAnimationFrame(() => scrollLog());
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client, conversationId, scrollLog]);

  // Live events
  useEffect(() => {
    return client.subscribeToConversation(conversationId, (ev) => {
      if (ev.type === 'message' && ev.message) {
        const incoming = ev.message;
        setTyping(false);
        setMessages((prev) => {
          const byClient = incoming.clientId
            ? prev.findIndex((m) => m.clientId && m.clientId === incoming.clientId)
            : -1;
          if (byClient >= 0) {
            const next = [...prev];
            next[byClient] = incoming;
            return next;
          }
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        if (incoming.senderId !== meId) {
          if (atBottomRef.current) {
            if (document.hasFocus()) void client.markConversationRead(conversationId);
          } else {
            setNewBelow(true);
          }
        }
        requestAnimationFrame(() => {
          if (atBottomRef.current) scrollLog(true);
        });
      } else if (ev.type === 'refresh') {
        void client.getMessages(conversationId).then(setMessages);
      } else if (ev.type === 'listing_updated' && ev.listing) {
        const updated = ev.listing;
        setConv((prev) => (prev ? { ...prev, listing: { ...prev.listing, ...updated } } : prev));
      } else if (ev.type === 'typing') {
        setTyping(true);
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => setTyping(false), 3000);
      }
      onAnyChange();
    });
  }, [client, conversationId, meId, onAnyChange, scrollLog]);

  // Review state once sold. Reviews run buyer → seller: the buyer gets the
  // prompt, the seller gets the buyer's verdict. "You reviewed this trade"
  // is only ever shown off a review that actually exists — never inferred
  // from an empty pending list, which is also the seller's normal state.
  const listingStatus = conv?.listing.status;
  const isBuyerHere = Boolean(conv && meId && conv.buyerId === meId);
  useEffect(() => {
    if (listingStatus !== 'sold' || !meId) {
      setReviewState('none');
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (isBuyerHere) {
        const [pending, written] = await Promise.all([
          client.getPendingReviews().catch(() => []),
          client.getReviewsWritten().catch(() => []),
        ]);
        if (cancelled) return;
        if (written.some((r) => r.conversationId === conversationId)) setReviewState('done');
        else if (pending.some((p) => p.conversationId === conversationId)) setReviewState('pending');
        else setReviewState('none');
      } else {
        const mine = await client.getReviewsForUser(meId).catch(() => []);
        if (cancelled) return;
        setReviewState(
          mine.some((r) => r.conversationId === conversationId) ? 'buyer_rated' : 'awaiting_buyer',
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [client, conversationId, listingStatus, isBuyerHere, meId]);

  // Block state
  const otherPartyId = conv?.otherParty.id;
  useEffect(() => {
    if (!otherPartyId) return;
    let cancelled = false;
    client.getBlockedIds().then((ids) => {
      if (!cancelled) setBlockedOther(ids.has(otherPartyId));
    });
    return () => {
      cancelled = true;
    };
  }, [client, otherPartyId]);

  useEffect(() => {
    const onFocus = () => {
      if (atBottomRef.current) {
        void client.markConversationRead(conversationId);
        setNewBelow(false);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [client, conversationId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !conv || body.length > MESSAGE_MAX_LENGTH) return;
    setDraft('');
    const clientId = nextClientId();
    const optimistic: Message = {
      id: clientId,
      conversationId,
      senderId: meId,
      kind: 'user',
      body,
      amount: null,
      offerStatus: null,
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
      clientId,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollLog(true));
    try {
      const real = await client.sendMessage(conversationId, body, clientId);
      setMessages((prev) => prev.map((m) => (m.clientId === clientId && m.pending ? { ...real } : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      setDraft(body);
      toast(err instanceof Error ? err.message : 'Message failed to send');
    }
  };

  const sendOffer = async () => {
    const amount = Number(offerAmount);
    if (!conv || !Number.isFinite(amount) || amount <= 0) {
      toast('Enter an offer amount');
      return;
    }
    const note = offerNote.trim();
    setOfferOpen(false);
    setOfferAmount('');
    setOfferNote('');
    const clientId = nextClientId();
    const optimistic: Message = {
      id: clientId,
      conversationId,
      senderId: meId,
      kind: 'offer',
      body: note,
      amount,
      offerStatus: 'proposed',
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
      clientId,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollLog(true));
    try {
      const real = await client.sendOffer(conversationId, amount, note, clientId);
      setMessages((prev) => prev.map((m) => (m.clientId === clientId && m.pending ? { ...real } : m)));
      toast('Offer sent');
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      toast(err instanceof Error ? err.message : 'Offer failed to send');
    }
  };

  const respond = async (m: Message, accept: boolean) => {
    try {
      await client.respondToOffer(conversationId, m.id, accept);
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, offerStatus: accept ? 'accepted' : 'declined' } : x)),
      );
      toast(accept ? 'Offer accepted' : 'Offer declined');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update the offer');
    }
  };

  const confirmDeal = async () => {
    if (!conv) return;
    setStatusBusy(true);
    try {
      await client.setListingStatus(conv.listing.id, 'sold', {
        reservedForConversationId: null,
      });
      toast('Deal confirmed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not confirm the deal');
    } finally {
      setStatusBusy(false);
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      client.sendTyping(conversationId);
    }
  };

  const sections = useMemo(() => groupMessages(messages), [messages]);
  const lastReadOwnId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId === meId && m.kind !== 'system' && m.readAt) return m.id;
    }
    return null;
  }, [messages, meId]);

  if (state === 'loading') {
    return (
      <section className="chat-thread" aria-busy="true">
        <div className="skeleton" style={{ height: 72, margin: 16 }} />
        <div className="skeleton" style={{ height: 200, margin: 16 }} />
      </section>
    );
  }

  if (state === 'missing' || state === 'error' || !conv) {
    return (
      <section className="chat-thread">
        <div className="empty-dashed" style={{ margin: 24 }}>
          <h3>{state === 'missing' ? 'Conversation not found' : 'Couldn’t load this thread'}</h3>
          <p>It may have been removed, or something went wrong.</p>
          <button className="btn-acid" onClick={() => navigate('/chat')}>Back to messages</button>
        </div>
      </section>
    );
  }

  const listing = conv.listing;
  const isSeller = conv.sellerId === meId;
  const composerDisabled = listing.status === 'removed' || blockedOther;
  const cover = listing.images[0];

  return (
    <section aria-label={`Conversation with ${conv.otherParty.displayName}`} className="chat-thread">
      <div className="chat-thread-head">
        <Link to="/chat" className="chat-back btn-icon" aria-label="Back to conversations">←</Link>
        <div
          className="chat-thread-thumb"
          style={
            cover
              ? { backgroundImage: `url(${cover.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: thumbBackground(listing.id) }
          }
          aria-hidden="true"
        >
          {!cover && glyphOf(listing.title)}
        </div>
        <div className="chat-thread-titles">
          <div className="display chat-thread-title">{listing.title}</div>
          <div className="chat-thread-sub mono-label">
            <span>Asking {formatPrice(listing.price, listing.currency)}</span>
            <span
              className={
                listing.status === 'active'
                  ? 'chat-status-active'
                  : listing.status === 'reserved'
                    ? 'chat-status-reserved'
                    : 'chat-status-muted'
              }
            >
              {STATUS_LABELS[listing.status]}
              {listing.status === 'reserved' &&
                listing.reservedForConversationId === conversationId &&
                ' · for you'}
            </span>
          </div>
        </div>
        <div className="chat-thread-actions">
          {isSeller && (listing.status === 'active' || listing.status === 'reserved') && (
            <>
              {listing.status === 'active' ? (
                <button
                  type="button"
                  className="btn-outline chat-head-btn"
                  disabled={statusBusy}
                  onClick={() =>
                    void client
                      .setListingStatus(listing.id, 'reserved', {
                        reservedForConversationId: conversationId,
                      })
                      .then(() => toast('Reserved for this chat'))
                      .catch((err: unknown) =>
                        toast(err instanceof Error ? err.message : 'Failed'),
                      )
                  }
                >
                  Reserve
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-outline chat-head-btn"
                  disabled={statusBusy}
                  onClick={() =>
                    void client
                      .setListingStatus(listing.id, 'active')
                      .then(() => toast('Unreserved'))
                      .catch((err: unknown) =>
                        toast(err instanceof Error ? err.message : 'Failed'),
                      )
                  }
                >
                  Unreserve
                </button>
              )}
              <button
                type="button"
                className="btn-acid chat-head-btn"
                disabled={statusBusy}
                onClick={() => void confirmDeal()}
              >
                We completed this deal
              </button>
            </>
          )}
          {isSeller && listing.status === 'sold' && (
            <span className="pill pill-on chat-head-btn chat-deal-done">Deal confirmed</span>
          )}
          <button
            type="button"
            className="btn-outline chat-head-btn"
            onClick={() => navigate(`/listing/${listing.id}`)}
          >
            View listing
          </button>
        </div>
      </div>

      <div
        role="log"
        aria-live="polite"
        className="chat-log"
        ref={logRef}
        onScroll={() => {
          const el = logRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          atBottomRef.current = atBottom;
          if (atBottom && newBelow) {
            setNewBelow(false);
            void client.markConversationRead(conversationId);
          }
        }}
      >
        {sections.length === 0 && (
          <div className="chat-log-empty">
            <p>
              Say hello — ask about condition, make an offer with the <strong>$</strong> button,
              agree the deal here.
            </p>
          </div>
        )}
        {sections.map((section) => (
          <div key={section.dayKey} className="chat-day">
            <div className="chat-day-divider mono-label" role="separator" aria-label={section.dayLabel}>
              {section.dayLabel}
            </div>
            {section.clusters.map((cluster, ci) => {
              if (cluster.kind === 'system') {
                return (
                  <div key={ci} className="chat-system">
                    {cluster.messages.map((m) => (
                      <div key={m.id} className="chat-system-pill mono-label">{m.body}</div>
                    ))}
                  </div>
                );
              }
              const mine = cluster.senderId === meId;
              if (cluster.kind === 'offer') {
                const m = cluster.messages[0];
                const pending = m.offerStatus === 'proposed' && !mine;
                return (
                  <div key={m.id} className={`chat-msgrow ${mine ? 'chat-msgrow-mine' : ''}`}>
                    <div className={`chat-bubble chat-bubble-offer ${m.pending ? 'chat-bubble-pending' : ''}`}>
                      <div className="mono-label chat-offer-label">Offer · non-binding</div>
                      <div className="display chat-offer-amount">
                        {formatPrice(m.amount ?? 0, listing.currency)}
                      </div>
                      {m.body && <div className="chat-offer-note">{m.body}</div>}
                      {pending && (
                        <div className="chat-offer-actions">
                          <button type="button" className="btn-acid chat-offer-btn" onClick={() => void respond(m, true)}>
                            Accept
                          </button>
                          <button
                            type="button"
                            className="btn-outline btn-danger-outline chat-offer-btn"
                            onClick={() => void respond(m, false)}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {m.offerStatus !== 'proposed' && (
                        <div className="mono-label chat-offer-state">
                          {m.offerStatus === 'accepted' ? 'Offer accepted' : 'Offer declined'}
                        </div>
                      )}
                      <div className="mono-value chat-msg-meta">
                        {m.pending ? 'Sending…' : timeOfDay(m.createdAt)}
                        {m.id === lastReadOwnId && <span className="chat-seen"> · Seen</span>}
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={ci} className={`chat-msgrow ${mine ? 'chat-msgrow-mine' : ''}`}>
                  <div className="chat-cluster">
                    {cluster.messages.map((m, mi) => (
                      <div
                        key={m.id}
                        className={`chat-bubble ${mine ? 'chat-bubble-mine' : ''} ${m.pending ? 'chat-bubble-pending' : ''}`}
                      >
                        {!mine && (
                          <button
                            type="button"
                            className="chat-msg-report"
                            aria-label="Report this message"
                            onClick={() => setReportMessage(m)}
                          >
                            ⚑
                          </button>
                        )}
                        <div className="chat-msg-body">{m.body}</div>
                        {mi === cluster.messages.length - 1 && (
                          <div className="mono-value chat-msg-meta">
                            {m.pending ? 'Sending…' : timeOfDay(m.createdAt)}
                            {m.id === lastReadOwnId && <span className="chat-seen"> · Seen</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {typing && (
          <div className="mono-label chat-typing">
            @{conv.otherParty.username ?? conv.otherParty.displayName} is typing…
          </div>
        )}

        {reviewState === 'pending' && (
          <ReviewPrompt
            conversationId={conversationId}
            otherParty={conv.otherParty}
            onDone={() => {
              setReviewState('done');
              refreshPendingReviews();
            }}
          />
        )}
        {reviewState === 'done' && (
          <div className="chat-system">
            <div className="chat-system-pill mono-label">You reviewed this trade</div>
          </div>
        )}
        {reviewState === 'awaiting_buyer' && (
          <div className="chat-system">
            <div className="chat-system-pill mono-label">
              Deal confirmed · @{conv.otherParty.username ?? conv.otherParty.displayName} can now
              rate this trade
            </div>
          </div>
        )}
        {reviewState === 'buyer_rated' && (
          <div className="chat-system">
            <div className="chat-system-pill mono-label">
              @{conv.otherParty.username ?? conv.otherParty.displayName} rated this trade
            </div>
          </div>
        )}
      </div>

      {newBelow && (
        <button type="button" className="chat-newpill btn-acid" onClick={() => scrollLog(true)}>
          ↓ New messages
        </button>
      )}

      <div className="chat-composer">
        {blockedOther && (
          <div className="chat-blocked mono-label">
            You blocked @{conv.otherParty.username ?? conv.otherParty.displayName}.{' '}
            <button
              type="button"
              className="chat-unblock"
              onClick={async () => {
                await client.setBlocked(conv.otherParty.id, false);
                setBlockedOther(false);
                toast('Unblocked');
              }}
            >
              Unblock
            </button>
          </div>
        )}
        {offerOpen && !composerDisabled && (
          <div className="chat-offerbar">
            <span className="mono-label chat-offerbar-label">Offer</span>
            <input
              type="number"
              aria-label="Offer amount"
              placeholder="240.00"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="input input-mono chat-offer-amount-input"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
            />
            <input
              type="text"
              aria-label="Offer note"
              placeholder="Optional note"
              className="input chat-offer-note-input"
              value={offerNote}
              maxLength={200}
              onChange={(e) => setOfferNote(e.target.value)}
            />
            <button type="button" className="btn-acid" onClick={() => void sendOffer()}>
              Send offer
            </button>
          </div>
        )}
        <div className="chat-composer-row">
          <button
            type="button"
            aria-label="Make an offer"
            aria-pressed={offerOpen}
            className={`btn-icon chat-offer-toggle ${offerOpen ? 'icon-on' : ''}`}
            disabled={composerDisabled}
            onClick={() => setOfferOpen((v) => !v)}
          >
            $
          </button>
          <input
            type="text"
            aria-label="Message"
            placeholder={
              blockedOther
                ? 'You blocked this user'
                : listing.status === 'removed'
                  ? 'This listing was removed'
                  : 'Write a message'
            }
            className="input-round chat-input"
            value={draft}
            disabled={composerDisabled}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className="btn-acid chat-send"
            disabled={!draft.trim() || composerDisabled}
            onClick={() => void send()}
          >
            Send
          </button>
        </div>
        <div className="chat-safety">
          Never send payment before you&apos;ve agreed terms.{' '}
          <Link to="/safety">How to trade safely</Link>
        </div>
      </div>

      {reportMessage && (
        <ReportDialog
          targetType="message"
          targetId={reportMessage.id}
          targetLabel={`"${reportMessage.body.slice(0, 60)}${reportMessage.body.length > 60 ? '…' : ''}"`}
          onClose={() => setReportMessage(null)}
        />
      )}
    </section>
  );
}
