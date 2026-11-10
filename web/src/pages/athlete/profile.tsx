import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";
import { db } from "../../lib/firebase";
import { useSession } from "../../lib/session";

function toDisplayDate(raw: any) {
  if (!raw) return "";
  const date = raw?.toDate?.() instanceof Date ? raw.toDate() : raw instanceof Date ? raw : null;
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AthleteProfilePage() {
  const { user, profile } = useSession();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName || "");
    setLastName(profile.lastName || "");
    setDateOfBirth(toDisplayDate(profile.dateOfBirth));
    setWeightKg(profile.weightKg != null ? String(profile.weightKg) : "");
    setHeightCm(profile.heightCm != null ? String(profile.heightCm) : "");
    setPhotoUrl(profile.photoUrl || "");
  }, [profile]);

  const handleSave = async () => {
    if (!user?.uid) return;

    setSaving(true);
    setMessage("");

    try {
      const payload: Record<string, any> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth ? new Date(`${dateOfBirth}T12:00:00`) : null,
        weightKg: weightKg !== "" ? Number(weightKg) : null,
        heightCm: heightCm !== "" ? Number(heightCm) : null,
        photoUrl: photoUrl.trim() || null,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      setMessage("Profilo aggiornato con successo.");
    } catch (error) {
      setMessage("Si è verificato un errore durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.uid) return;

    setUploadingPhoto(true);
    setMessage("");

    try {
      const formData = new FormData();
      const fileId = `${user.uid}-${Date.now()}`;
      formData.append("fileId", fileId);
      formData.append("fileName", file.name || "profile-photo");
      formData.append("file", file);

      const uploadRes = await fetch("/api/uploadFile", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${uploadRes.status}`);
      }

      const { downloadUrl } = await uploadRes.json();
      setPhotoUrl(downloadUrl);
      setMessage("Foto profilo caricata correttamente.");
    } catch (error: any) {
      setMessage(String(error?.message || error || "Errore durante il caricamento della foto."));
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Atleta";
  const avatarUrl = photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1c5cff&color=fff&size=180`;

  return (
    <RoleGuard role="athlete">
      <TopBar title="Profilo atleta" />
      <div className="container">
        <div
          className="card"
          style={{
            marginTop: 20,
            background: "linear-gradient(135deg, rgba(47,134,199,0.10), rgba(10,11,13,0.96) 48%, rgba(255,255,255,0.04))",
            borderColor: "rgba(47,134,199,0.26)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18, flexWrap: "wrap" }}>
            <img
              src={avatarUrl}
              alt={fullName}
              style={{ width: 92, height: 92, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 18px 30px rgba(37,99,235,0.24)" }}
            />
            <div>
              <div style={{ letterSpacing: 1.2, opacity: 0.7, textTransform: "uppercase", fontSize: 12 }}>Atleta</div>
              <h2 style={{ margin: "6px 0 0" }}>{fullName}</h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label className="field">
                <span>Nome</span>
                <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" />
              </label>
              <label className="field">
                <span>Cognome</span>
                <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Cognome" />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label className="field">
                <span>Data di nascita</span>
                <input className="input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </label>
              <label className="field">
                <span>Peso (kg)</span>
                <input className="input" type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="75" />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <label className="field">
                <span>Altezza (cm)</span>
                <input className="input" type="number" step="1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="180" />
              </label>
              <label className="field">
                <span>Foto profilo</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label className="btn btnPrimary" style={{ cursor: "pointer", margin: 0 }}>
                    {uploadingPhoto ? "Caricamento..." : "Scegli da galleria"}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
                  </label>
                  <span style={{ fontSize: 12, opacity: 0.72 }}>oppure incolla un link</span>
                </div>
                <input className="input" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." style={{ marginTop: 8 }} />
              </label>
            </div>
          </div>

          {message && (
            <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#d1fae5" }}>
              {message}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <Link href="/athlete-home" className="btn">
              Torna alla home
            </Link>
            <button className="btn btnPrimary" onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio..." : "Salva profilo"}
            </button>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
