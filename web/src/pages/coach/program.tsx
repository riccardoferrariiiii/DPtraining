import Link from "next/link";
import { RoleGuard } from "../../components/RoleGuard";
import { TopBar } from "../../components/TopBar";

const quickActions = [
  {
    title: "Gestisci Atleti",
    description: "Monitora scadenze, assegna programmi e controlla performance squadre.",
    href: "/coach/athletes",
    tone: "violet",
  },
  {
    title: "Settimane",
    description: "Crea, duplica e gestisci i template dei programmi settimanali.",
    href: "/coach/templates",
    tone: "green",
  },
  {
    title: "File",
    description: "Carica documenti, programmi e materiali condivisi con gli atleti.",
    href: "/coach/files",
    tone: "amber",
  },
];

export default function CoachProgram() {
  return (
    <RoleGuard role="coach">
      <>
        <TopBar title="Coach HQ" />
        <div className="container">
          <div className="card" style={{ marginTop: 20, background: "linear-gradient(135deg, rgba(47,134,199,0.10), rgba(10,11,13,0.96) 45%, rgba(15,17,21,0.96))", borderColor: "rgba(47,134,199,0.28)" }}>
            <div style={{ opacity: 0.9, letterSpacing: 1.2, textTransform: "uppercase", fontSize: 12, color: "#2f86c7" }}>Coach performance</div>
            <h2 style={{ margin: "8px 0 10px", color: "#F8F4EA" }}>Pannello di controllo</h2>
            <div style={{ opacity: 0.8, maxWidth: 680, color: "#F8F4EA" }}>
              Gestisci la tua squadra, i programmi e i materiali con un workspace pensato per il lavoro quotidiano del coach.
            </div>
          </div>

          <div className="grid" style={{ marginTop: 20 }}>
            <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.10), rgba(10,11,13,0.94))", borderColor: "rgba(47,134,199,0.22)" }}>
              <div className="small" style={{ color: "#2f86c7" }}>Atleti</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.05em", marginTop: 8, color: "#F8F4EA" }}>Live</div>
              <div className="small" style={{ marginTop: 6, color: "#a8c6d9" }}>monitoraggio continuo</div>
            </div>
            <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.08), rgba(10,11,13,0.94))", borderColor: "rgba(47,134,199,0.22)" }}>
              <div className="small" style={{ color: "#2f86c7" }}>Programmi</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.05em", marginTop: 8, color: "#F8F4EA" }}>Template</div>
              <div className="small" style={{ marginTop: 6, color: "#a8c6d9" }}>week-by-week</div>
            </div>
            <div className="card cardHover" style={{ background: "linear-gradient(180deg, rgba(47,134,199,0.07), rgba(10,11,13,0.94))", borderColor: "rgba(47,134,199,0.22)" }}>
              <div className="small" style={{ color: "#2f86c7" }}>Risorse</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.05em", marginTop: 8, color: "#F8F4EA" }}>File</div>
              <div className="small" style={{ marginTop: 6, color: "#a8c6d9" }}>condivisione facile</div>
            </div>
          </div>

          <div style={{ marginTop: 24, display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div
                  className="card cardHover"
                  style={{
                    height: "100%",
                    background:
                      action.tone === "violet"
                        ? "linear-gradient(180deg, rgba(10,11,13,0.96), rgba(22,24,29,0.94))"
                        : action.tone === "green"
                        ? "linear-gradient(180deg, rgba(10,11,13,0.96), rgba(18,19,22,0.94))"
                        : "linear-gradient(180deg, rgba(10,11,13,0.96), rgba(18,24,32,0.94))",
                    borderColor:
                      action.tone === "violet"
                        ? "rgba(47,134,199,0.20)"
                        : action.tone === "green"
                        ? "rgba(47,134,199,0.20)"
                        : "rgba(47,134,199,0.20)",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.8, letterSpacing: 1.2, textTransform: "uppercase", color: "#2f86c7" }}>Fast action</div>
                  <h3 style={{ margin: "10px 0 8px", color: "#F8F4EA" }}>{action.title}</h3>
                  <div style={{ opacity: 0.82, lineHeight: 1.6, color: "#F8F4EA" }}>{action.description}</div>
                  <div style={{ marginTop: 16 }} className="btn btnPrimary">Apri</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    </RoleGuard>
  );
}