import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Flower2, Heart, Home, Mail, Send, Sparkles } from "lucide-react";
import { Envelope } from "../components/Envelope";
import { letterCharacterCount, submitLetter } from "../lib/lettersApi";
import type { LetterSubmission, SavedLetter } from "../lib/lettersApi";
import "./letters.css";

export interface LettersPageProps {
  initialSenderName?: string;
  onHome: () => void;
  onCelebrate: () => void;
}

function LetterDecorations() {
  return (
    <div className="letter-decorations" aria-hidden="true">
      <span className="letter-ribbon">୨୧</span>
      <Heart className="letter-doodle-heart" size={26} />
      <Flower2 className="letter-doodle-flower" size={46} strokeWidth={1.15} />
      <Sparkles className="letter-doodle-stars" size={23} strokeWidth={1.2} />
      <span className="letter-bunny">🐰</span>
      <span className="letter-paper-note">a little letter,<br />a lot of love</span>
    </div>
  );
}

export function LettersPage({ initialSenderName = "", onHome, onCelebrate }: LettersPageProps) {
  const [senderName, setSenderName] = useState(initialSenderName);
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; message?: string }>({});
  const [saved, setSaved] = useState<SavedLetter | null>(null);
  const [envelopeOpen, setEnvelopeOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const submissionRef = useRef<LetterSubmission | null>(null);
  const sendingRef = useRef(false);
  const characterCount = letterCharacterCount(message);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(230, textarea.scrollHeight)}px`;
  }, [message, saved]);

  useEffect(() => {
    if (!saved) return;
    successRef.current?.focus();
    const timer = window.setTimeout(() => setEnvelopeOpen(false), 80);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const cleanMessage = message.trim();
    const cleanName = anonymous ? "Một cô gái DM66D" : senderName.trim() || "Một cô gái DM66D";
    const errors: { name?: string; message?: string } = {};
    if (letterCharacterCount(cleanName) > 100) errors.name = "Tên của cậu chỉ cần tối đa 100 ký tự nhé.";
    if (letterCharacterCount(cleanMessage) < 5) errors.message = "Cậu viết ít nhất 5 ký tự để gửi lời nhắn nhé.";
    if (characterCount > 2000) errors.message = "Lời nhắn cần nằm trong 2.000 ký tự. Cậu rút gọn một chút nhé.";
    setFieldErrors(errors);
    setError("");
    if (Object.keys(errors).length) {
      if (errors.name) nameRef.current?.focus();
      else textareaRef.current?.focus();
      return;
    }

    const previous = submissionRef.current;
    const submission: LetterSubmission = previous && previous.senderName === cleanName && previous.message === cleanMessage && previous.website === website
      ? previous
      : { senderName: cleanName, message: cleanMessage, submissionId: crypto.randomUUID(), website };
    submissionRef.current = submission;
    sendingRef.current = true;
    setPending(true);
    try {
      const result = await submitLetter(submission);
      setEnvelopeOpen(true);
      setSaved(result);
      onCelebrate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa gửi được lời nhắn. Cậu thử lại nhé.");
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  };

  const writeAnother = () => {
    setSaved(null);
    setMessage("");
    setError("");
    setFieldErrors({});
    submissionRef.current = null;
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <main className="letters-page page-shell" id="main-content" tabIndex={-1}>
      <header className="letters-heading">
        <div className="eyebrow"><span className="little-line" /> A LITTLE LETTER, FROM YOU <span className="little-line" /></div>
        <h1>Letters To Our <em>DM66D Boys</em> <span className="letters-title-emoji">💌</span></h1>
        <p>Món quà của chúng tớ đã được gửi đến cậu. Giờ là lúc lắng nghe những điều mà cậu muốn nhắn nhủ đến chúng tớ!</p>
      </header>

      <section className={`letter-paper${saved ? " letter-paper-sent" : ""}`} aria-label={saved ? "Lời nhắn đã gửi" : "Viết lời nhắn"}>
        <LetterDecorations />
        {saved ? (
          <div className="letter-success">
            <Envelope compact open={envelopeOpen} />
            <h2 ref={successRef} tabIndex={-1}>Your Letter Has Been Sent! <span>💗</span></h2>
            <p>Cảm ơn cậu vì những lời nhắn đáng yêu! Dù là vài dòng ngắn ngủi hay một câu chuyện dài, chúng tớ đều rất trân trọng những điều cậu đã chia sẻ.</p>
            <span className="letter-success-signature">With love, DM66D Boys</span>
            <div className="letter-success-actions">
              <button type="button" className="button button-primary" onClick={writeAnother}><Mail size={17} /> Viết thêm một lời nhắn</button>
              <button type="button" className="button button-secondary" onClick={onHome}><Home size={17} /> Quay về trang đầu</button>
            </div>
          </div>
        ) : (
          <form className="letter-form" onSubmit={submit} noValidate aria-busy={pending}>
            <span className="letter-salutation">Gửi những chàng trai DM66D,</span>
            <div className="letter-field">
              <label htmlFor="letter-sender">Tên của cậu là gì? 🌷</label>
              <input id="letter-sender" ref={nameRef} name="senderName" autoComplete="name" placeholder="Nhập tên của cậu nhé..." value={senderName} onChange={(event) => { setSenderName(event.target.value); setFieldErrors((current) => ({ ...current, name: undefined })); }} disabled={pending || anonymous} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "letter-name-error" : "letter-name-hint"} />
              {fieldErrors.name && <p id="letter-name-error" className="letter-field-error">{fieldErrors.name}</p>}
              <div className="letter-name-options">
                <span id="letter-name-hint">Có thể để trống nếu cậu muốn gửi ẩn danh.</span>
                <label className="letter-checkbox"><input type="checkbox" checked={anonymous} disabled={pending} onChange={(event) => { setAnonymous(event.target.checked); setFieldErrors((current) => ({ ...current, name: undefined })); }} /> Gửi ẩn danh</label>
              </div>
            </div>
            <div className="letter-field">
              <label htmlFor="letter-message">Cậu có điều gì muốn gửi đến các bạn nam không? 💗</label>
              <textarea id="letter-message" ref={textareaRef} name="message" rows={7} required placeholder="Có thể là một lời cảm ơn, một lời chúc, một kỷ niệm đáng nhớ, một lời góp ý dễ thương hay đơn giản là điều mà cậu muốn nói với chúng tớ..." value={message} onChange={(event) => { setMessage(event.target.value); setFieldErrors((current) => ({ ...current, message: undefined })); }} disabled={pending} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={`letter-count${fieldErrors.message ? " letter-message-error" : ""}`} />
              <div className="letter-message-meta">
                <span>{fieldErrors.message && <span id="letter-message-error" className="letter-field-error">{fieldErrors.message}</span>}</span>
                <span id="letter-count" className={characterCount > 2000 ? "letter-count-over" : ""}>{characterCount.toLocaleString("vi-VN")} / 2.000 ký tự</span>
              </div>
            </div>
            <div className="letter-honeypot" aria-hidden="true"><label htmlFor="letter-website">Website</label><input id="letter-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
            {error && <p className="letter-api-error" role="alert">{error}</p>}
            <div className="letter-form-footer">
              <span className="letter-private-note"><Heart size={13} /> Lời nhắn chỉ dành cho ban tổ chức của lớp.</span>
              <button type="submit" className="button button-primary" disabled={pending}><Send size={17} /><span>{pending ? "Đang gửi lời nhắn..." : "Gửi lời nhắn của tớ"}</span></button>
            </div>
          </form>
        )}
      </section>
      <p className="letter-closing-note">Một vài dòng chữ nhỏ, một chút yêu thương gửi lại. ♡</p>
    </main>
  );
}
