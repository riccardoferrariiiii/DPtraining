import { useState } from "react";
import { useRouter } from "next/router";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"success" | "error" | "warning">("success");

  const login = async () => {
    setLoading(true);
    try {
      // Abilita persistenza locale se "Ricordami" è spuntato
      if (rememberMe) {
        await setPersistence(auth, browserLocalPersistence);
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (e: any) {
      setConfirmMessage("Errore login: " + (e?.message ?? e));
      setConfirmType("error");
    } finally {
      setLoading(false);
    }
  };

  const register = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setConfirmMessage("Nome e cognome obbligatori");
      setConfirmType("error");
      return;
    }

    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      // Salva i dati nel database
      await setDoc(doc(db, "users", uid), {
        email,
        firstName,
        lastName,
        role: "athlete",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push("/");
    } catch (e: any) {
      setConfirmMessage("Errore registrazione: " + (e?.message ?? e));
      setConfirmType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ marginTop: 40, maxWidth: 420, margin: "40px auto 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24 }}>
          <img src="/logo.svg?v=4" alt="TRAINED" style={{ width: 40, height: 40 }} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>TRAINED</h1>
        </div>

        {!isRegister ? (
          <>
            <div style={{ marginTop: 20 }}>
              <input
                className="input"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label htmlFor="rememberMe" style={{ cursor: "pointer", fontSize: 14, opacity: 0.8 }}>
                Ricordami
              </label>
            </div>

            <button
              className="btn btnPrimary"
              style={{ marginTop: 20 }}
              onClick={login}
              disabled={loading}
            >
              {loading ? "..." : "Accedi"}
            </button>

            <button
              className="btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                setIsRegister(true);
                setEmail("");
                setPassword("");
                setFirstName("");
                setLastName("");
              }}
            >
              Crea Account
            </button>
          </>
        ) : (
          <>
            <div style={{ marginTop: 20 }}>
              <input
                className="input"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                placeholder="Nome"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                placeholder="Cognome"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              className="btn btnPrimary"
              style={{ marginTop: 20 }}
              onClick={register}
              disabled={loading}
            >
              {loading ? "..." : "Registrati"}
            </button>

            <button
              className="btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                setIsRegister(false);
                setEmail("");
                setPassword("");
                setFirstName("");
                setLastName("");
              }}
            >
              Torna al Login
            </button>
          </>
        )}
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
              <button className="btn btnPrimary" onClick={() => setConfirmMessage("")}>
                Ok
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}