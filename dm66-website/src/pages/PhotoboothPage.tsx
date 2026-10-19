import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, CameraOff, Check, Download, Heart, ImagePlus, LoaderCircle, Play, RefreshCw, Sparkles, Video, X } from "lucide-react";
import { PHOTOBOOTH_SHOTS, capturePhotoboothShot, createPhotoboothImage } from "../lib/photoboothImage";
import { startPhotoboothVideo, supportsPhotoboothVideo } from "../lib/photoboothVideo";
import type { PhotoboothVideoSession } from "../lib/photoboothVideo";
import { downloadImage, downloadVideo, isMobileDevice, saveImage, saveVideo } from "../lib/saveImage";
import "./photobooth.css";

interface PhotoboothPageProps {
  notify: (message: string) => void;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cameraMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Cậu chưa cho phép dùng camera. Mở quyền camera trong cài đặt của trình duyệt rồi nhấn Bật camera nhé!";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Chưa tìm thấy camera trên thiết bị này. Cậu có thể chọn 3 ảnh có sẵn ở bên dưới nhé!";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera đang bận hoặc chưa mở được. Cậu đóng ứng dụng đang dùng camera rồi thử lại nhé!";
  }
  return "Chưa mở được camera. Cậu nhấn Bật camera để thử lại, hoặc chọn 3 ảnh có sẵn nhé!";
}

function readLocalPhoto(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    const release = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      URL.revokeObjectURL(url);
    };
    const abort = () => {
      release();
      image.src = "";
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    image.onerror = () => {
      release();
      reject(new Error("Ảnh chưa đọc được. Cậu chọn ảnh JPG, PNG hoặc WebP khác nhé!"));
    };
    image.onload = () => {
      try {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        if (!width || !height || width * height > 50_000_000) {
          throw new Error("Ảnh có kích thước quá lớn hoặc bị lỗi. Cậu chọn ảnh nhỏ hơn nhé!");
        }
        const canvas = document.createElement("canvas");
        canvas.width = 1280;
        canvas.height = 960;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Thiết bị chưa tạo được ảnh. Cậu thử lại nhé!");
        const scale = Math.max(canvas.width / width, canvas.height / height);
        const cropWidth = canvas.width / scale;
        const cropHeight = canvas.height / scale;
        context.drawImage(image, (width - cropWidth) / 2, (height - cropHeight) / 2,
          cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL("image/jpeg", 0.93);
        if (!result.startsWith("data:image/jpeg")) throw new Error("Chưa tạo được ảnh. Cậu thử lại nhé!");
        release();
        resolve(result);
      } catch (error) {
        release();
        reject(error);
      }
    };
    image.src = url;
  });
}

