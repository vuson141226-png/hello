const activeVideos = new Set<symbol>();
const eventName = "dm66:video-playback";

export function isVideoPlaybackActive(): boolean {
  return activeVideos.size > 0;
}

/** Keep background music paused until every opened video viewer has closed. */
export function beginVideoPlayback(): () => void {
  const token = Symbol("video");
  activeVideos.add(token);
  window.dispatchEvent(new Event(eventName));
  return () => {
    if (activeVideos.delete(token)) window.dispatchEvent(new Event(eventName));
  };
}

export function subscribeVideoPlayback(listener: (active: boolean) => void): () => void {
  const update = () => listener(isVideoPlaybackActive());
  window.addEventListener(eventName, update);
  update();
  return () => window.removeEventListener(eventName, update);
}
