import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useIsPresent } from "framer-motion";
import { Film, Heart, RotateCw } from "lucide-react";
import type { MemoryVideoSource } from "../data/memoryVideos";

export function MemoryVideo({ video }: { video: MemoryVideoSource }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [rotation, setRotation] = useState<number>(video.rotation ?? 0);
  const isPresent = useIsPresent();
  const sideways = rotation % 180 !== 0;

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
  }, [video.src, isPresent]);

  return (
    <section
      className="memories-video-card"
      aria-label={video.title}
      onKeyDown={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <span className="memories-video-tape" aria-hidden="true" />
      <header><Film size={15} aria-hidden="true" /><h3>Thước phim</h3><button type="button" className="memories-video-rotate" aria-label="Xoay video thêm 90 độ" title="Xoay video" onClick={() => setRotation((angle) => (angle + 90) % 360)}><RotateCw size={15} aria-hidden="true" /></button></header>
      <div className="memories-video-viewport" style={{ "--video-rotation": `${rotation}deg` } as CSSProperties}>
      {isPresent && <iframe
        ref={frameRef}
        className={`memories-video-embed${sideways ? " is-sideways" : ""}`}
        src={video.src}
        title={video.title}
        loading="lazy"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />}
      </div>
      <footer><Heart size={12} aria-hidden="true" /><a className="memories-video-external" href={video.watchUrl} aria-label="Mở video riêng trên Drive" target="_blank" rel="noopener noreferrer">Xem trên Drive ↗</a><Heart size={12} aria-hidden="true" /></footer>
    </section>
  );
}
