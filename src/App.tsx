import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { SetAnalysis } from "./pages/SetAnalysis";

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/analysis" element={<SetAnalysis />} />
        <Route path="/app/history" element={<History />} />
        <Route path="/demo" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}
