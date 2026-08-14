import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ConversationSummary, ListingStatus, Message } from '../lib/types';
import { MESSAGE_MAX_LENGTH } from '../lib/types';
import { groupMessages } from '../lib/chat';
import { formatPrice, relativeTime, timeOfDay } from '../lib/format';
import { STATUS_LABELS } from '../lib/status';
import { useApp } from '../state/AppContext';
import { Avatar } from '../components/Avatar';
import './chat.css';

let clientIdCounter = 0;
const nextClientId = () => `cid-${Date.now()}-${++clientIdCounter}`;

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { client, user, refreshUnread } = useApp();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [listError, setListError] = useState(false);

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
      <div className="empty-state">
        <div className="empty-glyph" aria-hidden="true" />
        <h3 className="display">Chat</h3>
        <p>Sign in to message sellers and negotiate trades.</p>
        <Link to="/signin" className="btn btn-primary">Sign in</Link>
      </div>
    );
  }

  return (
    <div className={`chat ${conversationId ? 'chat-thread-open' : ''}`}>
      <aside className="chat-list panel" aria-label="Conversations">
        <h1 className="chat-list-title microlabel">Conversations</h1>
        {conversations === null && !listError && (
          <div className="chat-list-skeletons" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 72 }} />
            ))}
          </div>
        )}
        {listError && (
          <div className="chat-list-error">
            <p>Couldn&apos;t load conversations.</p>
            <button className="btn btn-quiet btn-sm" onClick={() => void loadList()}>Retry</button>
          </div>
        )}
        {conversations?.length === 0 && (
          <div className="chat-list-empty">
            <p>No conversations yet.</p>
            <p className="chat-list-empty-hint">
              Find a card you want and hit “Message seller” — the deal happens here.
            </p>
            <Link to="/" className="btn btn-primary btn-sm">Browse cards</Link>
          </div>
        )}
        <ul className="chat-rows">
          {conversations?.map((c) => (
            <ConversationRow key={c.id} conv={c} active={c.id === conversationId} meId={user.id} />
          ))}
        </ul>
      </aside>

      {conversationId ? (
        <Thread key={conversationId} conversationId={conversationId} onAnyChange={refreshUnread} />
      ) : (
        <section className="chat-placeholder panel" aria-label="No conversation selected">
          <div className="empty-glyph" aria-hidden="true" />
          <p>Pick a conversation to keep negotiating.</p>
        </section>
      )}
    </div>
  );
}

