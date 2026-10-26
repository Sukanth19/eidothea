"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

type CardState = { status: "idle" | "loading" | "error" } | { status: "ready"; file: File };

/**
 * Share button and panel. The panel starts downloading the story card as it opens, so
 * "Share image" can hand the file straight to the phone's share sheet: Safari only allows
 * navigator.share right after a tap, not after a download finishes. From the share sheet,
 * Instagram/Snapchat open their story editor with the card, and the person decides whether to post.
 */
export function ShareStory({ storyId, title, label = "SHARE", autoOpen = false, heading }: { storyId: number; title: string; label?: string; autoOpen?: boolean; heading?: string }) {
  const [open, setOpen] = useState(autoOpen);
  const [card, setCard] = useState<CardState>({ status: "idle" });
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canShareLinks, setCanShareLinks] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardUrl = `/stories/${storyId}/card`;

  useEffect(() => {
    setMounted(true);
    // Opened by ?published=1 after publishing; drop it so a reload doesn't pop the panel again
    if (autoOpen) window.history.replaceState(null, "", window.location.pathname);
    setCanShareLinks(typeof navigator.share === "function");
    try {
      const probe = new File([""], "probe.png", { type: "image/png" });
      setCanShareFiles(!!navigator.canShare?.({ files: [probe] }));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Fetch the card once, as soon as the panel opens
  useEffect(() => {
    if (!open || card.status !== "idle" || !canShareFiles) return;
    setCard({ status: "loading" });
    fetch(cardUrl)
      .then(r => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(blob => setCard({ status: "ready", file: new File([blob], `eidothea-${storyId}.png`, { type: "image/png" }) }))
      .catch(() => setCard({ status: "error" }));
  }, [open, card.status, canShareFiles, cardUrl, storyId]);

  const pageUrl = () => `${window.location.origin}/stories/${storyId}`;

  async function shareImage() {
    if (card.status !== "ready") return;
    try {
      // The image alone: some apps (Instagram among them) drop files that come with text or a URL
      await navigator.share({ files: [card.file] });
    } catch {} // closing the share sheet rejects too; nothing to report
  }

  async function shareLink() {
    try {
      await navigator.share({ title, url: pageUrl() });
    } catch {}
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  const visit = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
  const text = encodeURIComponent(`${title} — from the Eidothea archive`);
  const enc = () => encodeURIComponent(pageUrl());

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="scrim" onClick={() => setOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="share-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Share this story"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <div className="drawer-head">
              <h2>{heading ?? "Share this story"}</h2>
              <button ref={closeRef} type="button" className="tool" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" /></button>
            </div>

            <div className="share-body">
              <img className="share-preview" src={cardUrl} alt={`Story card for “${title}”`} width={1080} height={1920} />

              <div className="share-actions">
                {canShareFiles ? (
                  <>
                    <button type="button" className="primary" onClick={shareImage} disabled={card.status !== "ready"}>
                      <Icon name="share" size={16} /> {card.status === "loading" ? "PREPARING CARD…" : "SHARE TO STORY"}
                    </button>
                    <p className="hint">
                      Opens your phone&apos;s share menu. Pick <b>Instagram</b> (then <b>Story</b>), Snapchat or WhatsApp. The card opens in
                      their editor, and nothing is posted unless you post it. Add a link sticker so people can find it.
                    </p>
                    {card.status === "error" && <p className="msg error">✕ The card didn&apos;t load. Try downloading it instead.</p>}
                  </>
                ) : (
                  <p className="hint">On your phone, this button sends the card straight to Instagram or Snapchat stories. Here you can download it and post it from your phone.</p>
                )}

                <a className="btn ghost" href={cardUrl} download={`eidothea-${storyId}.png`}>
                  <Icon name="download" size={16} /> DOWNLOAD CARD
                </a>
                {canShareLinks && (
                  <button type="button" className="ghost" onClick={shareLink}><Icon name="share" size={16} /> SHARE LINK</button>
                )}
                <button type="button" className="ghost" onClick={copyLink}>
                  <Icon name="link" size={16} /> {copied ? "COPIED ✓" : "COPY LINK"}
                </button>

                <div className="share-sites">
                  <button type="button" className="chip" onClick={() => visit(`https://wa.me/?text=${text}%20${enc()}`)}>WHATSAPP</button>
                  <button type="button" className="chip" onClick={() => visit(`https://twitter.com/intent/tweet?text=${text}&url=${enc()}`)}>X</button>
                  <button type="button" className="chip" onClick={() => visit(`https://www.reddit.com/submit?url=${enc()}&title=${encodeURIComponent(title)}`)}>REDDIT</button>
                  <button type="button" className="chip" onClick={() => visit(`https://www.facebook.com/sharer/sharer.php?u=${enc()}`)}>FACEBOOK</button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button type="button" className="share-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Icon name="share" size={16} /> {label}
      </button>
      {/* Fixed panels go to <body>: the page-in animation's transform would trap them */}
      {mounted && createPortal(panel, document.body)}
    </>
  );
}
