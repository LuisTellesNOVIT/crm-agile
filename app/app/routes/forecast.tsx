import { useActiveWorkspace, useAppStore } from "../lib/store";
import { ForecastHorizons } from "../components/dashboard/ForecastHorizons";
import { CashFlowTable } from "./dashboard";

export default function ForecastRoute() {
  const ws = useActiveWorkspace();
  const currency = useAppStore((s) => s.currency);
  const setSelectedDeal = useAppStore((s) => s.setSelectedDeal);

  return (
    <div style={{ padding: "16px 20px", display: "grid", gap: 14, height: "100%", overflow: "auto" }}>
      <ForecastHorizons
        deals={ws.deals}
        today={ws.today}
        currency={currency}
        onOpenDeal={(id) => setSelectedDeal(id)}
      />
      {/* Flujo de caja detallado · default "Todos" (todos los proyectos, no solo estratégicos) */}
      <CashFlowTable
        deals={ws.deals}
        currency={currency}
        stages={ws.stages}
        onOpenDeal={(id) => setSelectedDeal(id)}
        defaultStrategicOnly={false}
      />
    </div>
  );
}
