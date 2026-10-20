export interface MemoryVideoSource {
  src: string;
  title: string;
  watchUrl: string;
}

/** Video attachments stay associated with stable event IDs when Excel is reimported. */
export const memoryVideos: Record<string, MemoryVideoSource> = {
  "ky-niem-13": {
    src: "https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/preview",
    title: "Video kỷ niệm Boy Day 2026",
    watchUrl: "https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/view",
  },
};
