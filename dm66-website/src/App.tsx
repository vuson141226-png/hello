import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Download,
  Flower2,
  Heart,
  HeartHandshake,
  Mail,
  Music2,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { Girl } from "./data/girls";
import { findWishRecipient, loadRecipients } from "./lib/recipientLookup";
import type { WishRecipient } from "./lib/recipientLookup";
import { createCardImage } from "./lib/cardImage";
import { downloadImage, isMobileDevice, saveImage } from "./lib/saveImage";
import { Envelope } from "./components/Envelope";
import { siteConfig } from "./config";
import { MemoriesPage } from "./pages/MemoriesPage";
import { LettersPage } from "./pages/LettersPage";
import { AdminLettersPage } from "./pages/AdminLettersPage";
import { AnniversaryGallery, AnniversaryHero } from "./components/AnniversaryExperience";
import { PhotoboothPage } from "./pages/PhotoboothPage";

type Page = "welcome" | "our-girls" | "our-memories" | "your-wish" | "letters-to-boys" | "photobooth" | "admin";
const readPage = (): Page => {
  const page = window.location.hash.replace(/^#\/?/, "");
  if (page === "our-girls") return "our-memories";
  return page === "our-memories" || page === "your-wish" || page === "letters-to-boys" || page === "photobooth" || page === "admin" ? page : "welcome";
};
const pageLinks: { page: Page; label: string; short: string }[] = [
  { page: "welcome", label: "Lời chào", short: "Chào cậu" },
  { page: "our-memories", label: "Kỷ niệm của chúng mình", short: "Kỷ niệm" },
  { page: "your-wish", label: "Lời chúc riêng", short: "Lời chúc" },
  { page: "letters-to-boys", label: "Thư gửi các bạn nam", short: "Gửi thư" },
  { page: "photobooth", label: "Photobooth", short: "Chụp ảnh" },
];

function Bow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 66 42"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M32 20C16-5 0 5 8 20c5 8 18 4 24 0ZM34 20C50-5 66 5 58 20c-5 8-18 4-24 0Z"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      <path
        d="M31 23 22 38l9-3 2-12 3 12 9 3-10-15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <ellipse cx="33" cy="21" rx="4" ry="5" fill="currentColor" />
    </svg>
  );
}

function Portrait({
  girl,
  ...props
}: {
  girl: Girl;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <img
      src={girl.image}
      alt={
        girl.isPlaceholder || girl.image.endsWith("/portrait-placeholder.svg")
          ? "Khung hoa tulip minh họa"
          : `Ảnh ${girl.fullName}`
      }
      {...props}
      onError={(event) => {
        const target = event.currentTarget;
        if (!target.src.endsWith("/images/portrait-placeholder.svg"))
          target.src = "/images/portrait-placeholder.svg";
      }}
    />
  );
}

function HeartBurst({ burst }: { burst: number }) {
  const reduced = useReducedMotion();
  return (
    <div className="heart-burst" aria-hidden="true">
      <AnimatePresence>
        {burst > 0 &&
          !reduced &&
          Array.from({ length: 16 }, (_, i) => (
            <motion.span
              key={`${burst}-${i}`}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
              animate={{
                opacity: [0, 1, 1, 0],
                x: Math.cos(i * 2.4) * (130 + i * 13),
                y: -150 - (i % 5) * 88,
                rotate: i * 30,
                scale: [0.3, 1, 0.7],
              }}
              transition={{ duration: 1.8 + (i % 3) * 0.3, delay: i * 0.025 }}
            >
              <Heart size={12 + (i % 4) * 5} fill="currentColor" />
            </motion.span>
          ))}
      </AnimatePresence>
    </div>
  );
}

function Ambient() {
  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient-heart ah-1">♡</span>
      <span className="ambient-heart ah-2">♡</span>
      <span className="ambient-heart ah-3">♡</span>
      <span className="ambient-star as-1">✧</span>
      <span className="ambient-star as-2">✧</span>
      <span className="ambient-star as-3">✦</span>
      <span className="petal p-1" />
      <span className="petal p-2" />
      <span className="petal p-3" />
    </div>
  );
}

