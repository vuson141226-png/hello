import { useEffect, useRef } from "react";
import { Film, Heart, Sparkles } from "lucide-react";
import type { MemoryVideoSource } from "../data/memoryVideos";

export function MemoryVideo({ video }: { video: MemoryVideoSource }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const pause = () => {
      // Unloading the external player also stops it when this page enters bfcache.
      if (frame) frame.src = "about:blank";
    };
    const restore = () => { if (frame) frame.src = video.src; };
    // Restore after React's development setup/cleanup cycle as well as bfcache.
    restore();
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", restore);
    return () => {
      pause();
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", restore);
    };
  }, [video.src]);

  return (
    <section
      className="memories-video-card"
      aria-label={video.title}
      onKeyDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <span className="memories-video-tape" aria-hidden="true" />
      <header><Film size={17} aria-hidden="true" /><h3>Thước phim của chúng mình</h3><Sparkles size={17} aria-hidden="true" /></header>
      <iframe
        ref={frameRef}
        className="memories-video-embed"
        src={video.src}
        title={video.title}
        loading="lazy"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <p className="memories-video-note"><Heart size={12} aria-hidden="true" />Nhấn phát để cùng xem lại nhé<Heart size={12} aria-hidden="true" /></p>
      <a className="memories-video-external" href={video.watchUrl} target="_blank" rel="noopener noreferrer">Mở video riêng trên Drive ↗</a>
    </section>
  );
}
