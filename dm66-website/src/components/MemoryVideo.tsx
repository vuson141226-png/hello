import { useEffect, useRef, useState } from "react";
import { useIsPresent } from "framer-motion";
import { Film, Heart, Play, Sparkles, X } from "lucide-react";
import type { MemoryVideoSource } from "../data/memoryVideos";
import { beginVideoPlayback } from "../lib/mediaActivity";

export function MemoryVideo({ video }: { video: MemoryVideoSource }) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const releasePlayback = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const isPresent = useIsPresent();

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let pageActive = true;
    const update = () => {
      if (visible && pageActive && !document.hidden && !open && isPresent && !reducedMotion.matches && !previewFailed) {
        preview.muted = true;
        void preview.play().catch(() => { /* The poster remains available if autoplay is blocked. */ });
      } else {
        preview.pause();
      }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(preview);
    const hide = () => { pageActive = false; update(); };
    const show = () => { pageActive = true; update(); };
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      observer.disconnect();
      preview.pause();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [open, isPresent, previewFailed]);

  useEffect(() => { if (!isPresent) setOpen(false); }, [isPresent]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !isPresent || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    releasePlayback.current = beginVideoPlayback();
    dialog.showModal();
    const unload = () => {
      if (frameRef.current) frameRef.current.src = "about:blank";
      releasePlayback.current?.();
      releasePlayback.current = null;
    };
    const hide = () => { unload(); setOpen(false); };
    window.addEventListener("pagehide", hide);
    return () => {
      unload();
      window.removeEventListener("pagehide", hide);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (buttonRef.current?.isConnected) buttonRef.current.focus({ preventScroll: true });
    };
  }, [open, isPresent]);

  const loopPreview = (initial = false) => {
    const preview = previewRef.current;
    if (!preview || !Number.isFinite(preview.duration)) return;
    const start = Math.min(video.previewStart, Math.max(0, preview.duration - 0.25));
    const end = Math.min(preview.duration, Math.max(start + 0.25, video.previewEnd));
    if (initial || preview.currentTime >= end || preview.currentTime < start) preview.currentTime = start;
  };

  return (
    <section
      className="memories-video-card"
      aria-label={video.title}
      onKeyDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <span className="memories-video-tape" aria-hidden="true" />
      <header><Film size={15} aria-hidden="true" /><h3>Thước phim</h3></header>
      <button ref={buttonRef} type="button" className="memories-video-preview-button" aria-label={`Xem ${video.title.charAt(0).toLowerCase()}${video.title.slice(1)}`} onClick={() => setOpen(true)}>
        {!posterFailed && <img className="memories-video-poster" src={video.poster} alt="" loading="lazy" onError={() => setPosterFailed(true)} />}
        {!previewFailed && <video
          ref={previewRef}
          className="memories-video-preview"
          src={video.previewSrc}
          poster={posterFailed ? undefined : video.poster}
          muted playsInline loop preload="metadata" aria-hidden="true" tabIndex={-1}
          onLoadedMetadata={() => loopPreview(true)}
          onTimeUpdate={() => loopPreview()}
          onError={() => setPreviewFailed(true)}
        />}
        <span className="memories-video-play"><Play size={23} fill="currentColor" aria-hidden="true" /></span>
        <span className="memories-video-preview-label">Nhấn để xem</span>
      </button>
      <footer><Heart size={12} aria-hidden="true" /><a className="memories-video-external" href={video.watchUrl} aria-label="Mở video riêng trên Drive" target="_blank" rel="noopener noreferrer">Xem trên Drive ↗</a><Heart size={12} aria-hidden="true" /></footer>
      {open && isPresent && <dialog
        ref={dialogRef}
        className="memories-video-dialog"
        aria-label={video.title}
        onCancel={(event) => { event.preventDefault(); setOpen(false); }}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <div className="memories-video-viewer">
          <span className="memories-video-modal-ribbon" aria-hidden="true">୨୧</span>
          <span className="memories-video-sparkles" aria-hidden="true">✧ ♡ ✿</span>
          <header><Sparkles size={18} aria-hidden="true" /><h2>Boy Day 2026</h2><span aria-hidden="true">♡</span></header>
          <button type="button" autoFocus className="memories-video-close" aria-label="Đóng video kỷ niệm" onClick={() => setOpen(false)}><X size={22} aria-hidden="true" /></button>
          <div className="memories-video-screen"><iframe
            ref={frameRef}
            className="memories-video-embed"
            src={video.src}
            title={video.title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          /></div>
          <p className="memories-video-modal-caption">Một thước phim, thật nhiều kỷ niệm <Heart size={14} aria-hidden="true" /></p>
          <a className="memories-video-external" href={video.watchUrl} aria-label="Mở video riêng trên Drive" target="_blank" rel="noopener noreferrer">Xem trên Drive ↗</a>
          <span className="memories-video-petals" aria-hidden="true">✿ · ♡ · ✧ · ♡ · ✿</span>
        </div>
      </dialog>}
    </section>
  );
}
