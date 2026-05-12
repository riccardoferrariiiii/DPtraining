import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function ResetPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");

  useEffect(() => {
    const queryEmail = router.query.email;
    if (typeof queryEmail === "string") {
      setEmail(queryEmail);
    }

    const mode = router.query.mode;
    const oobCode = router.query.oobCode;
    if (mode === "resetPassword" && typeof oobCode === "string") {
      setIsCodeMode(true);
      setResetCode(oobCode);
      verifyPasswordResetCode(auth, oobCode)
        .then((mail) => setResolvedEmail(mail))
        .catch(() => {
          setConfirmMessage("Il link di reset non è valido o è scaduto.");
          setConfirmType("error");
        });
    }
  }, [router.query.email, router.query.mode, router.query.oobCode]);

  const sendReset = async () => {
    if (!email.trim()) {
      setConfirmMessage("Inserisci la tua email.");
      setConfirmType("warning");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${window.location.origin}/reset-password`,
      });
      setConfirmMessage("Ti abbiamo inviato una mail per reimpostare la password.");
      setConfirmType("success");
    } catch (e: any) {
      setConfirmMessage("Errore recupero password: " + (e?.message ?? e));
      setConfirmType("error");
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    if (!resetCode) {
      setConfirmMessage("Link di reset non valido.");
      setConfirmType("error");
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 6) {
      setConfirmMessage("La nuova password deve contenere almeno 6 caratteri.");
      setConfirmType("warning");
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmMessage("Le password non coincidono.");
      setConfirmType("warning");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, resetCode, newPassword);
      setConfirmMessage("Password aggiornata con successo. Ora puoi accedere.");
      setConfirmType("success");
    } catch (e: any) {
      setConfirmMessage("Errore aggiornamento password: " + (e?.message ?? e));
      setConfirmType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ marginTop: 40, maxWidth: 420, margin: "40px auto 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <img src="/logo.svg?v=4" alt="TRAINED" style={{ width: 40, height: 40 }} />
        </div>

        {!isCodeMode ? (
          <>
            <div className="h2" style={{ textAlign: "center", marginBottom: 8 }}>Recupera password</div>
            <div className="small" style={{ textAlign: "center", marginBottom: 16 }}>
              Inserisci la tua email e ti invieremo il link di reset.
            </div>

            <input
              className="input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              className="btn btnPrimary"
              style={{ marginTop: 14 }}
              onClick={sendReset}
              disabled={loading}
            >
              {loading ? "..." : "Invia link reset"}
            </button>
          </>
        ) : (
          <>
            <div className="h2" style={{ textAlign: "center", marginBottom: 8 }}>Imposta nuova password</div>
            <div className="small" style={{ textAlign: "center", marginBottom: 16 }}>
              {resolvedEmail ? `Account: ${resolvedEmail}` : "Inserisci la nuova password."}
            </div>

            <input
              className="input"
              type="password"
              placeholder="Nuova password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <input
              className="input"
              type="password"
              placeholder="Conferma nuova password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ marginTop: 10 }}
            />

            <button
              className="btn btnPrimary"
              style={{ marginTop: 14 }}
              onClick={submitNewPassword}
              disabled={loading}
            >
              {loading ? "..." : "Salva nuova password"}
            </button>
          </>
        )}

        <button
          className="btn"
          style={{ marginTop: 10 }}
          onClick={() => router.push("/login")}
          disabled={loading}
        >
          Torna al Login
        </button>
      </div>

      {confirmMessage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setConfirmMessage("")}
        >
          <div
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.08))",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 18,
              padding: 24,
              maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              {confirmType === "success" ? "✅ Successo" : confirmType === "error" ? "❌ Errore" : "⚠️ Attenzione"}
            </div>
            <div style={{ color: "rgba(245,245,247,0.75)", marginBottom: 20 }}>
              {confirmMessage}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn btnPrimary"
                onClick={() => {
                  const shouldGoLogin = confirmType === "success" && isCodeMode;
                  setConfirmMessage("");
                  if (shouldGoLogin) router.push("/login");
                }}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