export function PhotoboothPage({ notify }: PhotoboothPageProps) {
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on">("off");
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pose, setPose] = useState(0);
  const [flash, setFlash] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [composite, setComposite] = useState<{ shots: string[]; file: File } | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recordVideo, setRecordVideo] = useState(false);
  const [videoSupported] = useState(supportsPhotoboothVideo);
  const [videoStatus, setVideoStatus] = useState<"idle" | "recording" | "finishing" | "ready" | "failed">("idle");
  const [recordedVideo, setRecordedVideo] = useState<File | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const mounted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const saveDialogRef = useRef<HTMLDialogElement>(null);
  const videoDialogRef = useRef<HTMLDialogElement>(null);
  const recordingRef = useRef<PhotoboothVideoSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackCleanup = useRef<(() => void) | null>(null);
  const cameraRequest = useRef(0);
  const cameraStarting = useRef(false);
  const captureVersion = useRef(0);
  const captureActive = useRef(false);
  const captureWait = useRef<(() => void) | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const uploadActive = useRef(false);
  const savingActive = useRef(false);
  const preparedFile = shots.length === PHOTOBOOTH_SHOTS && composite?.shots === shots ? composite.file : null;
  const mobile = isMobileDevice();
  const busySaving = saving || savingVideo;

  const clearVideo = useCallback((update = true) => {
    recordingRef.current?.cancel();
    recordingRef.current = null;
    if (update && mounted.current) {
      setRecordedVideo(null);
      setVideoStatus("idle");
      setVideoOpen(false);
    }
  }, []);

  const cancelCapture = useCallback((update = true) => {
    ++captureVersion.current;
    captureActive.current = false;
    captureWait.current?.();
    captureWait.current = null;
    recordingRef.current?.cancel();
    recordingRef.current = null;
    if (update && mounted.current) {
      setCapturing(false);
      setCountdown(null);
      setVideoStatus((previous) => previous === "recording" || previous === "finishing" ? "idle" : previous);
    }
  }, []);

  const stopCamera = useCallback((update = true) => {
    ++cameraRequest.current;
    cameraStarting.current = false;
    cancelCapture(update);
    trackCleanup.current?.();
    trackCleanup.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    if (update && mounted.current) {
      setCameraState("off");
      setCameraReady(false);
    }
  }, [cancelCapture]);

  useEffect(() => {
    mounted.current = true;
    const leavePage = () => {
      stopCamera();
      clearVideo();
      uploadController.current?.abort();
      uploadActive.current = false;
      setUploading(false);
    };
    window.addEventListener("pagehide", leavePage);
    return () => {
      mounted.current = false;
      stopCamera(false);
      clearVideo(false);
      uploadController.current?.abort();
      uploadActive.current = false;
      window.removeEventListener("pagehide", leavePage);
    };
  }, [stopCamera, clearVideo]);

  useEffect(() => {
    let cancelled = false;
    setPreparing(true);
    setImageError(false);
    setPreviewOpen(false);
    createPhotoboothImage(shots).then((file) => {
      if (!cancelled) setComposite({ shots, file });
    }).catch(() => {
      if (!cancelled) setImageError(true);
    }).finally(() => {
      if (!cancelled) setPreparing(false);
    });
    return () => { cancelled = true; };
  }, [shots, imageAttempt]);

  useEffect(() => {
    if (!composite) return;
    const url = URL.createObjectURL(composite.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [composite]);

  useEffect(() => {
    const dialog = saveDialogRef.current;
    if (!dialog) return;
    if (previewOpen && previewUrl && !dialog.open) dialog.showModal();
    else if (!previewOpen && dialog.open) dialog.close();
  }, [previewOpen, previewUrl]);

  useEffect(() => {
    if (!recordedVideo) {
      setRecordingUrl(null);
      return;
    }
    const url = URL.createObjectURL(recordedVideo);
    setRecordingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordedVideo]);

  useEffect(() => {
    const dialog = videoDialogRef.current;
    if (!dialog) return;
    if (videoOpen && recordingUrl && !dialog.open) dialog.showModal();
    else if (!videoOpen && dialog.open) {
      dialog.querySelector("video")?.pause();
      dialog.close();
    }
  }, [videoOpen, recordingUrl]);

  const updateVideoReady = () => {
    const video = videoRef.current;
    setCameraReady(Boolean(streamRef.current && video && video.readyState >= 2 && video.videoWidth && video.videoHeight));
  };

  const startCamera = async () => {
    if (cameraStarting.current || streamRef.current || captureActive.current || uploadActive.current) return;
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera cần được mở trên website HTTPS bằng trình duyệt hỗ trợ. Cậu vẫn có thể chọn 3 ảnh có sẵn nhé!");
      return;
    }
    cameraStarting.current = true;
    setCameraState("starting");
    setCameraReady(false);
    const request = ++cameraRequest.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (!mounted.current || request !== cameraRequest.current) {
        stopStream(stream);
        return;
      }
      if (!stream.getVideoTracks().some((track) => track.readyState === "live")) {
        stopStream(stream);
        throw new Error("Camera has no live video track");
      }
      streamRef.current = stream;
      const ended = () => {
        if (streamRef.current !== stream || !mounted.current) return;
        stopCamera();
        setError("Camera đã ngắt kết nối. Cậu nhấn Bật camera để mở lại nhé!");
      };
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", ended));
      trackCleanup.current = () => stream.getVideoTracks().forEach((track) => track.removeEventListener("ended", ended));
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      setCameraState("on");
      await video.play();
      if (!mounted.current || request !== cameraRequest.current) return;
      updateVideoReady();
    } catch (cause) {
      if (!mounted.current || request !== cameraRequest.current) return;
      stopCamera();
      setError(cameraMessage(cause));
    } finally {
      if (request === cameraRequest.current) cameraStarting.current = false;
    }
  };

  const capturePhotos = async () => {
    const video = videoRef.current;
    if (captureActive.current || uploadActive.current || !cameraReady || !video || !streamRef.current) return;
    captureActive.current = true;
    const version = ++captureVersion.current;
    setCapturing(true);
    setError("");
    setShots([]);
    clearVideo();
    const current = () => mounted.current && version === captureVersion.current && streamRef.current !== null;
    const wait = (duration = 1000) => new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        captureWait.current = null;
        resolve(true);
      }, duration);
      captureWait.current = () => { window.clearTimeout(timer); resolve(false); };
    });
    try {
      if (recordVideo && videoSupported) {
        try {
          recordingRef.current = startPhotoboothVideo(video, {
            onError: () => { if (current()) setVideoStatus("failed"); },
          });
          setVideoStatus("recording");
        } catch {
          setVideoStatus("failed");
        }
      }
      const nextShots: string[] = [];
      for (let index = 0; index < PHOTOBOOTH_SHOTS; index += 1) {
        setPose(index);
        for (let count = 3; count >= 1; count -= 1) {
          if (!current()) return;
          setCountdown(count);
          recordingRef.current?.updateCountdown(count, index);
          if (!await wait() || !current()) return;
        }
        if (!streamRef.current?.getVideoTracks().some((track) => track.readyState === "live")) {
          throw new Error("Camera disconnected");
        }
        const shot = capturePhotoboothShot(video, true);
        nextShots.push(shot);
        recordingRef.current?.updateCountdown(null, index);
        recordingRef.current?.markShot(shot);
        setShots([...nextShots]);
        setFlash((value) => value + 1);
        setCountdown(null);
      }
      const recording = recordingRef.current;
      if (recording) {
        setVideoStatus((previous) => previous === "failed" ? previous : "finishing");
        if (!await wait(1100) || !current()) return;
        const file = await recording.finish();
        if (!current()) return;
        recordingRef.current = null;
        setRecordedVideo(file);
        setVideoStatus(file ? "ready" : "failed");
      }
      notify("Đã chụp đủ 3 kiểu ảnh. Cậu có thể lưu khung ảnh vào máy rồi nhé!");
    } catch {
      recordingRef.current?.cancel();
      recordingRef.current = null;
      if (current()) {
        setVideoStatus((previous) => previous === "recording" || previous === "finishing" ? "failed" : previous);
        setError("Chưa chụp được ảnh từ camera. Cậu chờ hình ảnh hiện rõ rồi nhấn chụp lại nhé!");
      }
    } finally {
      if (mounted.current && version === captureVersion.current) {
        captureActive.current = false;
        setCapturing(false);
        setCountdown(null);
      }
    }
  };

  const resetPhotos = () => {
    cancelCapture();
    clearVideo();
    uploadController.current?.abort();
    uploadActive.current = false;
    setUploading(false);
    setShots([]);
    setPose(0);
    setError("");
  };

  const selectPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length !== PHOTOBOOTH_SHOTS) {
      setError("Cậu chọn đủ 3 ảnh cùng một lần để ghép vào khung nhé!");
      return;
    }
    if (files.some((file) => !file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size > 20 * 1024 * 1024)) {
      setError("Cậu chọn 3 ảnh JPG, PNG hoặc ảnh thông thường, mỗi ảnh dưới 20MB nhé!");
      return;
    }
    stopCamera();
    clearVideo();
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    uploadActive.current = true;
    setUploading(true);
    setError("");
    try {
      const nextShots: string[] = [];
      for (const file of files) nextShots.push(await readLocalPhoto(file, controller.signal));
      if (!mounted.current || controller.signal.aborted) return;
      setShots(nextShots);
      notify("Đã ghép 3 ảnh của cậu vào khung Digimar 66D.");
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Chưa đọc được ảnh. Cậu chọn lại 3 ảnh khác nhé!");
    } finally {
      if (mounted.current && uploadController.current === controller) {
        uploadActive.current = false;
        setUploading(false);
      }
    }
  };

  const savePhotos = async () => {
    if (!preparedFile || savingActive.current || uploadActive.current || captureActive.current) return;
    savingActive.current = true;
    setSaving(true);
    try {
      // Keep the device's picker/share sheet within the original button tap.
      const result = await saveImage(preparedFile);
      if (!mounted.current) return;
      if (result === "saved") notify("Khung ảnh đã được lưu vào nơi cậu chọn.");
      else if (result === "shared") notify("Khung ảnh đã được chuyển tới ứng dụng cậu chọn.");
      else if (result === "downloaded") notify("Ảnh đã được tạo. Cậu kiểm tra thư mục Tải xuống nhé!");
      else if (result === "preview") setPreviewOpen(true);
    } catch {
      if (mounted.current) setPreviewOpen(true);
    } finally {
      savingActive.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const saveRecording = async () => {
    if (!recordedVideo || savingActive.current || uploadActive.current || captureActive.current) return;
    savingActive.current = true;
    setSavingVideo(true);
    try {
      // Pass the already prepared file to the native picker within this tap.
      const result = await saveVideo(recordedVideo);
      if (!mounted.current) return;
      if (result === "saved") notify("Video đã được lưu vào nơi cậu chọn.");
      else if (result === "shared") notify("Video đã được chuyển tới ứng dụng cậu chọn.");
      else if (result === "downloaded") notify("Cậu kiểm tra video trong thư mục Tải xuống nhé!");
      else if (result === "preview") setVideoOpen(true);
    } catch {
      if (mounted.current) setVideoOpen(true);
    } finally {
      savingActive.current = false;
      if (mounted.current) setSavingVideo(false);
    }
  };

  const status = uploading ? "Đang ghép 3 ảnh của cậu…"
    : capturing ? videoStatus === "finishing" ? "Đã đủ 3 ảnh, đang hoàn thiện video…" : `Kiểu ảnh ${pose + 1} trên ${PHOTOBOOTH_SHOTS} · sẵn sàng trong ${countdown ?? 1} giây`
      : shots.length === PHOTOBOOTH_SHOTS ? "Đủ 3 khoảnh khắc đáng yêu rồi!"
        : cameraState === "starting" ? "Cậu cho phép trình duyệt dùng camera nhé!"
          : cameraState === "on" ? cameraReady ? "Camera đã sẵn sàng. Cậu tạo dáng nhé!" : "Đang chờ hình ảnh từ camera…"
            : "Bật camera hoặc chọn 3 ảnh để bắt đầu nhé!";

  return (
    <main className="photobooth-page page-shell" id="main-content" tabIndex={-1}>
      <header className="photobooth-heading">
        <p className="photobooth-eyebrow"><span />CHƯƠNG 05 · GIỮ MỘT CHÚT ĐÁNG YÊU<span /></p>
        <h1>Photobooth của chúng mình <Heart size={26} aria-hidden="true" /></h1>
        <p>Ba kiểu tạo dáng, một chiếc khung xinh. Giữ lại một chút thanh xuân cùng Digimar 66D nhé!</p>
      </header>

      <div className="photobooth-layout">
        <section className="photobooth-camera-panel" aria-labelledby="photobooth-camera-title">
          <div className="photobooth-panel-topline">
            <h2 id="photobooth-camera-title"><Camera size={18} aria-hidden="true" /> Góc chụp của cậu</h2>
            <span className={`photobooth-camera-indicator${cameraState === "on" && cameraReady ? " is-on" : ""}`}>
              <i />{cameraState === "on" ? "Camera trước" : "Hello, lovely!"}
            </span>
          </div>
          <div className="photobooth-camera-view">
            <video
              ref={videoRef}
              className={cameraState === "on" && cameraReady ? "is-ready" : ""}
              data-testid="photobooth-camera"
              autoPlay muted playsInline
              aria-label="Hình ảnh trực tiếp từ camera trước"
              onLoadedData={updateVideoReady}
              onCanPlay={updateVideoReady}
              onEmptied={() => setCameraReady(false)}
              onError={() => {
                if (!streamRef.current) return;
                stopCamera();
                setError("Camera chưa hiển thị được hình ảnh. Cậu nhấn Bật camera để thử lại nhé!");
              }}
            />
            {!(cameraState === "on" && cameraReady) && (
              <div className="photobooth-camera-empty">
                {cameraState === "starting" || cameraState === "on"
                  ? <LoaderCircle className="photobooth-spinning" size={38} strokeWidth={1.1} aria-hidden="true" />
                  : <Camera size={45} strokeWidth={1.1} aria-hidden="true" />}
                <strong>{cameraState === "off" ? "Cậu đứng vào khung nhé" : "Một chút xíu nữa thôi…"}</strong>
                <span>{cameraState === "off" ? "Mỉm cười, mọi khoảnh khắc đều xinh ♡" : "Đang chuẩn bị camera cho cậu"}</span>
              </div>
            )}
            <span className="photobooth-view-corner photobooth-view-corner-tl" aria-hidden="true" />
            <span className="photobooth-view-corner photobooth-view-corner-tr" aria-hidden="true" />
            <span className="photobooth-view-corner photobooth-view-corner-bl" aria-hidden="true" />
            <span className="photobooth-view-corner photobooth-view-corner-br" aria-hidden="true" />
            {countdown !== null && <div className="photobooth-countdown" data-testid="photobooth-countdown" aria-hidden="true"><span>{countdown}</span><small>kiểu {pose + 1} / {PHOTOBOOTH_SHOTS}</small></div>}
            {flash > 0 && <div key={flash} className="photobooth-flash" aria-hidden="true" />}
            <span className="photobooth-view-caption" aria-hidden="true">Digimar 66D</span>
          </div>

          <div className="photobooth-progress" aria-label={`Đã có ${shots.length} trên ${PHOTOBOOTH_SHOTS} ảnh`}>
            {Array.from({ length: PHOTOBOOTH_SHOTS }, (_, index) => <span key={index} className={shots.length > index ? "is-complete" : capturing && pose === index ? "is-current" : ""}>{shots.length > index ? <Check size={13} aria-hidden="true" /> : index + 1}</span>)}
            <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
          </div>

          {error && <p className="photobooth-error" role="alert">{error}</p>}

          <div className="photobooth-record-option">
            <label><input type="checkbox" checked={recordVideo} disabled={!videoSupported || capturing || uploading || busySaving} onChange={(event) => setRecordVideo(event.target.checked)} /><Video size={16} aria-hidden="true" />Ghi video cùng lượt chụp</label>
            <p>{videoSupported ? "Lưu cả lúc tạo dáng và hiệu ứng sau mỗi lần chụp, không thu âm." : "Trình duyệt này chưa hỗ trợ ghi video. Cậu vẫn chụp và lưu ảnh bình thường nhé!"}</p>
          </div>
          {(recordVideo || videoStatus !== "idle") && <p className={`photobooth-video-status${videoStatus === "recording" ? " is-recording" : ""}`} data-testid="photobooth-video-status" role="status" aria-live="polite">{videoStatus === "recording" ? "● Đang ghi video những khoảnh khắc của cậu…" : videoStatus === "finishing" ? "Đang giữ lại hiệu ứng cuối và chuẩn bị video…" : videoStatus === "ready" ? "Video đã sẵn sàng để xem và lưu vào máy." : videoStatus === "failed" ? "Chưa ghi được video trên trình duyệt này. Ảnh vẫn được giữ lại; cậu có thể thử một lượt mới nhé!" : "Video sẽ bắt đầu khi cậu nhấn Chụp 3 kiểu ảnh."}</p>}

          <div className="photobooth-camera-actions">
            {cameraState === "off" ? (
              <button type="button" className="button button-primary" onClick={startCamera} disabled={uploading || busySaving}><Camera size={17} aria-hidden="true" /> Bật camera</button>
            ) : (
              <>
                {!capturing && <button type="button" className="button button-primary" onClick={capturePhotos} disabled={!cameraReady || uploading || busySaving}><Camera size={17} aria-hidden="true" />Chụp 3 kiểu ảnh</button>}
                {capturing && <button type="button" className="button button-secondary" onClick={() => cancelCapture()}><X size={17} aria-hidden="true" />Hủy lượt chụp</button>}
                <button type="button" className="photobooth-text-button" onClick={() => stopCamera()}><CameraOff size={16} aria-hidden="true" />Tắt camera</button>
              </>
            )}
          </div>

          <div className="photobooth-upload">
            <span className="photobooth-or">hoặc</span>
            <input ref={uploadRef} className="photobooth-file-input" type="file" accept="image/*" multiple aria-label="Chọn 3 ảnh có sẵn" onChange={selectPhotos} disabled={capturing || uploading || busySaving} />
            <button type="button" className="photobooth-upload-button" onClick={() => uploadRef.current?.click()} disabled={capturing || uploading || busySaving}>
              {uploading ? <LoaderCircle className="photobooth-spinning" size={17} aria-hidden="true" /> : <ImagePlus size={17} aria-hidden="true" />}
              {uploading ? "Đang ghép ảnh…" : "Chọn 3 ảnh có sẵn"}
            </button>
            <p>Ảnh được xử lý ngay trên thiết bị của cậu.</p>
          </div>
          <div className="photobooth-tip"><Sparkles size={17} strokeWidth={1.5} aria-hidden="true" /><p>Mỗi kiểu có 3 giây để tạo dáng. Rủ thêm một người bạn vào khung cho vui nhé!</p></div>
        </section>

        <section className="photobooth-preview-panel" aria-labelledby="photobooth-preview-title">
          <div className="photobooth-preview-heading"><span aria-hidden="true">♡</span><h2 id="photobooth-preview-title">Chiếc khung của chúng mình</h2><span aria-hidden="true">♡</span></div>
          <div className="photobooth-strip-wrap" aria-busy={preparing}>
            <span className="photobooth-tape" aria-hidden="true" />
            {previewUrl ? <img className="photobooth-preview-image" src={previewUrl} alt={`Khung ảnh Digimar 66D, đã có ${composite?.shots.length ?? 0} trên 3 ảnh`} /> : (
              <div className="photobooth-strip-placeholder" aria-label="Khung ảnh Digimar 66D đang được chuẩn bị"><strong>Digimar 66D</strong>{[1, 2, 3].map((index) => <div key={index}><Heart size={20} strokeWidth={1.2} aria-hidden="true" /><span>{String(index).padStart(2, "0")}</span></div>)}<small>made with love ♡</small></div>
            )}
          </div>
          {imageError ? <div className="photobooth-image-error"><p role="alert">Chưa tạo được khung ảnh. Cậu nhấn thử lại nhé!</p><button type="button" className="photobooth-text-button" onClick={() => setImageAttempt((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" />Thử tạo lại ảnh</button></div>
            : <p className="photobooth-preview-note">{preparing && shots.length === PHOTOBOOTH_SHOTS ? "Đang chuẩn bị ảnh PNG cho cậu…" : "Một chiếc ảnh nhỏ, thật nhiều niềm vui ♡"}</p>}
          <div className="photobooth-result-actions">
            <button type="button" className="button button-primary photobooth-save-button" onClick={savePhotos} disabled={!preparedFile || preparing || capturing || uploading || busySaving}>
              {saving || (preparing && shots.length === PHOTOBOOTH_SHOTS) ? <LoaderCircle className="photobooth-spinning" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
              {saving ? "Đang lưu ảnh…" : "Lưu ảnh vào máy"}
            </button>
            {preparedFile && <button type="button" className="photobooth-text-button" onClick={() => setPreviewOpen(true)} disabled={capturing || uploading || busySaving}><ImagePlus size={15} aria-hidden="true" />Xem khung ảnh</button>}
            {recordedVideo && <div className="photobooth-video-actions"><button type="button" className="button button-secondary" onClick={saveRecording} disabled={capturing || uploading || busySaving}>{savingVideo ? <LoaderCircle className="photobooth-spinning" size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}{savingVideo ? "Đang lưu video…" : "Lưu video"}</button><button type="button" className="photobooth-text-button" onClick={() => setVideoOpen(true)} disabled={busySaving}><Play size={15} aria-hidden="true" />Xem video</button></div>}
            {shots.length > 0 && !capturing && <button type="button" className="photobooth-text-button" onClick={resetPhotos} disabled={uploading || busySaving}><RefreshCw size={15} aria-hidden="true" />Chụp lại</button>}
          </div>
          <p className="photobooth-save-help">{mobile ? "Chọn Lưu hình ảnh trong bảng chia sẻ, hoặc nhấn giữ ảnh để lưu." : "Khung ảnh được lưu thành PNG, gồm cả ảnh và trang trí."}</p>
        </section>
      </div>

      <dialog ref={saveDialogRef} className="save-image-dialog photobooth-save-dialog" aria-labelledby="photobooth-save-title" aria-describedby="photobooth-save-help" onCancel={() => setPreviewOpen(false)} onClose={() => setPreviewOpen(false)}>
        <button className="save-image-close" type="button" aria-label="Đóng khung ảnh" onClick={() => setPreviewOpen(false)}><X size={21} aria-hidden="true" /></button>
        <h2 id="photobooth-save-title">Lưu khung ảnh vào máy</h2>
        <p id="photobooth-save-help">{mobile ? "Nhấn giữ ảnh bên dưới rồi chọn Lưu vào Ảnh hoặc Tải hình ảnh xuống." : "Chọn Tải ảnh PNG để lưu vào máy theo thiết lập của trình duyệt."}</p>
        {previewUrl && <img className="save-image-full" src={previewUrl} alt="Khung photobooth Digimar 66D đầy đủ để lưu vào máy" />}
        <div className="save-image-options">
          <button type="button" className="button button-primary" onClick={() => { if (preparedFile) { downloadImage(preparedFile); notify("Đã yêu cầu tải ảnh PNG. Cậu kiểm tra mục tải xuống nhé!"); } }}><Download size={18} aria-hidden="true" />Tải ảnh PNG</button>
          {previewUrl && <a className="button button-secondary" href={previewUrl} target="_blank" rel="noopener noreferrer">Mở ảnh riêng</a>}
        </div>
      </dialog>

      <dialog ref={videoDialogRef} className="save-image-dialog photobooth-video-dialog" aria-labelledby="photobooth-video-title" aria-describedby="photobooth-video-help" onCancel={() => setVideoOpen(false)} onClose={() => { videoDialogRef.current?.querySelector("video")?.pause(); setVideoOpen(false); }}>
        <button className="save-image-close" type="button" aria-label="Đóng video" onClick={() => setVideoOpen(false)}><X size={21} aria-hidden="true" /></button>
        <h2 id="photobooth-video-title">Video photobooth của cậu</h2>
        <p id="photobooth-video-help">{mobile ? "Chọn tải video hoặc mở riêng để lưu theo trình duyệt của cậu." : "Xem lại những lúc tạo dáng và hiệu ứng sau mỗi kiểu ảnh."}</p>
        {recordingUrl && <video data-testid="photobooth-video-preview" className="photobooth-recorded-video" src={recordingUrl} controls playsInline preload="metadata" />}
        <div className="save-image-options"><button type="button" className="button button-primary" onClick={() => { if (recordedVideo) { downloadVideo(recordedVideo); notify("Đã yêu cầu tải video. Cậu kiểm tra mục tải xuống nhé!"); } }}><Download size={18} aria-hidden="true" />Tải video {recordedVideo?.type.startsWith("video/mp4") ? "MP4" : "WebM"}</button>{recordingUrl && <a className="button button-secondary" href={recordingUrl} target="_blank" rel="noopener noreferrer">Mở video riêng</a>}</div>
      </dialog>
    </main>
  );
}
