import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { siteConfig } from "../config";
import { isVideoPlaybackActive, subscribeVideoPlayback } from "../lib/mediaActivity";

/** Keep one audio element alive throughout the five-page journey. */
export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<(() => void) | null>(null);
  const desired = useRef(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let mounted = true;
    let videoOpen = isVideoPlaybackActive();
    let pageHidden = false;
    let audible = false;
    audio.volume = 0.35;

    const mayPlay = () => mounted && desired.current && !videoOpen && !isVideoPlaybackActive() && !pageHidden;
    const pause = () => {
      audio.autoplay = false;
      audio.pause();
      audible = false;
      if (mounted) setPlaying(false);
    };
    const play = () => {
      if (!mayPlay()) { pause(); return; }
      audio.autoplay = true;
      void audio.play().then(() => {
        // A pending play request must not outlive a video opening or music-off.
        if (mounted && !mayPlay()) pause();
      }).catch(() => {
        // Browsers can require a gesture. The next tap/key or the same button retries.
        if (mounted && audio.paused) setPlaying(false);
      });
    };
    const started = () => {
      if (!mayPlay()) { pause(); return; }
      audible = !audio.paused;
      setPlaying(audible);
    };
    const stopped = () => {
      if (mounted && audio.paused) { audible = false; setPlaying(false); }
    };
    const failed = () => { audible = false; if (mounted) setPlaying(false); };
    const gesture = (event: Event) => {
      // Let the music button handle its own click; retrying on its pointerdown
      // would start music just before the click toggles it off again.
      if (!event.isTrusted) return;
      const onButton = event.target instanceof Node && buttonRef.current?.contains(event.target);
      const activatesButton = event instanceof KeyboardEvent && ["Enter", " ", "Spacebar"].includes(event.key);
      if (onButton && (event.type !== "keydown" || activatesButton)) return;
      if (mayPlay() && audio.paused) play();
    };
    const toggle = () => {
      if (audible && !audio.paused) {
        desired.current = false;
        pause();
      } else {
        desired.current = true;
        play();
      }
    };
    toggleRef.current = toggle;
    audio.addEventListener("playing", started);
    audio.addEventListener("pause", stopped);
    audio.addEventListener("error", failed);
    document.addEventListener("pointerdown", gesture);
    document.addEventListener("click", gesture);
    document.addEventListener("keydown", gesture);
    const hide = () => { pageHidden = true; pause(); };
    const show = () => { pageHidden = false; if (desired.current) play(); };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    const unsubscribe = subscribeVideoPlayback((active) => {
      videoOpen = active;
      if (active) pause();
      else if (desired.current) play();
    });
    return () => {
      mounted = false;
      unsubscribe();
      if (toggleRef.current === toggle) toggleRef.current = null;
      audio.removeEventListener("playing", started);
      audio.removeEventListener("pause", stopped);
      audio.removeEventListener("error", failed);
      document.removeEventListener("pointerdown", gesture);
      document.removeEventListener("click", gesture);
      document.removeEventListener("keydown", gesture);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      pause();
    };
  }, []);

  return (
    <aside className="music-widget background-music" aria-label="Nhạc nền">
      <audio ref={audioRef} className="background-music-audio" src={siteConfig.musicSrc} autoPlay loop preload="auto" hidden />
      <button
        ref={buttonRef}
        type="button"
        className={`music-toggle${playing ? " is-playing" : ""}`}
        onClick={() => toggleRef.current?.()}
        aria-label={playing ? "Tắt nhạc" : "Bật nhạc"}
        aria-pressed={playing}
        title={playing ? "Tắt nhạc" : "Bật nhạc"}
      >
        {playing ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
        <span>Một chút nhạc</span>
        {playing && <span className="music-bars" aria-hidden="true"><i /><i /><i /></span>}
      </button>
    </aside>
  );
}
