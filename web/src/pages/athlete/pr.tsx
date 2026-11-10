import { useEffect } from "react";
import { useRouter } from "next/router";
import { RoleGuard } from "../../components/RoleGuard";

export default function AthletePrPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/athlete/benchmarks");
  }, [router]);

  return (
    <RoleGuard role="athlete">
      <div />
    </RoleGuard>
  );
}
