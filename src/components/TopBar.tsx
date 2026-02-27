import { useRouter } from "next/router";
import { useSession } from "../lib/session";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

export function TopBar({ title }: { title: string }) {
  const router = useRouter();
  const { user, profile } = useSession();

  const logout = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const goHome = () => {
    router.push("/");
  };

  return (
    <div className="topbar">
      <div className="topbarInner">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.svg?v=4" alt="TRAINED" style={{ width: 32, height: 32 }} />
          <h2 style={{ cursor: "pointer", margin: 0, fontSize: 16, fontWeight: 700 }} onClick={goHome}>
            {title}
          </h2>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={goHome} className="btn" style={{ marginRight: 10 }}>
            Home
          </button>
          <button onClick={logout} className="btn">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}