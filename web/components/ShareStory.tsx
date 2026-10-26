"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

type CardState = { status: "idle" | "loading" | "error" } | { status: "ready"; file: File };
type Platform = "android" | "ios" | "desktop";

// Instagram doesn't let websites open its story editor with an image (only native apps
// registered with Meta can), and its share-sheet entry usually only sends a message.
// So the Instagram route is: save the card, then jump into Instagram's story camera,
// where the card is the newest photo in the gallery.
const INSTAGRAM_WEB = "https://www.instagram.com/";
const INSTAGRAM_ANDROID = `intent://story-camera#Intent;scheme=instagram;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(INSTAGRAM_WEB)};end`;
const INSTAGRAM_IOS = "instagram://story-camera";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  // iPadOS reports itself as a Mac; touch support gives it away
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

/**
 * Share button and panel. The card is fetched as the panel opens, so buttons that hand it
 * to the share sheet can call navigator.share straight away: Safari only allows that right
 * after a tap, not after a download finishes.
 */
export function ShareStory({ storyId, title, label = "SHARE", autoOpen = false, heading }: { storyId: number; title: string; label?: string; autoOpen?: boolean; heading?: string }) {
  const [open, setOpen] = useState(autoOpen);
  const [card, setCard] = useState<CardState>({ status: "idle" });
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [canShareLinks, setCanShareLinks] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cardUrl = `/stories/${storyId}/card`;
  const fileName = `eidothea-${storyId}.png`;
  const phone = platform !== "desktop";

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    // Opened by ?published=1 or ?share=1; drop it so a reload doesn't pop the panel again
    if (autoOpen) window.history.replaceState(null, "", window.location.pathname);
    setCanShareLinks(typeof navigator.share === "function");
    try {
      const probe = new File([""], "probe.png", { type: "image/png" });
      setCanShareFiles(!!navigator.canShare?.({ files: [probe] }));
    } catch {}
  }, [autoOpen]);

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
      .then(blob => setCard({ status: "ready", file: new File([blob], fileName, { type: "image/png" }) }))
      .catch(() => setCard({ status: "error" }));
  }, [open, card.status, canShareFiles, cardUrl, fileName]);

  const pageUrl = () => `${window.location.origin}/stories/${storyId}`;

  async function shareImage() {
    if (card.status !== "ready") return false;
    try {
      // The image alone: some apps drop files that come with text or a URL
      await navigator.share({ files: [card.file] });
      return true;
    } catch {
      return false; // closing the share sheet rejects too; nothing to report
    }
  }

  /** iPhone: through the share sheet's "Save Image", which puts it in Photos. Elsewhere: a download. */
  async function saveCard(e: React.MouseEvent<HTMLAnchorElement>) {
    if (platform === "ios" && card.status === "ready") {
      e.preventDefault();
      if (await shareImage()) setSaved(true);
    } else {
      setSaved(true);
    }
  }

  function openInstagram() {
    if (platform === "android") {
      window.location.href = INSTAGRAM_ANDROID;
      return;
    }
    window.location.href = INSTAGRAM_IOS;
    // Still here a moment later? The app isn't installed: go to the website instead
    setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = INSTAGRAM_WEB;
    }, 1500);
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
                <section className="share-ig" aria-label="Post to your Instagram story">
                  <h3>Instagram story</h3>
                  {phone ? (
                    <>
                      <a className={`btn${saved ? " ghost" : ""}`} href={cardUrl} download={fileName} onClick={saveCard}>
                        <span className="step">1</span> {saved ? "CARD SAVED ✓" : "SAVE CARD"}
                      </a>
                      <button type="button" className={saved ? "" : "ghost"} onClick={openInstagram}>
                        <span className="step">2</span> OPEN INSTAGRAM
                      </button>
                      <p className="hint">
                        Instagram opens on the story camera. Tap the gallery: the card is your newest photo. Post it or don&apos;t, it&apos;s up to you.
                        {platform === "ios" && " To save, pick “Save Image” in the menu that pops up."}
                      </p>
                    </>
                  ) : (
                    <div className="share-qr">
                      <img src={`/stories/${storyId}/qr`} alt="QR code that opens this story on your phone" width={132} height={132} />
                      <p className="hint">
                        Instagram stories can only be posted from the phone app. <b>Scan this with your phone</b>: the story opens with this panel ready,
                        or <a href={cardUrl} download={fileName}>download the card</a> and send it to yourself.
                      </p>
                    </div>
                  )}
                  {card.status === "error" && <p className="msg error">✕ The card didn&apos;t load. Try again in a moment.</p>}
                </section>

                {phone && canShareFiles && (
                  <button type="button" className="ghost" onClick={shareImage} disabled={card.status !== "ready"}>
                    <Icon name="share" size={16} /> {card.status === "loading" ? "PREPARING CARD…" : "SEND CARD TO OTHER APPS"}
                  </button>
                )}
                {!phone && (
                  <a className="btn ghost" href={cardUrl} download={fileName}>
                    <Icon name="download" size={16} /> DOWNLOAD CARD
                  </a>
                )}
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
