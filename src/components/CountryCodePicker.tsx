import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COUNTRIES, countryByIso, searchCountries, type Country } from '../lib/countries';
import { flagUrl } from '../lib/flags';
import './countrycodepicker.css';

/** A country's flag (flag-icons SVG). Decorative: the name or code is always next to it. */
export function Flag({ iso, className = '' }: { iso: string; className?: string }) {
  const src = flagUrl(iso);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={20}
      height={15}
      loading="lazy"
      decoding="async"
      className={`flag ${className}`}
    />
  );
}

/**
 * Country calling-code dropdown: flag + "+961" on the button; a searchable
 * list (name, ISO code or calling code) that opens upward, since it sits
 * just above the chat composer, or downward when there is no room above. Arrow keys, Enter, Home/End and Escape work
 * from the search box.
 */
export function CountryCodePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [dropDown, setDropDown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = countryByIso(value) ?? COUNTRIES[0];
  const results = useMemo(() => searchCountries(query), [query]);

  useEffect(() => {
    if (!open) return;
    // Opening downward (no room above): bring the whole list into view.
    if (dropDown) popRef.current?.scrollIntoView({ block: 'nearest' });
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, dropDown]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Reset before the list renders, so fast typing is never wiped.
    setQuery('');
    setActive(Math.max(0, COUNTRIES.findIndex((c) => c.iso === current.iso)));
    // Open upward unless that would run under the top of the screen (or the
    // sticky header): the list is about 360px tall.
    const top = buttonRef.current?.getBoundingClientRect().top ?? Infinity;
    setDropDown(top < 460);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const choose = (c: Country) => {
    onChange(c.iso);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = results.length - 1;
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, last));
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Enter' && results[active]) choose(results[active]);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
  };

  const optionId = (c: Country) => `${listId}-${c.iso}`;

  return (
    <div className="ccp" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="ccp-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${current.name} +${current.dial}`}
        disabled={disabled}
        onClick={toggle}
      >
        <Flag iso={current.iso} />
        <span className="ccp-code">+{current.dial}</span>
        <span className="ccp-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={`ccp-pop${dropDown ? ' is-down' : ''}`} ref={popRef}>
          <input
            // Focus at mount, so typing straight after opening lands in the search.
            autoFocus
            type="text"
            role="combobox"
            aria-label="Search countries"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[active] ? optionId(results[active]) : undefined}
            className="input ccp-search"
            placeholder="Country or code"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
          />
          <ul id={listId} role="listbox" aria-label="Countries" className="ccp-list" ref={listRef}>
            {results.map((c, i) => (
              <li
                key={c.iso}
                id={optionId(c)}
                role="option"
                aria-selected={c.iso === current.iso}
                data-index={i}
                className={`ccp-option${i === active ? ' is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(c)}
              >
                <Flag iso={c.iso} />
                <span className="ccp-name">{c.name}</span>
                <span className="ccp-dial">+{c.dial}</span>
              </li>
            ))}
            {results.length === 0 && <li className="ccp-empty">No country matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