function Welcome({
  navigate,
  celebrate,
}: {
  navigate: (page: Page) => void;
  celebrate: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const openGift = () => {
    if (opening) return;
    setOpening(true);
    celebrate();
    timer.current = setTimeout(
      () => navigate("our-girls"),
      reduced ? 100 : 1250,
    );
  };
  const moveArt = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== "mouse") return;
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--art-x",
      `${(event.clientX - left - width / 2) / 45}px`,
    );
    event.currentTarget.style.setProperty(
      "--art-y",
      `${(event.clientY - top - height / 2) / 45}px`,
    );
  };
  return (
    <>
      <main className="welcome-page page-shell" id="main-content" tabIndex={-1}>
        <div className="welcome-copy">
          <div className="eyebrow">
            <span className="little-line" /> A LITTLE SURPRISE FOR OUR GIRLS
          </div>
          <h1>
            Gửi cậu,
            <br />
            một chút
            <br />
            <em>yêu thương.</em>
            <span className="title-star">✧</span>
          </h1>
          <p className="welcome-dedication">
            Gửi những cô gái đặc biệt của
            <br className="mobile-break" />{" "}
            <strong>lớp Digital Marketing 66D</strong>{" "}
            <Heart size={15} fill="currentColor" />
          </p>
          <p className="welcome-description">
            Nhân ngày 20/10, chúng tớ đã chuẩn bị một món quà nho nhỏ dành riêng
            cho những cô gái tuyệt vời của DM66D. Hy vọng món quà này sẽ khiến
            các cậu mỉm cười!
          </p>
          <button
            className="button button-primary gift-button"
            onClick={openGift}
            disabled={opening}
          >
            <Mail size={19} />
            <span>
              {opening ? "Đang mở điều bất ngờ..." : "Mở món quà của chúng tớ"}
            </span>
            <ArrowRight size={18} />
          </button>
          <div className="handwritten-note">
            <svg viewBox="0 0 45 35" aria-hidden="true">
              <path d="M4 29Q8 7 38 8m-8-5 9 5-8 7" />
            </svg>
            <span>Có một điều dễ thương đang đợi cậu!</span>
          </div>
        </div>
        <div
          className="welcome-visual"
          onPointerMove={moveArt}
          onPointerLeave={(event) => {
            event.currentTarget.style.setProperty("--art-x", "0px");
            event.currentTarget.style.setProperty("--art-y", "0px");
          }}
        >
          <div className="date-tag">
            <span>HAPPY VIETNAMESE WOMEN’S DAY</span>
            <strong>
              20 <span>·</span> 10 <span>·</span> 2026
            </strong>
            <span className="date-tag-script">
              Một ngày thật đẹp, dành cho cậu.
            </span>
          </div>
          <div className="hero-envelope">
            <Envelope open={opening} />
          </div>
          <div className="visual-caption">
            <span className="caption-line" />
            <Heart size={12} />
            <span>Gói ghém bằng tất cả sự chân thành</span>
          </div>
          <span className="visual-side-label">
            TO OUR FAVORITE GIRLS, WITH LOVE.
          </span>
        </div>
        <div className="welcome-bottom">
          <div className="bottom-manifesto">
            <span className="mini-flower">
              <Flower2 size={32} strokeWidth={1.2} />
            </span>
            <p>
              Mỗi cậu là một sắc màu.
              <br />
              <strong>Cùng nhau, chúng mình là DM66D.</strong>
            </p>
          </div>
          <div className="experience-chips">
            <span>
              <Mail size={16} />
              Một món quà nhỏ
            </span>
            <i />
            <span>
              <Sparkles size={16} />
              Một chút bất ngờ
            </span>
            <i />
            <span>
              <Heart size={16} />
              Thật nhiều yêu thương
            </span>
          </div>
          <button
            className="round-button journey-down"
            onClick={openGift}
            disabled={opening}
            aria-label="Bắt đầu hành trình"
          >
            <ArrowDown size={18} />
          </button>
        </div>
      </main>
    </>
  );
}

