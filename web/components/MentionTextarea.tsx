"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { ROLE_LABEL, ROLE_LEVEL, type Role } from "@/lib/types";
import { Sigil } from "./Sigil";

type Candidate = { username: string; role: Role; here: boolean };

// The "@name" being typed just before the caret; same edges as the API's MENTION
const TYPING = /(?<![\w@])@([A-Za-z0-9_-]{0,24})$/;

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  storyId: number;
};

/** A comment box that offers members to mention as soon as "@" is typed. */
export function MentionTextarea({ value, onChange, storyId, onKeyDown, onBlur, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Where the "@" sits and what follows it; null when no mention is being typed
  const [query, setQuery] = useState<{ at: number; text: string } | null>(null);
  const [options, setOptions] = useState<Candidate[]>([]);
  const [pick, setPick] = useState(0);
  const cache = useRef(new Map<string, Candidate[]>());

  function look(text: string, caret: number) {
    const m = TYPING.exec(text.slice(0, caret));
    setQuery(m ? { at: caret - m[0].length, text: m[1] } : null);
  }

  useEffect(() => {
    if (!query) return;
    const key = query.text.toLowerCase();
    const known = cache.current.get(key);
    if (known) {
      setOptions(known);
      setPick(0);
      return;
    }
    let live = true;
    // The first list (just "@") comes straight away; narrowing waits for a pause in typing
    const timer = setTimeout(() => {
      api<Candidate[]>(`/api/mentions?story_id=${storyId}&q=${encodeURIComponent(query.text)}`)
        .then(list => {
          cache.current.set(key, list);
          if (!live) return;
          setOptions(list);
          setPick(0);
        })
        .catch(() => {});
    }, query.text ? 120 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, storyId]);

  const open = !!query && options.length > 0;

  function choose(c: Candidate) {
    const el = ref.current;
    if (!query || !el) return;
    const end = query.at + 1 + query.text.length;
    const rest = value.slice(end);
    const insert = `@${c.username}${rest.startsWith(" ") ? "" : " "}`;
    onChange(value.slice(0, query.at) + insert + rest);
    setQuery(null);
    const caret = query.at + insert.length + (rest.startsWith(" ") ? 1 : 0);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function keys(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setPick(p => (p + step + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(options[pick]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className="mention-field">
      <textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          look(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={keys}
        onClick={e => look(value, e.currentTarget.selectionStart)}
        onBlur={e => {
          setQuery(null);
          onBlur?.(e);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? `mentions-${storyId}` : undefined}
        aria-activedescendant={open ? `mention-${storyId}-${pick}` : undefined}
      />
      {open && (
        <ul id={`mentions-${storyId}`} className="mention-list" role="listbox" aria-label="Members to mention">
          {options.map((c, i) => (
            <li
              key={c.username}
              id={`mention-${storyId}-${i}`}
              role="option"
              aria-selected={i === pick}
              className={i === pick ? "on" : ""}
              // pointerdown, not click: picking mustn't blur the box first and close the list
              onPointerDown={e => {
                e.preventDefault();
                choose(c);
              }}
              onPointerEnter={() => setPick(i)}
            >
              <Sigil name={c.username} size={22} />
              <b>{c.username}</b>
              {ROLE_LEVEL[c.role] > 0 && <span className={`role ${c.role}`}>{ROLE_LABEL[c.role].toUpperCase()}</span>}
              {c.here && <span className="here">ON THIS STORY</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
