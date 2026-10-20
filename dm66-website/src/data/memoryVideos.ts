export interface MemoryVideoSource {
  src: string;
  title: string;
  watchUrl: string;
  previewSrc: string;
  poster: string;
  previewStart: number;
  previewEnd: number;
}

/** Video attachments stay associated with stable event IDs when Excel is reimported. */
export const memoryVideos: Record<string, MemoryVideoSource> = {
  "ky-niem-13": {
    src: "https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/preview",
    title: "Video kỷ niệm Boy Day 2026",
    watchUrl: "https://drive.google.com/file/d/1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC/view",
    previewSrc: "https://drive.usercontent.google.com/download?id=1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC&export=download&confirm=t",
    poster: "https://drive.google.com/thumbnail?id=1SUmpD8OtBOHTtKHZzJ5_hpC_dC_Q6lEC&sz=w640",
    previewStart: 2,
    previewEnd: 8,
  },
};
