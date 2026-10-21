import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { motion } from "framer-motion";
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

const mobileLayoutQuery = "(max-width: 760px)";
const subscribeMobileLayout = (listener: () => void) => {
  const query = window.matchMedia(mobileLayoutQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const getMobileLayout = () => window.matchMedia(mobileLayoutQuery).matches;

const PhotoContext = createContext<{
  images: AnniversaryPhoto[];
  mobileLayout: boolean;
  openPhoto: (index: number, opener: HTMLButtonElement) => void;
}>({ images: [], mobileLayout: false, openPhoto: () => undefined });

/** One viewer connects the photos scattered throughout the letter. */
export function AnniversaryPhotoProvider({ images, children }: { images: AnniversaryPhoto[]; children: ReactNode }) {
  const mobileLayout = useSyncExternalStore(subscribeMobileLayout, getMobileLayout, () => false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const openerIndexRef = useRef<number | null>(null);
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
    const opener = openerRef.current?.isConnected
      ? openerRef.current
      : document.querySelector<HTMLButtonElement>(`[data-photo-number="${(openerIndexRef.current ?? 0) + 1}"] .anniversary-photo-button`);
    opener?.focus({ preventScroll: true });
  };
  const movePhoto = (direction: number) => {
    setActiveIndex((index) => index === null ? null : (index + direction + images.length) % images.length);
  };

  return (
    <PhotoContext.Provider value={{ images, mobileLayout, openPhoto: (index, opener) => {
      openerRef.current = opener;
      openerIndexRef.current = index;
      setActiveIndex(index);
    } }}>
      {children}
      {!!images.length && <dialog
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
      </dialog>}
    </PhotoContext.Provider>
  );
}

export function AnniversaryPhotoGroup({ indices, placement }: { indices: number[]; placement: "opening" | "rail-left" | "rail-right" | "inline-left" | "inline-right" }) {
  const { images, openPhoto } = useContext(PhotoContext);
  const available = indices.filter((index) => images[index]);
  if (!available.length) return null;
  const inline = placement.startsWith("inline-");
  const Group = inline ? "span" : "div";
  const Frame = inline ? "span" : "figure";
  const Caption = inline ? "span" : "figcaption";
  return (
    <Group className={`anniversary-photo-group anniversary-photo-group--${placement}`} role="group" aria-label="Những khung hình của chúng mình" data-card-decoration={inline ? "" : undefined}>
      {available.map((index, position) => {
        const photo = images[index];
        return <Frame
          className="anniversary-polaroid"
          key={photo.src}
          data-photo-number={index + 1}
          style={placement === "opening" || inline ? undefined : {
            "--photo-position": `${12 + position * 76 / Math.max(1, available.length - 1)}%`,
          } as CSSProperties}
        >
          <span className="anniversary-photo-tape" aria-hidden="true" />
          <button
            type="button"
            className="anniversary-photo-button"
            aria-label={`Xem ảnh kỷ niệm ${index + 1}: ${photo.altText}`}
            onClick={(event) => openPhoto(index, event.currentTarget)}
          >
            <img src={photo.src} alt={photo.altText} width={photo.width} height={photo.height} loading={index < 2 ? "eager" : "lazy"} decoding="async" />
            <span className="anniversary-photo-enlarge" aria-hidden="true">Xem ảnh</span>
          </button>
          <Caption className="anniversary-photo-caption"><span>Kỷ niệm {String(index + 1).padStart(2, "0")}</span><Heart size={13} aria-hidden="true" /></Caption>
        </Frame>;
      })}
    </Group>
  );
}

/** The letter stays in the middle; photos follow its edges without splitting its copy. */
export function AnniversaryLetterScene({ children }: { children: ReactNode }) {
  const { mobileLayout } = useContext(PhotoContext);
  return <div className="anniversary-letter-scene">
    {!mobileLayout && <AnniversaryPhotoGroup indices={[2, 4, 6, 8, 10]} placement="rail-left" />}
    <div className="anniversary-letter-center">{children}</div>
    {!mobileLayout && <AnniversaryPhotoGroup indices={[3, 5, 7, 9]} placement="rail-right" />}
  </div>;
}

export function AnniversaryHero({ headingRef, celebrationKey }: AnniversaryHeroProps) {
  return (
    <div className="anniversary-opening">
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
        <h1 id="anniversary-heading" ref={headingRef} tabIndex={-1}>Chúc mừng 1 tháng yêu nhau</h1>
        <p className="anniversary-hero-message">Một tháng thật thương, và còn thật nhiều ngày bên nhau nữa.</p>
        <div className="anniversary-date"><span />20/10<span /></div>
        <p className="anniversary-womens-day">Chúc mừng ngày Phụ nữ Việt Nam, tình yêu của anh.</p>
        <div className="anniversary-hero-sign" aria-hidden="true">with all my love <Heart size={15} /></div>
      </section>
      <AnniversaryPhotoGroup indices={[0, 1]} placement="opening" />
    </div>
  );
}

/** Add reading breaks near sentence endings, changing whitespace only. */
function letterSections(text: string) {
  const words = text.trim().split(/\s+/);
  const sections: string[] = [];
  let start = 0;
  for (let part = 0; part < 4; part++) {
    if (part === 3) {
      sections.push(words.slice(start).join(" "));
      break;
    }
    const target = start + Math.ceil((words.length - start) / (4 - part));
    let end = target;
    for (let distance = 0; distance < 18; distance++) {
      const candidates = [target + distance, target - distance];
      const boundary = candidates.find((candidate) => candidate > start + 12 && candidate < words.length && /[.!?…)]$/.test(words[candidate - 1]));
      if (boundary !== undefined) { end = boundary; break; }
    }
    sections.push(words.slice(start, end).join(" "));
    start = end;
  }
  return sections.filter(Boolean);
}

export function AnniversaryLetter({ text, replay }: { text: string; replay: number }) {
  const { images, mobileLayout } = useContext(PhotoContext);
  const sections = letterSections(text);
  const totalWords = sections.reduce((total, section) => total + section.split(" ").length, 0);
  const photoCount = mobileLayout ? Math.max(0, images.length - 2) : 0;
  const anchors = Array.from({ length: photoCount }, (_, position) => ({
    index: position + 2,
    word: Math.floor(position * totalWords / photoCount),
  }));
  let wordOffset = 0;

  return (
    <motion.div key={replay} className="card-letter anniversary-letter" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.18 } } }}>
      {sections.map((section, index) => {
        const words = section.split(" ");
        const decorations = anchors.filter((anchor) => anchor.word >= wordOffset && anchor.word < wordOffset + words.length);
        const content: ReactNode[] = [];
        let cursor = 0;
        decorations.forEach((anchor) => {
          const position = anchor.word - wordOffset;
          if (position > cursor) content.push(words.slice(cursor, position).join(" ") + " ");
          content.push(<AnniversaryPhotoGroup key={anchor.index} indices={[anchor.index]} placement={anchor.index % 2 === 0 ? "inline-left" : "inline-right"} />);
          cursor = position;
        });
        content.push(words.slice(cursor).join(" "));
        wordOffset += words.length;
        return <motion.p key={index} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.45 }}>{content}</motion.p>;
      })}
    </motion.div>
  );
}