function GreetingCard({
  girl,
  cardRef,
  replay,
  anniversary = false,
}: {
  girl: Girl;
  cardRef: React.RefObject<HTMLDivElement | null>;
  replay: number;
  anniversary?: boolean;
}) {
  return (
    <div className="greeting-card" ref={cardRef}>
      <div className="card-topline">
        <span>{anniversary ? "SƠN & PHƯƠNG" : "DIGITAL MARKETING 66D"}</span>
        <Heart size={15} />
        <span>20.10.2026</span>
      </div>
      <div className="card-body">
        <div className="card-portrait-panel">
          <div className="card-photo">
            <Portrait girl={girl} />
            <Bow className="card-photo-bow" />
            {girl.isPlaceholder && (
              <span className="sample-sticker">THIỆP MẪU</span>
            )}
          </div>
        </div>
        <div className="card-message">
          <span className="card-dear">Dear {girl.displayName},</span>
          <h2>
            {anniversary
              ? <>Chúc mừng <em>1 tháng yêu nhau!</em></>
              : <>Chúc mừng ngày <em>20/10!</em></>}
          </h2>
          <motion.div
            key={replay}
            className="card-letter"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.18 } },
            }}
          >
            {(girl.wish.trim()
              ? girl.wish
              : "Lời chúc riêng của cậu đang được chuẩn bị."
            )
              .split(/\n+/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <motion.p
                  key={index}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.45 }}
                >
                  {paragraph}
                </motion.p>
              ))}
          </motion.div>
          {girl.isPlaceholder && (
            <p className="card-placeholder-note">
              Đây là thiệp từ dữ liệu thử. Ảnh hiện dùng hình mẫu; các phần còn
              thiếu đang được chuẩn bị.
            </p>
          )}
          <div className="card-signature">
            <Heart size={18} fill="currentColor" />
            <span>{girl.senderName ? `From ${girl.senderName} — With Love` : "With Love"}</span>
            <small>{anniversary
              ? "MỘT THÁNG BÊN NHAU · THẬT NHIỀU YÊU THƯƠNG"
              : "YOU MAKE OUR CLASS BRIGHTER."}</small>
          </div>
        </div>
      </div>
      <div className="card-corner-flower">
        <Flower2 size={36} strokeWidth={1} />
      </div>
    </div>
  );
}

