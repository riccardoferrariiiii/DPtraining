// ✅ INCOLLA QUESTO FILE COMPLETO
// 📄 src/pages/coach/program.tsx
// (così RoleGuard coach non ti blocca più DOPO che hai cambiato role)

import Link from "next/link";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";

export default function CoachProgram() {
  return (
    <RoleGuard role="coach">
      <>
        <TopBar title="DPtraining Coach" />
        <div className="container">
          <div className="card" style={{ marginTop: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Pannello Coach</h2>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/coach/athletes">
                <button className="btn">Gestisci Atleti</button>
              </Link>

              <Link href="/coach/templates">
                <button className="btn">Gestisci Settimane</button>
              </Link>
            </div>
          </div>
        </div>
      </>
    </RoleGuard>
  );
}