import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Download, Home, LockKeyhole, LogOut, Mail, RefreshCw } from "lucide-react";
import { exportLetters, getAdminSession, getLetters, LettersApiError, loginAdmin, logoutAdmin } from "../lib/lettersApi";
import type { SavedLetter } from "../lib/lettersApi";
import "./letters.css";

type AdminPhase = "checking" | "login" | "authenticated";

const formatSentDate = (date: string): string => {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(value);
};

export function AdminLettersPage({ onHome }: { onHome: () => void }) {
  const [phase, setPhase] = useState<AdminPhase>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [letters, setLetters] = useState<SavedLetter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loginRef = useRef<HTMLInputElement>(null);
  const listRequestRef = useRef(0);

  useEffect(() => {
    if (phase === "login") loginRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    let active = true;
    void getAdminSession().then((session) => {
      if (!active) return;
      setPhase(session.authenticated ? "authenticated" : "login");
      setAdminEmail(session.email ?? "");
    }).catch((cause: unknown) => {
      if (!active) return;
      setPhase("login");
      if (!(cause instanceof LettersApiError && cause.status === 401)) {
        setError(cause instanceof Error ? cause.message : "Chưa thể kiểm tra phiên quản trị.");
      }
    });
    return () => { active = false; listRequestRef.current += 1; };
  }, []);

  const expireSession = useCallback(() => {
    listRequestRef.current += 1;
    setPhase("login");
    setLetters([]);
    setTotal(0);
    setPassword("");
    setAdminEmail("");
    setError("Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại để xem lời nhắn.");
  }, []);

  const refreshLetters = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await getLetters(order);
      if (requestId !== listRequestRef.current) return;
      if (!Array.isArray(result.letters) || typeof result.total !== "number") {
        throw new Error("Máy chủ chưa trả về danh sách lời nhắn hợp lệ. Vui lòng tải lại.");
      }
      setLetters(result.letters);
      setTotal(result.total);
    } catch (cause) {
      if (requestId !== listRequestRef.current) return;
      if (cause instanceof LettersApiError && (cause.status === 401 || cause.status === 403)) expireSession();
      else setError(cause instanceof Error ? cause.message : "Không tải được danh sách lời nhắn.");
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [order, expireSession]);

  useEffect(() => {
    if (phase === "authenticated") void refreshLetters();
  }, [phase, refreshLetters]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginPending) return;
    setLoginPending(true);
    setError("");
    setNotice("");
    try {
      const session = await loginAdmin(email.trim(), password);
      if (!session.authenticated) throw new Error("Máy chủ chưa xác nhận phiên quản trị. Vui lòng thử lại.");
      setAdminEmail(session.email ?? email.trim());
      setPassword("");
      setPhase("authenticated");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đăng nhập được. Vui lòng thử lại.");
    } finally {
      setLoginPending(false);
    }
  };

  const logout = async () => {
    listRequestRef.current += 1;
    setPhase("login");
    setLetters([]);
    setTotal(0);
    setAdminEmail("");
    setPassword("");
    setError("");
    setNotice("");
    setLoginPending(true);
    try {
      await logoutAdmin();
      setNotice("Đã đăng xuất khỏi khu vực quản trị.");
    } catch (cause) {
      setError(cause instanceof Error ? `Chưa xác nhận được đăng xuất: ${cause.message}` : "Chưa xác nhận được đăng xuất. Vui lòng thử lại.");
    } finally {
      setLoginPending(false);
      loginRef.current?.focus();
    }
  };

  const download = async (format: "csv" | "json") => {
    if (exporting) return;
    setExporting(format);
    setError("");
    setNotice("");
    try {
      await exportLetters(format);
      setNotice(`Đã gửi file ${format.toUpperCase()} tới trình duyệt để tải xuống.`);
    } catch (cause) {
      if (cause instanceof LettersApiError && (cause.status === 401 || cause.status === 403)) expireSession();
      else setError(cause instanceof Error ? cause.message : "Không xuất được file. Vui lòng thử lại.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="admin-letters-page page-shell" id="main-content" tabIndex={-1}>
      <header className="letters-heading admin-letters-heading">
        <div className="eyebrow"><LockKeyhole size={13} /> DÀNH RIÊNG CHO QUẢN TRỊ VIÊN</div>
        <h1>Hộp thư <em>DM66D</em></h1>
        <p>Những lời nhắn được gửi lại với thật nhiều yêu thương.</p>
      </header>

      {phase === "checking" ? <p className="admin-session-loading" role="status">Đang kiểm tra phiên quản trị...</p> : phase === "login" ? (
        <section className="letter-paper admin-login-paper" aria-label="Đăng nhập quản trị">
          <LockKeyhole className="admin-login-lock" size={28} strokeWidth={1.2} aria-hidden="true" />
          <h2>Đăng nhập quản trị</h2>
          <form className="letter-form" onSubmit={login} aria-busy={loginPending}>
            <div className="letter-field"><label htmlFor="admin-email">Email quản trị</label><input ref={loginRef} id="admin-email" type="email" name="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loginPending} /></div>
            <div className="letter-field"><label htmlFor="admin-password">Mật khẩu</label><input id="admin-password" type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loginPending} /></div>
            {error && <p className="letter-api-error" role="alert">{error}</p>}
            {notice && <p className="letter-admin-notice" role="status">{notice}</p>}
            <button className="button button-primary" type="submit" disabled={loginPending}><LockKeyhole size={16} /> {loginPending ? "Đang xác nhận..." : "Đăng nhập"}</button>
          </form>
        </section>
      ) : (
        <section className="admin-inbox" aria-label="Danh sách lời nhắn">
          <div className="admin-inbox-toolbar">
            <div className="admin-inbox-total"><Mail size={24} strokeWidth={1.2} /><span><strong>{total.toLocaleString("vi-VN")}</strong> lời nhắn<small>{adminEmail || "Quản trị viên"}</small></span></div>
            <button type="button" className="text-button" onClick={() => void logout()}><LogOut size={15} /> Đăng xuất</button>
          </div>
          <a className="text-button admin-template-download" href="/downloads/DM66D-private-wishes-template.xlsx" download="DM66D-private-wishes-template.xlsx">
            <Download size={15} /> Tải Excel mẫu: Người nhận và Lời chúc
          </a>
          <div className="admin-inbox-controls">
            <label htmlFor="letters-sort">Sắp xếp <select id="letters-sort" value={order} onChange={(event) => setOrder(event.target.value as "newest" | "oldest")}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
            <button type="button" className="button button-secondary" onClick={() => void refreshLetters()} disabled={loading}><RefreshCw size={15} className={loading ? "admin-refresh-spinning" : ""} /> {loading ? "Đang tải..." : "Tải lại"}</button>
            <div className="admin-export-actions"><button type="button" className="button button-secondary" onClick={() => void download("csv")} disabled={Boolean(exporting)}><Download size={15} /> {exporting === "csv" ? "Đang xuất..." : "Tải CSV"}</button><button type="button" className="button button-secondary" onClick={() => void download("json")} disabled={Boolean(exporting)}><Download size={15} /> {exporting === "json" ? "Đang xuất..." : "Tải JSON"}</button></div>
          </div>
          {error && <p className="letter-api-error" role="alert">{error}</p>}
          {notice && <p className="letter-admin-notice" role="status">{notice}</p>}
          <div className="admin-letter-list" aria-busy={loading}>
            {!letters.length && !loading && !error ? <div className="admin-inbox-empty"><Mail size={40} strokeWidth={1} /><p>Hộp thư chưa có lời nhắn nào.</p></div> : letters.map((letter) => (
              <article className="admin-letter" key={letter.id}>
                <header><h2>{letter.senderName}</h2><time dateTime={letter.createdAt}>{formatSentDate(letter.createdAt)}</time></header>
                <p>{letter.message}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <button className="text-button admin-home-link" type="button" onClick={onHome}><Home size={14} /> Quay về website</button>
    </main>
  );
}