function WishPage({
  celebrate,
  notify,
  onWriteLetter,
}: {
  celebrate: () => void;
  notify: (message: string) => void;
  onWriteLetter: (senderName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [matchedRecipient, setMatchedRecipient] = useState<WishRecipient | null>(null);
  const [selectedWishId, setSelectedWishId] = useState("");
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [cardImage, setCardImage] = useState<{
    imageKey: string;
    file: File;
  } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [replay, setReplay] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const directory = useRef<WishRecipient[] | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const saveDialogRef = useRef<HTMLDialogElement>(null);
  const mounted = useRef(true);
  const reduced = useReducedMotion();
  const selectedWish = matchedRecipient?.wishes.find((wish) => wish.id === selectedWishId);
  const anniversary = matchedRecipient?.anniversary;
  const recipient = useMemo<Girl | null>(() => matchedRecipient ? ({
    ...matchedRecipient, nicknames: [], wish: selectedWish?.message ?? "",
    senderName: selectedWish?.senderName,
    image: selectedWish?.image ?? matchedRecipient.image,
  }) : null, [matchedRecipient, selectedWish]);
  const imageKey = selectedWish && recipient ? `${recipient.id}/${selectedWish.id}` : null;
  const preparedImage = cardImage?.imageKey === imageKey ? cardImage : null;
  const mobile = isMobileDevice();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ++requestVersion.current;
      requestController.current?.abort();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setCardImage(null);
    setImageError(false);
    setPreviewOpen(false);
    const source = cardRef.current;
    if (!source || !recipient || !imageKey) {
      setPreparingImage(false);
      return;
    }
    setPreparingImage(true);
    createCardImage(source, recipient.id)
      .then((file) => {
        if (!cancelled) setCardImage({ imageKey, file });
      })
      .catch(() => {
        if (!cancelled) setImageError(true);
      })
      .finally(() => {
        if (!cancelled) setPreparingImage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipient, imageKey, imageAttempt]);
  useEffect(() => {
    if (!preparedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(preparedImage.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preparedImage]);
  useEffect(() => {
    const dialog = saveDialogRef.current;
    if (!dialog) return;
    if (previewOpen && previewUrl && !dialog.open) dialog.showModal();
    else if (!previewOpen && dialog.open) dialog.close();
  }, [previewOpen, previewUrl]);
  useEffect(() => {
    if (recipient) resultRef.current?.focus({ preventScroll: true });
  }, [recipient]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (opening) return;
    setError("");
    if (!query.trim()) {
      setError("Cậu cho chúng tớ biết tên trước nhé!");
      inputRef.current?.focus();
      return;
    }
    if (!studentCode.trim()) {
      setError("Cậu nhập mã sinh viên để tìm lời chúc nhé!");
      document.getElementById("recipient-code")?.focus();
      return;
    }
    setOpening(true);
    const controller = new AbortController();
    requestController.current = controller;
    const version = ++requestVersion.current;
    try {
      const recipients = directory.current ?? await loadRecipients(controller.signal);
      if (!mounted.current || requestVersion.current !== version) return;
      directory.current = recipients;
      const match = findWishRecipient(query, studentCode, recipients);
      if (!match) {
        setError("Tên hoặc mã sinh viên chưa đúng. Cậu kiểm tra lại nhé!");
        return;
      }
      setMatchedRecipient(match);
      setSelectedWishId(match.anniversary?.kind === "one-month"
        ? match.wishes[0]?.id ?? ""
        : "");
      celebrate();
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      if (!mounted.current || requestVersion.current !== version || controller.signal.aborted) return;
      setError("Chưa tải được danh sách lời chúc. Cậu nhấn thử lại nhé!");
    } finally {
      if (mounted.current && requestVersion.current === version) setOpening(false);
    }
  };
  const reset = () => {
    requestController.current?.abort();
    ++requestVersion.current;
    setMatchedRecipient(null);
    setSelectedWishId("");
    setStudentCode("");
    setQuery("");
    setCardImage(null);
    setPreviewOpen(false);
    setError("");
    setReplay(0);
    setOpening(false);
    setTimeout(() => { if (mounted.current) inputRef.current?.focus(); }, 0);
  };
  const chooseWish = (id: string) => {
    setSelectedWishId(id);
    setCardImage(null);
    setPreviewOpen(false);
    setReplay((value) => value + 1);
  };
  const saveCard = async () => {
    if (!preparedImage || saving) return;
    setSaving(true);
    try {
      // No await before saveImage: native pickers/sharing need this click's activation.
      const result = await saveImage(preparedImage.file);
      if (!mounted.current) return;
      if (result === "saved") notify("Thiệp đã được lưu vào nơi cậu chọn.");
      else if (result === "shared")
        notify("Ảnh thiệp đã được chuyển tới ứng dụng cậu chọn.");
      else if (result === "downloaded")
        notify("Thiệp đã được tạo. Cậu kiểm tra thư mục Tải xuống nhé!");
      else if (result === "preview") setPreviewOpen(true);
    } catch {
      if (mounted.current) setPreviewOpen(true);
    } finally {
      if (mounted.current) setSaving(false);
    }
  };
  if (recipient)
    return (
      <main className={`result-page page-shell${anniversary ? " anniversary-page" : ""}`} id="main-content" tabIndex={-1}>
        {anniversary ? (
          <AnniversaryHero headingRef={resultRef} celebrationKey={replay} />
        ) : <div className="section-heading result-heading">
          <div className="eyebrow">
            <Heart size={13} /> MỘT LỜI NHẮN, CHỈ DÀNH CHO CẬU
          </div>
          <h1 ref={resultRef} tabIndex={-1}>
            Cậu xứng đáng với <em>những điều thật đẹp.</em>
          </h1>
        </div>}
        {!anniversary && <section className={`wish-selection ${selectedWish ? "" : "wish-notice"}`} aria-label="Những lời chúc dành cho cậu">
          <p className="wish-count" aria-live="polite">Cậu có <strong>{matchedRecipient?.wishes.length ?? 0} lời chúc</strong> dành cho mình.</p>
          {selectedWish ? <>
            <label htmlFor="selected-wish">Chọn lời chúc muốn đọc</label>
            <select id="selected-wish" value={selectedWish.id} onChange={(event) => chooseWish(event.target.value)}>
              {matchedRecipient?.wishes.map((wish, index) => <option key={wish.id} value={wish.id}>
                {index + 1}. {wish.title || "Một lời chúc dành cho cậu"}{wish.senderName ? ` · ${wish.senderName}` : ""}
              </option>)}
            </select>
            <button className="text-button wish-list-back" onClick={() => chooseWish("")}>Xem danh sách lời chúc</button>
          </> : <>
            <span className="wish-notice-name">Gửi {recipient.displayName},</span>
            {!!matchedRecipient?.wishes.length && <>
              <p>Nhấn vào từng lời chúc bên dưới để mở thiệp nhé!</p>
              <ul className="wish-choice-list">
                {matchedRecipient.wishes.map((wish, index) => <li key={wish.id}>
                  <button className="wish-choice" onClick={() => chooseWish(wish.id)}>
                    <span className="wish-choice-icon"><Mail size={22} /></span>
                    <span><strong>Đọc lời chúc {index + 1}</strong><span>{wish.title || "Một lời chúc dành cho cậu"}{wish.senderName ? ` · ${wish.senderName}` : ""}</span></span>
                    <ArrowRight size={18} />
                  </button>
                </li>)}
              </ul>
            </>}
            {!matchedRecipient?.wishes.length && <div className="wish-empty"><Mail size={34} /><p>Lời chúc của cậu đang được chuẩn bị.</p><p>Cậu quay lại sau một chút nhé!</p></div>}
            <button className="text-button find-another" onClick={reset}><Search size={15} />Nhập lại tên và mã sinh viên</button>
          </>}
        </section>}
        {selectedWish && <div className="result-layout">
          {anniversary && <p className="anniversary-letter-note">
            Một lá thư từ Sơn, dành riêng cho Phương trong ngày 20/10.
          </p>}
          <GreetingCard girl={recipient} cardRef={cardRef} replay={replay} anniversary={!!anniversary} />
          <aside className="card-actions">
            <Bow className="actions-bow" />
            <span className="actions-script">
              Một chút yêu thương,
              <br />
              cậu mang về nhé.
            </span>
            {selectedWish && <>
            <button
              className="button button-primary"
              onClick={
                imageError
                  ? () => setImageAttempt((value) => value + 1)
                  : saveCard
              }
              disabled={saving || preparingImage || (!preparedImage && !imageError)}
              aria-busy={preparingImage || saving}
            >
              <Download size={18} />
              {imageError
                ? "Thử tạo ảnh lại"
                : preparingImage || !preparedImage
                  ? "Đang chuẩn bị ảnh..."
                  : saving
                    ? "Đang mở bảng lưu..."
                    : "Lưu thiệp của mình"}
            </button>
            {imageError && (
              <p className="save-image-error" role="alert">
                Chưa tạo được ảnh thiệp. Cậu thử tạo lại nhé!
              </p>
            )}
            <button
              className="button button-secondary"
              onClick={() => {
                setReplay((value) => value + 1);
                cardRef.current?.scrollIntoView({
                  behavior: reduced ? "instant" : "smooth",
                  block: "center",
                });
              }}
            >
              <RotateCcw size={17} />
              Đọc lại lời chúc
            </button>
            </>}
            <button
              className="button button-secondary"
              onClick={() => {
                celebrate();
                if (anniversary) setReplay((value) => value + 1);
                notify("Một trái tim, thật nhiều yêu thương. Cảm ơn cậu!");
              }}
            >
              <Heart size={18} />
              Gửi một trái tim
            </button>
            {mobile && selectedWish && (
              <button
                className="text-button save-image-preview"
                disabled={!preparedImage || saving}
                onClick={() => setPreviewOpen(true)}
              >
                Mở ảnh để lưu vào máy
              </button>
            )}
            <button
              className="text-button find-another"
              onClick={reset}
              disabled={saving}
            >
              <Search size={15} />
              Nhập lại tên và mã sinh viên
            </button>
            {selectedWish && <p className="actions-footnote">
              {mobile
                ? "Chọn Lưu hình ảnh trong bảng chia sẻ, hoặc mở ảnh và nhấn giữ để lưu."
                : "Chọn nơi lưu ảnh PNG. Nếu trình duyệt tự tải, cậu kiểm tra thư mục Tải xuống nhé."}
            </p>}
          </aside>
        </div>}
        {anniversary ? <>
          <AnniversaryGallery images={anniversary.images} />
          <div className="anniversary-closing">
            <Heart size={25} strokeWidth={1.2} />
            <p>Một tháng đầu tiên, và còn thật nhiều kỷ niệm đang chờ chúng mình.</p>
            <span>Sơn ♡ Phương</span>
          </div>
        </> : <section className="wish-letter-transition" aria-label="Một lời nhắn gửi lại">
          <p>Chúng tớ đã gửi những lời chúc của mình rồi. Còn cậu, có điều gì muốn nhắn gửi đến những chàng trai DM66D không? 💗</p>
          <button className="button button-primary" onClick={() => onWriteLetter(recipient.fullName)}>
            <Mail size={18} /> 💌 Gửi lời nhắn đến các bạn nam
          </button>
        </section>}
        <dialog
          ref={saveDialogRef}
          className="save-image-dialog"
          aria-labelledby="save-image-title"
          aria-describedby="save-image-help"
          onCancel={() => setPreviewOpen(false)}
          onClose={() => setPreviewOpen(false)}
        >
          <button
            className="save-image-close"
            aria-label="Đóng ảnh thiệp"
            onClick={() => setPreviewOpen(false)}
          >
            <X size={21} />
          </button>
          <h2 id="save-image-title">Lưu thiệp vào máy</h2>
          <p id="save-image-help">
            {mobile
              ? "Nhấn giữ ảnh bên dưới rồi chọn Lưu vào Ảnh hoặc Tải hình ảnh xuống."
              : "Chọn Tải ảnh PNG để lưu vào máy theo thiết lập của trình duyệt."}
          </p>
          {previewUrl && (
            <img
              className="save-image-full"
              src={previewUrl}
              alt={`Thiệp chúc mừng dành cho ${recipient.fullName}`}
            />
          )}
          <div className="save-image-options">
            <button
              className="button button-primary"
              onClick={() => {
                if (!preparedImage) return;
                downloadImage(preparedImage.file);
                notify("Đã yêu cầu tải ảnh PNG. Cậu kiểm tra mục tải xuống của trình duyệt nhé!");
              }}
            >
              <Download size={18} />Tải ảnh PNG
            </button>
            {previewUrl && (
              <a
                className="button button-secondary"
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở ảnh riêng
              </a>
            )}
          </div>
        </dialog>
      </main>
    );
  return (
    <main className="wish-page page-shell" id="main-content" tabIndex={-1}>
      <div className="wish-intro">
        <div className="eyebrow">
          <span className="little-line" /> CHƯƠNG 03 · VIẾT RIÊNG CHO CẬU
        </div>
        <h1>
          Giữa rất nhiều
          <br />
          lời chúc,
          <br />
          <em>
            có một lời
            <br />
            dành cho cậu.
          </em>
        </h1>
        <p>
          Một lời nhắn nhỏ, một chút chân thành.
          <br />
          Và thật nhiều điều chúng tớ muốn gửi gắm.
        </p>
        <div className="wish-quote">
          <HeartHandshake size={27} strokeWidth={1.2} />
          <span>
            Vì mỗi cô gái của DM66D
            <br />
            đều đặc biệt theo cách rất riêng.
          </span>
        </div>
      </div>
      <div className="wish-form-paper">
        <span className="paper-tape" />
        <div className="wish-envelope">
          <Envelope compact open={opening} />
        </div>
        <span className="form-script">Someone has a message for you</span>
        <h2>Mở lời nhắn của cậu</h2>
        <p>Nhập họ tên và mã sinh viên để xem cậu có bao nhiêu lời chúc nhé.</p>
        <form onSubmit={submit} noValidate autoComplete="off">
          <label htmlFor="recipient-name">Tên của cậu là gì?</label>
          <div className={`name-input-wrap ${error ? "input-error" : ""}`}>
            <Heart size={18} />
            <input
              ref={inputRef}
              id="recipient-name"
              type="text"
              placeholder="Nhập tên của cậu vào đây nhé..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setError("");
              }}
              autoComplete="off"
              maxLength={150}
              aria-invalid={!!error}
              aria-describedby={error ? "name-error" : "name-hint"}
              disabled={opening}
            />
          </div>
          <p className="input-hint" id="name-hint">
            Dùng tên đầy đủ của cậu trong danh sách người nhận.
          </p>
          <label htmlFor="recipient-code">Mã sinh viên của cậu</label>
          <div className={`name-input-wrap ${error ? "input-error" : ""}`}>
            <Heart size={18} />
            <input id="recipient-code" type="text" value={studentCode}
              onChange={(event) => { setStudentCode(event.target.value); setError(""); }}
              placeholder="Nhập mã sinh viên" autoComplete="off" maxLength={100}
              aria-invalid={!!error} aria-describedby={error ? "name-error" : "code-hint"}
              disabled={opening} />
          </div>
          <p className="input-hint" id="code-hint">Dùng mã sinh viên của cậu trong danh sách người nhận.</p>
          <AnimatePresence>
            {error && (
              <motion.p
                id="name-error"
                className="form-error"
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <button
            className="button button-primary"
            type="submit"
            disabled={opening}
          >
            <Mail size={18} />
            {opening ? "Đang tìm lời chúc..." : "Nhận lời chúc của mình"}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(readPage);
  const [letterSenderName, setLetterSenderName] = useState("");
  const [burst, setBurst] = useState(0);
  const [toast, setToast] = useState("");
  const [playing, setPlaying] = useState(false);
  const [audioInfo, setAudioInfo] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const change = () => {
      setPage(readPage());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const titles: Record<Page, string> = {
      welcome: "Gửi cậu, với yêu thương",
      "our-girls": "Kỷ niệm của chúng mình",
      "our-memories": "Kỷ niệm của chúng mình",
      "your-wish": "Lời chúc dành riêng cho cậu",
      "letters-to-boys": "Thư gửi các bạn nam",
      photobooth: "Photobooth · Digimar 66D",
      admin: "Quản trị lời nhắn",
    };
    document.title = `${titles[page]} · DM66D`;
  }, [page]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const navigate = (next: Page) => {
    const destination = next === "our-girls" ? "our-memories" : next;
    if (destination === page) return;
    window.location.hash = destination === "welcome" ? "#/" : `#/${destination}`;
    pageRef.current?.focus({ preventScroll: true });
  };
  const notify = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 5500);
  };
  const toggleMusic = async () => {
    if (!siteConfig.musicSrc) {
      setAudioInfo((value) => !value);
      return;
    }
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        notify("Chưa thể phát nhạc. Hãy kiểm tra tệp âm thanh và thử lại nhé.");
      }
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <Ambient />
        <a
          className="skip-link"
          href="#main-content"
          onClick={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>("main")?.focus();
          }}
        >
          Đến nội dung chính
        </a>
        <header className="site-header">
          <a
            href="#/"
            className="brand"
            aria-label="DM66D With Love — Trang chủ"
          >
            <span className="brand-mark">
              <Bow />
            </span>
            <span>
              <strong>
                DM66D<span className="brand-dot">.</span>
              </strong>
              <small>WITH LOVE, ALWAYS</small>
            </span>
          </a>
          <nav className="main-nav" aria-label="Hành trình món quà">
            {pageLinks.map((link, index) => (
              <a
                key={link.page}
                href={link.page === "welcome" ? "#/" : `#/${link.page}`}
                className={page === link.page ? "active" : ""}
                aria-current={page === link.page ? "page" : undefined}
              >
                <span className="nav-number">0{index + 1}</span>
                <span className="nav-label">{link.label}</span>
                <span className="nav-short">{link.short}</span>
                {page === link.page && <span className="nav-active-dot" />}
              </a>
            ))}
          </nav>
          <div className="header-love">
            <span>20.10.2026</span>
            <Heart size={15} />
          </div>
        </header>
        <section
          className="page-transition"
          ref={pageRef}
          tabIndex={-1}
          aria-label="Nội dung món quà"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -10 }}
              transition={{ duration: 0.3 }}
            >
              {page === "welcome" ? (
                <Welcome
                  navigate={navigate}
                  celebrate={() => setBurst((value) => value + 1)}
                />
              ) : page === "our-memories" ? (
                <MemoriesPage onContinue={() => navigate("your-wish")} />
              ) : page === "letters-to-boys" ? (
                <LettersPage
                  initialSenderName={letterSenderName}
                  onHome={() => navigate("welcome")}
                  onCelebrate={() => setBurst((value) => value + 1)}
                />
              ) : page === "photobooth" ? (
                <PhotoboothPage notify={notify} />
              ) : page === "admin" ? (
                <AdminLettersPage onHome={() => navigate("welcome")} />
              ) : (
                <WishPage
                  celebrate={() => setBurst((value) => value + 1)}
                  notify={notify}
                  onWriteLetter={(senderName) => {
                    setLetterSenderName(senderName);
                    navigate("letters-to-boys");
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
        <footer className="site-footer">
          <p>
            Được chuẩn bị bằng <Heart size={11} fill="currentColor" /> bởi những
            chàng trai DM66D
          </p>
          <span>TO OUR GIRLS · YOU MAKE OUR CLASS BRIGHTER</span>
          <a href="#/" aria-label="Trở về đầu hành trình">
            Một ngày 20/10 thật dịu dàng <span>✧</span>
          </a>
        </footer>
        <div className="music-widget">
          <AnimatePresence>
            {audioInfo && (
              <motion.div
                className="music-popover"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => setAudioInfo(false)}
                  aria-label="Đóng thông tin nhạc"
                >
                  <X size={14} />
                </button>
                <Music2 size={19} />
                <strong>Một chút nhạc, một chút thơ.</strong>
                <p>
                  Bản nhạc của chúng mình đang được chuẩn bị. Cậu vẫn có thể tận
                  hưởng món quà này nhé.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            className={`music-toggle ${playing ? "is-playing" : ""}`}
            onClick={toggleMusic}
            aria-label={playing ? "Tắt nhạc" : "Bật nhạc"}
            aria-pressed={playing}
            title={playing ? "Tắt nhạc" : "Bật nhạc"}
          >
            {playing ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>{playing ? "Nhạc đang bật" : "Một chút nhạc"}</span>
            {playing && (
              <span className="music-bars">
                <i />
                <i />
                <i />
              </span>
            )}
          </button>
        </div>
        {siteConfig.musicSrc && (
          <audio
            ref={audioRef}
            src={siteConfig.musicSrc}
            loop
            preload="none"
            onError={() => {
              setPlaying(false);
              notify("Chưa tìm thấy tệp nhạc. Cậu thử lại sau nhé.");
            }}
          />
        )}
        <HeartBurst burst={burst} />
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="toast"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
            >
              <Check size={18} />
              <span>{toast}</span>
              <button onClick={() => setToast("")} aria-label="Đóng thông báo">
                <X size={15} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
