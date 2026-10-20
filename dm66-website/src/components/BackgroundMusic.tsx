import { useEffect, useRef, useState } from "react";
import { ExternalLink, Music2, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { siteConfig } from "../config";
import { isVideoPlaybackActive, subscribeVideoPlayback } from "../lib/mediaActivity";
import { loadYouTubeAPI } from "../lib/youtubePlayer";
import type { YouTubePlayer } from "../lib/youtubePlayer";
import "./BackgroundMusic.css";

type Playback = "idle" | "loading" | "playing" | "paused" | "error";

/** Mounted outside the route transition so navigation never recreates the song. */
export function BackgroundMusic() {
  const [enabled, setEnabled] = useState(false);
  const [playback, setPlayback] = useState<Playback>("idle");
  const [videoOpen, setVideoOpen] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const desired = useRef(false);
  const blocked = useRef(isVideoPlaybackActive());
  const pageHidden = useRef(false);
  const mounted = useRef(false);
  const ready = useRef(false);
  const generation = useRef(0);
  const loading = useRef(false);
  const readyTimer = useRef<number | undefined>(undefined);
  const playTimer = useRef<number | undefined>(undefined);
  const actualPlayback = useRef<Playback>("idle");

  function updatePlayback(value: Playback) {
    actualPlayback.current = value;
    if (mounted.current) setPlayback(value);
  }

  function clearTimers() {
    window.clearTimeout(readyTimer.current);
    window.clearTimeout(playTimer.current);
  }

  function mayPlay() {
    return desired.current && !blocked.current && !isVideoPlaybackActive() && !pageHidden.current;
  }

  function pause() {
    window.clearTimeout(playTimer.current);
    if (ready.current) player.current?.pauseVideo();
    if (actualPlayback.current !== "error") updatePlayback("paused");
  }

  function play() {
    if (!ready.current || !player.current) return;
    if (!mayPlay()) {
      pause();
      return;
    }
    setNeedsGesture(false);
    updatePlayback("loading");
    player.current.playVideo();
    window.clearTimeout(playTimer.current);
    playTimer.current = window.setTimeout(() => {
      if (mounted.current && mayPlay() && actualPlayback.current === "loading") {
        updatePlayback("paused");
        setNeedsGesture(true);
      }
    }, 8_000);
  }

  function destroyPlayer() {
    generation.current += 1;
    clearTimers();
    ready.current = false;
    loading.current = false;
    player.current?.destroy();
    player.current = null;
    host.current?.replaceChildren();
  }

  async function ensurePlayer() {
    if (ready.current) {
      play();
      return;
    }
    if (loading.current) return;
    destroyPlayer();
    const attempt = generation.current;
    loading.current = true;
    setNeedsGesture(false);
    updatePlayback("loading");
    const current = () => mounted.current && attempt === generation.current;
    const fail = () => {
      if (!current()) return;
      destroyPlayer();
      updatePlayback("error");
    };
    try {
      const api = await loadYouTubeAPI();
      if (!current() || !host.current) return;
      const target = document.createElement("div");
      host.current.replaceChildren(target);
      readyTimer.current = window.setTimeout(fail, 12_000);
      const instance = new api.Player(target, {
        width: 224,
        height: 200,
        videoId: siteConfig.musicYouTubeId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          playsinline: 1,
          loop: 1,
          playlist: siteConfig.musicYouTubeId,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (!current()) return;
            window.clearTimeout(readyTimer.current);
            player.current = event.target;
            ready.current = true;
            loading.current = false;
            event.target.setVolume(35);
            if (mayPlay()) play();
            else pause();
          },
          onStateChange: (event) => {
            if (!current()) return;
            if (event.data === 1) {
              if (!mayPlay()) {
                pause();
                return;
              }
              window.clearTimeout(playTimer.current);
              setNeedsGesture(false);
              updatePlayback("playing");
            } else if (event.data === 0) {
              if (mayPlay()) {
                event.target.seekTo(0, true);
                play();
              } else pause();
            } else if (event.data === 2) updatePlayback("paused");
            else if (event.data === 3 && mayPlay()) updatePlayback("loading");
          },
          onError: fail,
          onAutoplayBlocked: () => {
            if (!current()) return;
            window.clearTimeout(playTimer.current);
            updatePlayback("paused");
            setNeedsGesture(true);
          },
        },
      });
      if (!current()) instance.destroy();
      else {
        player.current = instance;
        host.current.querySelector("iframe")?.setAttribute("title", "Nhạc nền · YouTube");
      }
    } catch {
      fail();
    }
  }

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeVideoPlayback((active) => {
      blocked.current = active;
      setVideoOpen(active);
      if (active) pause();
      else if (desired.current && ready.current) play();
    });
    const hide = () => {
      pageHidden.current = true;
      pause();
    };
    const show = () => {
      pageHidden.current = false;
      if (desired.current && ready.current) play();
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      mounted.current = false;
      unsubscribe();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      destroyPlayer();
    };
    // Player callbacks read refs, keeping one subscription for the whole journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    desired.current = !desired.current;
    setEnabled(desired.current);
    if (desired.current) void ensurePlayer();
    else {
      pause();
      if (!ready.current) destroyPlayer();
    }
  }

  const playing = enabled && !videoOpen && playback === "playing";
  const status = videoOpen
    ? "Nhạc tạm dừng khi cậu xem video."
    : playback === "playing"
      ? "Nhạc đang phát · lặp lại khi kết thúc."
      : playback === "error"
        ? "Chưa kết nối được YouTube. Cậu thử lại hoặc nghe trên YouTube nhé."
        : needsGesture
          ? "Nhấn phát để trình duyệt cho phép bật nhạc nhé."
          : playback === "loading"
            ? "Đang kết nối nhạc từ YouTube…"
            : "Nhạc đang tạm dừng.";

  return (
    <aside className="music-widget background-music" aria-label="Nhạc nền">
      <div className="music-popover background-music-panel" hidden={!enabled || videoOpen}>
        <strong><Music2 size={16} aria-hidden="true" /> Một chút nhạc, một chút thơ.</strong>
        <p className="background-music-status" role="status">{status}</p>
        <div className="background-music-player" ref={host} />
        {playback === "error" && (
          <button className="background-music-retry" onClick={() => void ensurePlayer()}>
            <RotateCcw size={13} aria-hidden="true" /> Thử kết nối lại
          </button>
        )}
        {!videoOpen && playback === "paused" && (
          <button className="background-music-retry" onClick={play}>Phát nhạc</button>
        )}
        <p className="background-music-hint">Bật một lần, nhạc sẽ theo cậu qua các trang.</p>
        <a href={siteConfig.musicUrl} target="_blank" rel="noopener noreferrer">
          Nghe trên YouTube <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>
      {enabled && videoOpen && <span className="background-music-video-status" role="status">Nhạc tạm dừng khi xem video</span>}
      <button
        className={`music-toggle ${playing ? "is-playing" : ""}`}
        onClick={toggle}
        aria-label={enabled ? "Tắt nhạc" : "Bật nhạc"}
        aria-pressed={enabled}
        title={enabled ? "Tắt nhạc" : "Bật nhạc để nghe xuyên suốt hành trình"}
      >
        {playing ? <Volume2 size={17} /> : <VolumeX size={17} />}
        <span>{playing ? "Nhạc đang bật" : enabled ? (videoOpen ? "Nhạc tạm dừng" : "Nhạc của chúng mình") : "Bật một chút nhạc"}</span>
        {playing && <span className="music-bars" aria-hidden="true"><i /><i /><i /></span>}
      </button>
    </aside>
  );
}
