import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { ChevronLeft, ChevronRight, Flower2, Heart, Sparkles, X } from "lucide-react";
import type { AnniversaryPhoto } from "../lib/recipientLookup";
import "./anniversary.css";

interface AnniversaryHeroProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  celebrationKey: number;
}

const celebrationPieces = [
  [7, 21, -22, 0], [17, 64, 16, 0.15], [27, 11, -14, 0.32],
  [35, 83, 22, 0.12], [45, 7, -8, 0.24], [55, 88, 12, 0.42],
  [65, 13, -24, 0.3], [75, 78, 18, 0.08], [84, 24, 10, 0.36],
  [93, 61, -18, 0.22], [13, 85, 25, 0.48], [88, 86, -12, 0.5],
];

export function AnniversaryHero({ headingRef, celebrationKey }: AnniversaryHeroProps) {
  return (
    <section className="anniversary-hero" aria-labelledby="anniversary-heading">
      <div className="anniversary-celebration" key={celebrationKey} aria-hidden="true">
        {celebrationPieces.map(([left, top, turn, delay], index) => (
          <span
            key={index}
            className="anniversary-confetti"
            style={{
              "--piece-left": `${left}%`,
              "--piece-top": `${top}%`,
              "--piece-turn": `${turn}deg`,
              "--piece-delay": `${delay}s`,
            } as CSSProperties}
          >
            {index % 3 === 0 ? <Sparkles /> : <Heart fill="currentColor" />}
          </span>
        ))}
      </div>
      <Flower2 className="anniversary-hero-flower anniversary-hero-flower-left" strokeWidth={1} aria-hidden="true" />
      <Flower2 className="anniversary-hero-flower anniversary-hero-flower-right" strokeWidth={1} aria-hidden="true" />
      <p className="anniversary-dedication"><Heart size={13} aria-hidden="true" /> Dành riêng cho Múp <Heart size={13} aria-hidden="true" /></p>
      <div className="anniversary-month" aria-label="Một tháng yêu nhau">
        <span>01</span>
        <small>THÁNG YÊU NHAU</small>
      </div>
      <p className="anniversary-names">Sơn <span aria-label="yêu">♡</span> Phương</p>
      <h1 id="anniversary-heading" ref={headingRef} tabIndex={-1}>Chúc mừng 1 tháng yêu nhau</h1>
      <p className="anniversary-hero-message">Một tháng thật thương, và còn thật nhiều ngày bên nhau nữa.</p>
      <div className="anniversary-date"><span />20/10<span /></div>
      <p className="anniversary-womens-day">Chúc mừng ngày Phụ nữ Việt Nam, tình yêu của anh.</p>
      <div className="anniversary-hero-sign" aria-hidden="true">with all my love <Heart size={15} /></div>
    </section>
  );
}

export function AnniversaryGallery({ images }: { images: AnniversaryPhoto[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const selectedPhoto = activeIndex === null ? null : images[activeIndex];
  const isOpen = activeIndex !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus({ preventScroll: true });
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  const closePhoto = () => dialogRef.current?.close();
  const onDialogClose = () => {
    setActiveIndex(null);
    openerRef.current?.focus({ preventScroll: true });
  };
  const movePhoto = (direction: number) => {
    setActiveIndex((index) => index === null ? null : (index + direction + images.length) % images.length);
  };

  if (!images.length) return null;

  return (
    <section className="anniversary-gallery" aria-labelledby="anniversary-gallery-title">
      <header className="anniversary-gallery-heading">
        <p className="anniversary-eyebrow"><span /> OUR LITTLE LOVE STORY <span /></p>
        <h2 id="anniversary-gallery-title">Những khung hình của chúng mình <Heart aria-hidden="true" /></h2>
        <p>{images.length} mảnh ghép nhỏ, thật nhiều yêu thương. Chạm vào ảnh để xem rõ hơn nhé.</p>
      </header>
      <div className="anniversary-photo-wall">
        {images.map((photo, index) => (
          <figure className="anniversary-polaroid" key={photo.src}>
            <span className="anniversary-photo-tape" aria-hidden="true" />
            <button
              type="button"
              className="anniversary-photo-button"
              aria-label={`Xem ảnh kỷ niệm ${index + 1}: ${photo.altText}`}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setActiveIndex(index);
              }}
            >
              <img src={photo.src} alt={photo.altText} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
              <span className="anniversary-photo-enlarge" aria-hidden="true">Xem ảnh</span>
            </button>
            <figcaption><span>Kỷ niệm {String(index + 1).padStart(2, "0")}</span><Heart size={13} aria-hidden="true" /></figcaption>
          </figure>
        ))}
      </div>
      <p className="anniversary-gallery-sign">Cất một chút hôm nay, để mai này cùng nhớ. <Heart size={14} aria-hidden="true" /></p>

      <dialog
        ref={dialogRef}
        className="anniversary-photo-dialog"
        aria-labelledby="anniversary-photo-dialog-title"
        onClose={onDialogClose}
        onClick={(event) => { if (event.target === event.currentTarget) closePhoto(); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            movePhoto(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            movePhoto(1);
          }
        }}
      >
        {selectedPhoto && (
          <div className="anniversary-dialog-content">
            <div className="anniversary-dialog-header">
              <h2 id="anniversary-photo-dialog-title">Kỷ niệm {String((activeIndex ?? 0) + 1).padStart(2, "0")} <span>/ {images.length}</span></h2>
              <button type="button" ref={closeRef} className="anniversary-dialog-close" aria-label="Đóng ảnh kỷ niệm" onClick={closePhoto}><X size={22} aria-hidden="true" /></button>
            </div>
            <img className="anniversary-dialog-image" src={selectedPhoto.src} alt={selectedPhoto.altText} width={selectedPhoto.width} height={selectedPhoto.height} />
            {images.length > 1 && (
              <div className="anniversary-dialog-controls">
                <button type="button" onClick={() => movePhoto(-1)}><ChevronLeft size={18} aria-hidden="true" />Ảnh trước</button>
                <Heart size={16} aria-hidden="true" />
                <button type="button" onClick={() => movePhoto(1)}>Ảnh tiếp<ChevronRight size={18} aria-hidden="true" /></button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
