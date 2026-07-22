import { Outlet, Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import { Logo } from "./components/ui";
import LangToggle from "./components/LangToggle";
import { useI18n } from "./lib/i18n";
import CoveragePage from "./pages/Coverage";
import Home from "./pages/Home";
import Register from "./pages/Register";
import Report from "./pages/Report";
import Track from "./pages/Track";
import StaffApp from "./pages/staff/StaffApp";

function CustomerLayout() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-screen max-w-portal flex-col bg-canvas">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur">
        <Logo label={t("brand.afterSales")} />
        <LangToggle />
      </header>
      <main className="flex-1 px-4 pb-24 pt-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Staff backend (own full-width chrome, handles its own auth gate) */}
      <Route path="/staff/*" element={<StaffApp />} />

      {/* Customer portal */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/warranty" element={<CoveragePage />} />
        <Route path="/warranty/register" element={<Register />} />
        <Route path="/support" element={<Report />} />
        <Route path="/track" element={<Track />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
