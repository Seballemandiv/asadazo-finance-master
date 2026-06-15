import React, { useMemo, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Upload, FileText, Table2, ChevronLeft, ChevronRight, Menu, Calendar, Package, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard Online-shop", short: "Online", path: "/", icon: LayoutDashboard },
  { label: "Event Calendar", short: "Events", path: "/dashboard-events", icon: Calendar },
  { label: "Stock", short: "Stock", path: "/stock", icon: Package },
  { label: "Import Center", short: "Import", path: "/import", icon: Upload },
  { label: "Review Sales", short: "Sales", path: "/review-sales", icon: FileText },
  { label: "Review Bank", short: "Bank", path: "/review-bank", icon: FileText },
  { label: "Mappings", short: "Maps", path: "/mappings", icon: Table2 },
];

const MOBILE_PRIMARY = NAV.slice(0, 4);

function isActive(pathname, itemPath) {
  return pathname === itemPath || (itemPath === "/" && pathname === "/dashboard-online-shop");
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const activeItem = useMemo(() => NAV.find(item => isActive(pathname, item.path)) || NAV[0], [pathname]);

  const NavItem = ({ item, mobile = false }) => {
    const active = isActive(pathname, item.path);
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg font-medium transition-colors",
          mobile ? "px-3 py-3 text-sm" : "px-3 py-2.5 text-sm",
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {(!collapsed || mobile) && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const Sidebar = ({ mobile }) => (
    <div className={cn("flex flex-col h-full", mobile ? "w-72 p-4" : collapsed ? "w-16 p-2" : "w-64 p-4")}>
      <div className={cn("flex items-center mb-6", collapsed && !mobile ? "justify-center" : "justify-between")}>
        {(!collapsed || mobile) && <span className="font-bold text-base tracking-tight">Asadazo Business OS</span>}
        {!mobile && <button onClick={() => setCollapsed(c => !c)} className="p-1 rounded hover:bg-muted">{collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}</button>}
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(item => <NavItem key={item.path} item={item} mobile={mobile} />)}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn("hidden md:flex flex-col border-r bg-card transition-all duration-200", collapsed ? "w-16" : "w-64")}><Sidebar /></aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full bg-card border-r shadow-xl overflow-y-auto"><Sidebar mobile /></aside>
        </div>
      )}

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b bg-card sticky top-0 z-30">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">Asadazo Business OS</div>
            <div className="text-xs text-muted-foreground truncate">{activeItem.label}</div>
          </div>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg border hover:bg-muted" aria-label="Open navigation"><Menu className="w-5 h-5" /></button>
        </div>
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="grid grid-cols-5 gap-1 px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          {MOBILE_PRIMARY.map(item => {
            const active = isActive(pathname, item.path);
            const Icon = item.icon;
            return <Link key={item.path} to={item.path} className={cn("flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium", active ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><Icon className="w-4 h-4" /><span>{item.short}</span></Link>;
          })}
          <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium text-muted-foreground"><MoreHorizontal className="w-4 h-4" /><span>More</span></button>
        </div>
      </nav>
    </div>
  );
}
