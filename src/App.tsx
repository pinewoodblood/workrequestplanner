// App.tsx
import WorkRequestPlannerAppUX from "./WorkRequestPlannerApp";
import { AuthGate } from "./lib/AuthGate";

export default function App() {
  return (
    <AuthGate>
      <WorkRequestPlannerAppUX />
    </AuthGate>
  );
}
