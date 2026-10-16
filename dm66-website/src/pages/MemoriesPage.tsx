import { useRef, useState } from "react";
import type { KeyboardEvent, TouchEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Flower2, Heart, Sparkles } from "lucide-react";
import { memories } from "../data/memories";
import "./memories.css";

interface MemoriesPageProps {
  onContinue: () => void;
}

function MemoryBow() {
  return (
    <svg className="memories-bow" viewBox="0 0 80 64" fill="none" aria-hidden="true">
      <path d="M39 28C25-1 1 4 10 23c5 11 20 9 29 5Zm3 0C55-1 79 4 71 23c-5 11-20 9-29 5Z" stroke="currentColor" strokeWidth="2.4" />
      <path d="m37 32-11 24 12-5 3-19 4 19 12 5-13-24" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <ellipse cx="40" cy="29" rx="4" ry="6" fill="currentColor" />
    </svg>
  );
}

export function MemoriesPage({ onContinue }: MemoriesPageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const reducedMotion = useReducedMotion();
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const currentMemory = memories[activeIndex];
  const hasMultiple = memories.length > 1;

  const goToMemory = (index: number, nextDirection: number) => {
    if (!hasMultiple) return;
    setDirection(nextDirection);
    setActiveIndex((index + memories.length) % memories.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!hasMultiple) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToMemory(activeIndex + 1, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToMemory(activeIndex - 1, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToMemory(0, -1);
    } else if (event.key === "End") {
      event.preventDefault();
      goToMemory(memories.length - 1, 1);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      touchOrigin.current = null;
      return;
    }
    touchOrigin.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const origin = touchOrigin.current;
    touchOrigin.current = null;
    if (!origin || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - origin.x;
    const dy = event.changedTouches[0].clientY - origin.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      goToMemory(activeIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
  };

  return (
    <main className="memories-page page-shell" id="main-content" tabIndex={-1}>
      <header className="memories-heading">
        <p className="memories-eyebrow">THE LITTLE THINGS, THE LOVELY DAYS</p>
        <h1>Our Little Memories <span className="memories-heading-heart">💗</span></h1>
        <p className="memories-subtitle">
          Có những khoảnh khắc chỉ diễn ra một lần, nhưng sẽ luôn là một phần thanh xuân của chúng mình.
        </p>
      </header>

      {currentMemory ? (
        <section
          className="memories-carousel"
          aria-label="Album kỷ niệm lớp Digital Marketing 66D"
          aria-roledescription="bộ trình chiếu"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="memories-photo-area">
            <div className="memories-decor memories-note" aria-hidden="true">
              <span>Best Moments</span>
              <Heart size={15} />
            </div>
            <div className="memories-decor memories-doodle" aria-hidden="true">
              <span>Our Memories</span>
              <svg viewBox="0 0 65 35" fill="none"><path d="M4 8c15 22 28 22 52 9m-9-2 10 1-4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <Heart className="memories-decor memories-floating-heart" size={23} fill="currentColor" aria-hidden="true" />
            <Sparkles className="memories-decor memories-sparkle" size={25} aria-hidden="true" />
            <Flower2 className="memories-decor memories-flower" size={62} strokeWidth={1.1} aria-hidden="true" />
            <span className="memories-decor memories-forever" aria-hidden="true">Forever DM66D ♡</span>

            {hasMultiple && (
              <button
                className="memories-arrow memories-arrow-prev"
                type="button"
                aria-label="Xem kỷ niệm trước"
                onClick={() => goToMemory(activeIndex - 1, -1)}
              >
                <ChevronLeft size={23} />
              </button>
            )}

            <div
              className="memories-scrapbook"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={() => { touchOrigin.current = null; }}
            >
              <span className="memories-tape memories-tape-left" aria-hidden="true" />
              <MemoryBow />
              <AnimatePresence initial={false} mode="wait" custom={direction}>
                <motion.figure
                  className="memories-slide"
                  key={currentMemory.id}
                  custom={direction}
                  variants={{
                    enter: (value: number) => ({ opacity: 0, x: reducedMotion ? 0 : value * 18 }),
                    center: { opacity: 1, x: 0 },
                    exit: (value: number) => ({ opacity: 0, x: reducedMotion ? 0 : value * -18 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: reducedMotion ? 0 : 0.24, ease: "easeOut" }}
                  aria-roledescription="trang album"
                  aria-label={`${activeIndex + 1} trên ${memories.length}`}
                >
                  <div className="memories-image-frame">
                    <img
                      src={currentMemory.image}
                      alt={currentMemory.altText}
                      draggable={false}
                      decoding="async"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (!image.src.endsWith("/images/memories-placeholder.svg")) {
                          image.src = "/images/memories-placeholder.svg";
                          image.alt = "Khung ảnh minh họa; ảnh kỷ niệm này chưa tải được";
                        }
                      }}
                    />
                  </div>
                  <figcaption className="memories-caption">
                    {currentMemory.isPlaceholder && <span className="memories-placeholder-label">TRANG MẪU · ĐANG CHỜ KỶ NIỆM THẬT</span>}
                    <h2>{currentMemory.title}</h2>
                    {currentMemory.date && <p className="memories-date">{currentMemory.date}</p>}
                    <p className="memories-description">{currentMemory.description}</p>
                  </figcaption>
                </motion.figure>
              </AnimatePresence>
            </div>

            {hasMultiple && (
              <button
                className="memories-arrow memories-arrow-next"
                type="button"
                aria-label="Xem kỷ niệm tiếp theo"
                onClick={() => goToMemory(activeIndex + 1, 1)}
              >
                <ChevronRight size={23} />
              </button>
            )}
          </div>

          <div className="memories-controls">
            <div className="memories-dots" role="group" aria-label="Chọn kỷ niệm">
              {memories.map((memory, index) => (
                <button
                  key={memory.id}
                  type="button"
                  aria-label={`Xem kỷ niệm ${index + 1}: ${memory.title}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => goToMemory(index, index > activeIndex ? 1 : -1)}
                >
                  <span />
                </button>
              ))}
            </div>
            <p className="memories-count" aria-hidden="true">
              <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
              <span>/</span>
              {String(memories.length).padStart(2, "0")}
            </p>
          </div>
          <p className="memories-live" role="status" aria-live="polite" aria-atomic="true">
            Kỷ niệm {activeIndex + 1} trên {memories.length}: {currentMemory.title}
          </p>
          <p className="memories-swipe-hint">Lật từng trang, giữ từng khoảnh khắc <span aria-hidden="true">♡</span></p>
        </section>
      ) : (
        <p className="memories-empty">Album đang chờ những hình ảnh và câu chuyện của lớp Digital Marketing 66D.</p>
      )}

      <div className="memories-continue">
        <span className="memories-divider" aria-hidden="true"><Heart size={13} /></span>
        <p>Và giữa rất nhiều kỷ niệm đẹp ấy, có một lời chúc đặc biệt đang chờ cậu...</p>
        <button className="button button-primary memories-continue-button" type="button" onClick={onContinue}>
          <span>💌 Khám phá lời chúc dành riêng cho cậu</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </main>
  );
}
