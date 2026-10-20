export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  destroy(): void;
}

export interface YouTubeEvent {
  target: YouTubePlayer;
  data: number;
}

interface YouTubePlayerOptions {
  width: number;
  height: number;
  videoId: string;
  playerVars: Record<string, number | string>;
  events: {
    onReady(event: YouTubeEvent): void;
    onStateChange(event: YouTubeEvent): void;
    onError(event: YouTubeEvent): void;
    onAutoplayBlocked(event: YouTubeEvent): void;
  };
}

export interface YouTubeAPI {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let pendingAPI: Promise<YouTubeAPI> | null = null;

/** Load the official player once, including across React StrictMode remounts. */
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pendingAPI) return pendingAPI;

  pendingAPI = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    let finished = false;

    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      script.onerror = null;
      if (window.onYouTubeIframeAPIReady === ready) {
        window.onYouTubeIframeAPIReady = previousReady;
      }
      if (error || !window.YT?.Player) {
        script.remove();
        pendingAPI = null;
        reject(error ?? new Error("YouTube player is unavailable"));
      } else resolve(window.YT);
    };
    const ready = () => {
      try {
        previousReady?.();
      } finally {
        finish();
      }
    };
    const timeout = window.setTimeout(() => finish(new Error("YouTube player timed out")), 12_000);
    window.onYouTubeIframeAPIReady = ready;
    script.onerror = () => finish(new Error("YouTube player could not load"));
    document.head.append(script);
  });
  return pendingAPI;
}
