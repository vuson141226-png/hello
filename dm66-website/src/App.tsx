import { useEffect, useRef, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
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
import { toPng } from "html-to-image";
import { girls } from "./data/girls";
import type { Girl } from "./data/girls";
import { findRecipients } from "./lib/recipients";
import { Envelope } from "./components/Envelope";
import { siteConfig } from "./config";

type Page = "welcome" | "our-girls" | "your-wish";
const readPage = (): Page => {
  const page = window.location.hash.replace(/^#\/?/, "");
  return page === "our-girls" || page === "your-wish" ? page : "welcome";
};
const pageLinks: { page: Page; label: string; short: string }[] = [
  { page: "welcome", label: "Lời chào", short: "Chào cậu" },
  { page: "our-girls", label: "Những cô gái DM66D", short: "Our girls" },
  { page: "your-wish", label: "Lời chúc riêng", short: "Lời chúc" },
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
        girl.isPlaceholder
          ? "Khung ảnh mẫu với hoa tulip, chưa có ảnh cá nhân"
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

function GirlsPage({ navigate }: { navigate: (page: Page) => void }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const swipeHandled = useRef(false);
  const selected = girls[index];
  const change = (delta: number) =>
    setIndex((previous) => (previous + delta + girls.length) % girls.length);
  return (
    <main className="girls-page page-shell" id="main-content" tabIndex={-1}>
      <div className="section-heading">
        <div className="eyebrow">
          <span className="little-line" /> CHƯƠNG 02 · NHỮNG SẮC MÀU ĐẶC BIỆT
        </div>
        <h1>
          Những cô gái <em>của DM66D.</em>
        </h1>
        <p>
          Mỗi cô gái là một sắc màu riêng, cùng nhau tạo nên
          <br className="desktop-break" /> một tập thể lớp 66D thật đặc biệt.
        </p>
        <span className="heading-script">Meet our beautiful girls</span>
      </div>
      {selected ? (
        <>
          <div
            className="gallery"
            role="region"
            aria-roledescription="băng chuyền"
            aria-label="Những cô gái Digital Marketing 66D"
            onPointerDown={(event) => {
              swipeHandled.current = false;
              touchStart.current = event.clientX;
            }}
            onPointerUp={(event) => {
              if (
                touchStart.current !== null &&
                Math.abs(event.clientX - touchStart.current) > 50 &&
                girls.length > 1
              ) {
                swipeHandled.current = true;
                change(event.clientX < touchStart.current ? 1 : -1);
              }
              touchStart.current = null;
            }}
            onClickCapture={(event) => {
              // A drag can also synthesize a click on a side photo.
              if (swipeHandled.current && event.detail > 0) {
                event.preventDefault();
                event.stopPropagation();
                swipeHandled.current = false;
              }
            }}
            onPointerCancel={() => {
              touchStart.current = null;
            }}
          >
            <span className="gallery-doodle doodle-left">
              a little sunshine{" "}
              <svg viewBox="0 0 60 45">
                <path d="M5 8q38-4 39 31m-6-8 7 9 8-10" />
              </svg>
            </span>
            {girls.length > 1 && (
              <button
                className="polaroid side-polaroid previous-polaroid"
                onClick={() => change(-1)}
                aria-label="Xem bạn trước"
              >
                <Portrait
                  girl={girls[(index - 1 + girls.length) % girls.length]}
                  loading="lazy"
                />
                <span>
                  {girls[(index - 1 + girls.length) % girls.length].displayName}
                </span>
              </button>
            )}
            <div className="main-polaroid-area">
              <Bow className="photo-bow" />
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  className="polaroid selected-polaroid"
                  key={selected.id}
                  initial={{ opacity: 0, x: 25, rotate: 2 }}
                  animate={{ opacity: 1, x: 0, rotate: -2 }}
                  exit={{ opacity: 0, x: -25, rotate: -3 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="photo-tape" />
                  <Portrait girl={selected} />
                  <div className="polaroid-caption">
                    <span>{selected.displayName}</span>
                    <Heart size={17} />
                  </div>
                  {selected.isPlaceholder && (
                    <span className="sample-sticker">DỮ LIỆU MẪU</span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {girls.length > 1 && (
              <button
                className="polaroid side-polaroid next-polaroid"
                onClick={() => change(1)}
                aria-label="Xem bạn tiếp theo"
              >
                <Portrait
                  girl={girls[(index + 1) % girls.length]}
                  loading="lazy"
                />
                <span>{girls[(index + 1) % girls.length].displayName}</span>
              </button>
            )}
            <span className="gallery-doodle doodle-right">
              you make us brighter <span>✧</span>
            </span>
          </div>
          <div className="gallery-controls">
            <button
              className="round-button"
              onClick={() => change(-1)}
              disabled={girls.length < 2}
              aria-label="Bạn trước"
            >
              <ChevronLeft size={19} />
            </button>
            <div className="gallery-dots" aria-label="Chọn bạn">
              {girls.map((girl, position) => (
                <button
                  key={girl.id}
                  onClick={() => setIndex(position)}
                  className={position === index ? "active" : ""}
                  aria-label={`Xem ${girl.fullName}`}
                  aria-pressed={position === index}
                />
              ))}
            </div>
            <span className="gallery-count">
              {String(index + 1).padStart(2, "0")}{" "}
              <span>/ {String(girls.length).padStart(2, "0")}</span>
            </span>
            <button
              className="round-button"
              onClick={() => change(1)}
              disabled={girls.length < 2}
              aria-label="Bạn tiếp theo"
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <div className="girl-introduction" aria-live="polite">
            <h2>{selected.fullName}</h2>
            <p>
              {selected.introduction.trim()
                ? selected.introduction
                : "Phần giới thiệu của cậu đang được chuẩn bị."}
            </p>
            {!selected.isPlaceholder && (
              <>
                <p className="personality-note">{selected.personality}</p>
                {selected.memory && (
                  <p className="memory-note">“{selected.memory}”</p>
                )}
              </>
            )}
          </div>
          <button
            className="button button-primary"
            onClick={() => navigate("your-wish")}
          >
            <Heart size={18} />
            Có một lời nhắn dành riêng cho cậu
            <ArrowRight size={18} />
          </button>
          {girls.some((girl) => girl.isPlaceholder) && (
            <p className="sample-note">
              Một chỗ nhỏ đang chờ những gương mặt thật của DM66D.
              <br />
              Website đang hiển thị dữ liệu thử và ảnh mẫu.
            </p>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Mail size={36} />
          <h2>Album đang chờ những sắc màu đầu tiên.</h2>
          <p>Chúng tớ đang chuẩn bị ảnh và lời giới thiệu cho các cậu.</p>
          <button
            className="button button-primary"
            onClick={() => navigate("your-wish")}
          >
            Đến trang lời chúc
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </main>
  );
}

function GreetingCard({
  girl,
  cardRef,
  replay,
}: {
  girl: Girl;
  cardRef: React.RefObject<HTMLDivElement | null>;
  replay: number;
}) {
  return (
    <div className="greeting-card" ref={cardRef}>
      <div className="card-topline">
        <span>DIGITAL MARKETING 66D</span>
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
            Chúc mừng ngày <em>20/10!</em>
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
            <span>From DM66D Boys — With Love</span>
            <small>YOU MAKE OUR CLASS BRIGHTER.</small>
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
}: {
  celebrate: () => void;
  notify: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<Girl[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replay, setReplay] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const recipient = girls.find((girl) => girl.id === recipientId);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (recipientId) resultRef.current?.focus({ preventScroll: true });
  }, [recipientId]);
  const reveal = (girl: Girl) => {
    if (opening) return;
    setMatches([]);
    setOpening(true);
    celebrate();
    timer.current = setTimeout(
      () => {
        setRecipientId(girl.id);
        setOpening(false);
        window.scrollTo({ top: 0, behavior: "instant" });
      },
      reduced ? 100 : 1000,
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (opening) return;
    setError("");
    setMatches([]);
    if (!query.trim()) {
      setError("Cậu cho chúng tớ biết tên trước nhé!");
      inputRef.current?.focus();
      return;
    }
    const found = findRecipients(query, girls);
    if (found.length === 1) reveal(found[0]);
    else if (found.length > 1) setMatches(found);
    else
      setError(
        "Ối, hình như chúng tớ chưa tìm thấy tên cậu 🥺 Thử nhập tên đầy đủ hoặc biệt danh khác nhé!",
      );
  };
  const reset = () => {
    setRecipientId(null);
    setQuery("");
    setMatches([]);
    setError("");
    setReplay(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const saveCard = async () => {
    if (!cardRef.current || !recipient || saving) return;
    setSaving(true);
    let exportContainer: HTMLDivElement | null = null;
    try {
      await document.fonts.ready;
      // Export a static copy so saving during a reveal/replay never omits fading text.
      const source = cardRef.current;
      if (!source) return;
      const clone = source.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${Math.max(1000, source.getBoundingClientRect().width)}px`;
      clone.style.maxWidth = "none";
      clone.dataset.cardExport = "true";
      clone
        .querySelectorAll<HTMLElement>(".card-letter p")
        .forEach((paragraph) => {
          paragraph.style.opacity = "1";
          paragraph.style.transform = "none";
          paragraph.style.animation = "none";
          paragraph.style.transition = "none";
        });
      exportContainer = document.createElement("div");
      exportContainer.setAttribute("aria-hidden", "true");
      exportContainer.style.cssText =
        "position:fixed;left:-10000px;top:0;pointer-events:none;";
      exportContainer.appendChild(clone);
      document.body.appendChild(exportContainer);
      await Promise.all(
        Array.from(clone.querySelectorAll("img")).map((img) => {
          img.loading = "eager";
          return img.decode();
        }),
      );
      const dataUrl = await toPng(clone, {
        pixelRatio: 3,
        backgroundColor: "#fff9f5",
      });
      const link = document.createElement("a");
      link.download = `DM66D-20-10-${recipient.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify("Thiệp đã được tạo. Giữ lại chút yêu thương này nhé!");
    } catch {
      notify(
        "Chưa thể lưu thiệp. Cậu thử lại nhé; ảnh cần tải đủ và cho phép xuất PNG.",
      );
    } finally {
      exportContainer?.remove();
      setSaving(false);
    }
  };
  if (recipient)
    return (
      <main className="result-page page-shell" id="main-content" tabIndex={-1}>
        <div className="section-heading result-heading">
          <div className="eyebrow">
            <Heart size={13} /> MỘT LỜI NHẮN, CHỈ DÀNH CHO CẬU
          </div>
          <h1 ref={resultRef} tabIndex={-1}>
            Cậu xứng đáng với <em>những điều thật đẹp.</em>
          </h1>
        </div>
        <div className="result-layout">
          <GreetingCard girl={recipient} cardRef={cardRef} replay={replay} />
          <aside className="card-actions">
            <Bow className="actions-bow" />
            <span className="actions-script">
              Một chút yêu thương,
              <br />
              cậu mang về nhé.
            </span>
            <button
              className="button button-primary"
              onClick={saveCard}
              disabled={saving}
            >
              <Download size={18} />
              {saving ? "Đang gói ghém thiệp..." : "Lưu thiệp của mình"}
            </button>
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
            <button
              className="button button-secondary"
              onClick={() => {
                celebrate();
                notify("Một trái tim, thật nhiều yêu thương. Cảm ơn cậu!");
              }}
            >
              <Heart size={18} />
              Gửi một trái tim
            </button>
            <button className="text-button find-another" onClick={reset}>
              <Search size={15} />
              Tìm một lời chúc khác
            </button>
            <p className="actions-footnote">
              Lưu thành ảnh PNG để giữ lại
              <br />
              một kỷ niệm nhỏ của chúng mình.
            </p>
          </aside>
        </div>
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
        <p>Chỉ cần cho chúng tớ biết tên của cậu nhé.</p>
        <form onSubmit={submit} noValidate>
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
                setMatches([]);
              }}
              autoComplete="off"
              maxLength={150}
              aria-invalid={!!error}
              aria-describedby={error ? "name-error" : "name-hint"}
              disabled={opening}
            />
          </div>
          <p className="input-hint" id="name-hint">
            Tên đầy đủ hoặc biệt danh, có dấu hay không dấu đều được.
          </p>
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
          {matches.length > 1 && (
            <div className="match-list" aria-label="Chọn đúng người nhận">
              <p>Có vài bạn cùng tên. Cậu là ai trong những cô gái này?</p>
              {matches.map((girl) => (
                <button
                  type="button"
                  key={girl.id}
                  onClick={() => reveal(girl)}
                >
                  <Portrait girl={girl} />
                  <span>
                    <strong>{girl.fullName}</strong>
                    <small>
                      {girl.displayName} · Mã: {girl.id}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          )}
          <button
            className="button button-primary"
            type="submit"
            disabled={opening}
          >
            <Mail size={18} />
            {opening ? "Đang mở lời nhắn..." : "Nhận lời chúc của mình"}
            <ArrowRight size={17} />
          </button>
        </form>
        {girls.some((girl) => girl.isPlaceholder) && (
          <div className="demo-hint">
            <span>
              <Sparkles size={13} /> Bạn đang khám phá bản mẫu
            </span>
            <p>
              Thử với{" "}
              {girls
                .filter((girl) => girl.isPlaceholder)
                .slice(0, 3)
                .map((girl, index) => (
                  <span key={girl.id}>
                    {index > 0 ? ", " : ""}
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(girl.fullName);
                        setError("");
                        setMatches([]);
                        inputRef.current?.focus();
                      }}
                    >
                      {girl.fullName}
                    </button>
                  </span>
                ))}
              .
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(readPage);
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
    document.title = `${page === "welcome" ? "Gửi cậu, với yêu thương" : page === "our-girls" ? "Những cô gái của DM66D" : "Lời chúc dành riêng cho cậu"} · DM66D`;
  }, [page]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const navigate = (next: Page) => {
    if (next === page) return;
    window.location.hash = next === "welcome" ? "#/" : `#/${next}`;
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
              ) : page === "our-girls" ? (
                <GirlsPage navigate={navigate} />
              ) : (
                <WishPage
                  celebrate={() => setBurst((value) => value + 1)}
                  notify={notify}
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