function ConversationRow({
  conv,
  active,
  meId,
}: {
  conv: ConversationSummary;
  active: boolean;
  meId: string;
}) {
  const preview = conv.lastMessage
    ? conv.lastMessage.kind === 'system'
      ? conv.lastMessage.body
      : `${conv.lastMessage.senderId === meId ? 'You: ' : ''}${conv.lastMessage.body}`
    : 'No messages yet';
  return (
    <li>
      <Link
        to={`/chat/${conv.id}`}
        className={`chat-row ${active ? 'chat-row-active' : ''} ${conv.unreadCount > 0 ? 'chat-row-unread' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <Avatar profile={conv.otherParty} size={40} />
        <span className="chat-row-main">
          <span className="chat-row-top">
            <strong>{conv.otherParty.displayName}</strong>
            <time className="chat-row-time">{relativeTime(conv.lastMessageAt)}</time>
          </span>
          <span className="chat-row-preview">{preview}</span>
          <span className="chat-row-listing">
            {conv.listing.images[0] && <img src={conv.listing.images[0].url} alt="" loading="lazy" />}
            <span className="chat-row-listing-title">{conv.listing.title}</span>
            <span className="price">{formatPrice(conv.listing.price, conv.listing.currency)}</span>
          </span>
        </span>
        {conv.unreadCount > 0 && (
          <span className="chat-row-badge" aria-label={`${conv.unreadCount} unread`}>
            {conv.unreadCount}
          </span>
        )}
      </Link>
    </li>
  );
}

function Thread({
  conversationId,
  onAnyChange,
}: {
  conversationId: string;
  onAnyChange(): void;
}) {
  const { client, user } = useApp();
  const navigate = useNavigate();
  const [conv, setConv] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const meId = user?.id ?? '';

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
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
        requestAnimationFrame(() => scrollToBottom());
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client, conversationId, scrollToBottom]);

  // Live events
  useEffect(() => {
    return client.subscribeToConversation(conversationId, (ev) => {
      if (ev.type === 'message' && ev.message) {
        const incoming = ev.message;
        setMessages((prev) => {
          // Reconcile optimistic sends (same clientId) and dedupe by id.
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
            // Only count it as read when the reader can actually see it.
            if (document.hasFocus()) void client.markConversationRead(conversationId);
          } else {
            setNewBelow(true);
          }
        }
        requestAnimationFrame(() => {
          if (atBottomRef.current) scrollToBottom(true);
        });
      } else if (ev.type === 'read') {
        // Other party read our messages — refresh read receipts.
        void client.getMessages(conversationId).then(setMessages);
      } else if (ev.type === 'listing_updated' && ev.listing) {
        const updated = ev.listing;
        setConv((prev) => (prev ? { ...prev, listing: { ...prev.listing, ...updated } } : prev));
      }
      onAnyChange();
    });
  }, [client, conversationId, meId, onAnyChange, scrollToBottom]);

  // Mark read when the tab regains focus while at bottom.
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
    if (!body || !conv) return;
    if (body.length > MESSAGE_MAX_LENGTH) return;
    setDraft('');
    setSendError(null);
    const clientId = nextClientId();
    const optimistic: Message = {
      id: clientId,
      conversationId,
      senderId: meId,
      kind: 'user',
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
      pending: true,
      clientId,
    };
    setMessages((prev) => [...prev, optimistic]);
    requestAnimationFrame(() => scrollToBottom(true));
    try {
      const real = await client.sendMessage(conversationId, body, clientId);
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId && m.pending ? { ...real } : m)),
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.clientId !== clientId));
      setDraft(body);
      setSendError(err instanceof Error ? err.message : 'Message failed to send.');
    }
    textareaRef.current?.focus();
  };

  const changeStatus = async (status: ListingStatus, reserveHere: boolean) => {
    if (!conv) return;
    setStatusBusy(true);
    try {
      await client.setListingStatus(conv.listing.id, status, {
        reservedForConversationId: reserveHere ? conversationId : null,
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Status change failed.');
    } finally {
      setStatusBusy(false);
    }
  };

  const sections = useMemo(() => groupMessages(messages), [messages]);
  const lastReadOwnId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId === meId && m.kind === 'user' && m.readAt) return m.id;
    }
    return null;
  }, [messages, meId]);

  if (state === 'loading') {
    return (
      <section className="chat-thread panel" aria-busy="true">
        <div className="skeleton" style={{ height: 64, margin: 'var(--sp-3)' }} />
        <div className="chat-scroll">
          <div className="skeleton" style={{ height: 48, width: '60%', margin: 'var(--sp-4)' }} />
          <div className="skeleton" style={{ height: 48, width: '55%', margin: 'var(--sp-4) var(--sp-4) var(--sp-4) auto' }} />
        </div>
      </section>
    );
  }

  if (state === 'missing' || state === 'error' || !conv) {
    return (
      <section className="chat-thread panel">
        <div className="empty-state">
          <div className="empty-glyph" aria-hidden="true" />
          <h3 className="display">{state === 'missing' ? 'Conversation not found' : 'Couldn’t load this thread'}</h3>
          <button className="btn btn-primary" onClick={() => navigate('/chat')}>
            Back to conversations
          </button>
        </div>
      </section>
    );
  }

  const isSeller = conv.sellerId === meId;
  const listing = conv.listing;
  const composerDisabled = listing.status === 'removed';

  return (
    <section className="chat-thread panel" aria-label={`Conversation with ${conv.otherParty.displayName}`}>
      <header className="chat-pinned glass">
        <Link to="/chat" className="chat-back" aria-label="Back to conversations">‹</Link>
        <Link to={`/listing/${listing.id}`} className="chat-pinned-listing">
          {listing.images[0] && <img src={listing.images[0].url} alt="" />}
          <span className="chat-pinned-info">
            <span className="chat-pinned-title">{listing.title}</span>
            <span className="chat-pinned-sub">
              <span className="price">{formatPrice(listing.price, listing.currency)}</span>
              <span className={`badge badge-${listing.status}`}>
                {STATUS_LABELS[listing.status]}
                {listing.status === 'reserved' &&
                  listing.reservedForConversationId === conversationId &&
                  ' · for you'}
              </span>
            </span>
          </span>
        </Link>
        <span className="chat-pinned-party">
          <Avatar profile={conv.otherParty} size={30} />
          <span className="chat-pinned-name">{conv.otherParty.displayName}</span>
        </span>
        {isSeller && (listing.status === 'active' || listing.status === 'reserved') && (
          <div className="chat-pinned-actions">
            {listing.status === 'active' ? (
              <button
                className="btn btn-quiet btn-sm"
                disabled={statusBusy}
                onClick={() => void changeStatus('reserved', true)}
              >
                Reserve for this chat
              </button>
            ) : (
              <button
                className="btn btn-quiet btn-sm"
                disabled={statusBusy}
                onClick={() => void changeStatus('active', false)}
              >
                Unreserve
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              disabled={statusBusy}
              onClick={() => void changeStatus('sold', false)}
            >
              Mark sold
            </button>
          </div>
        )}
      </header>

      <div
        className="chat-scroll"
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
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
          <div className="chat-thread-empty">
            <p>
              Say hello — ask about condition, negotiate the price, or arrange a meetup. Keep the
              whole deal in this chat.
            </p>
          </div>
        )}
        {sections.map((section) => (
          <div key={section.dayKey} className="chat-day">
            <div className="chat-day-divider" role="separator" aria-label={section.dayLabel}>
              <span>{section.dayLabel}</span>
            </div>
            {section.clusters.map((cluster, ci) =>
              cluster.kind === 'system' ? (
                <div key={ci} className="chat-system" role="status">
                  {cluster.messages.map((m) => (
                    <p key={m.id}>
                      <span className="chat-system-pill">{m.body}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <div
                  key={ci}
                  className={`chat-cluster ${cluster.senderId === meId ? 'chat-cluster-own' : ''}`}
                >
                  {cluster.messages.map((m, mi) => (
                    <div key={m.id} className={`chat-bubble ${m.pending ? 'chat-bubble-pending' : ''}`}>
                      <p>{m.body}</p>
                      {mi === cluster.messages.length - 1 && (
                        <span className="chat-bubble-meta">
                          {m.pending ? (
                            <span className="chat-pending" title="Sending">◷</span>
                          ) : (
                            <time>{timeOfDay(m.createdAt)}</time>
                          )}
                          {m.id === lastReadOwnId && <span className="chat-seen">Seen</span>}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        ))}
      </div>

      {newBelow && (
        <button className="chat-newpill glass" onClick={() => scrollToBottom(true)}>
          ↓ New messages
        </button>
      )}

      <footer className="chat-composer">
        <Link to="/safety" className="chat-safety-link">
          Deal safely: meet in public, verify before paying — read the safe trading tips
        </Link>
        {sendError && (
          <p className="field-error" role="alert">{sendError}</p>
        )}
        <div className="chat-composer-row">
          <textarea
            ref={textareaRef}
            className="textarea chat-input"
            rows={1}
            placeholder={composerDisabled ? 'This listing was removed' : 'Write a message…'}
            value={draft}
            disabled={composerDisabled}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            aria-label="Message"
          />
          <button
            className="btn btn-primary chat-send"
            disabled={!draft.trim() || composerDisabled}
            onClick={() => void send()}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
        {MESSAGE_MAX_LENGTH - draft.length < 200 && (
          <span className="field-hint chat-counter">
            {MESSAGE_MAX_LENGTH - draft.length} characters left
          </span>
        )}
      </footer>
    </section>
  );
}
