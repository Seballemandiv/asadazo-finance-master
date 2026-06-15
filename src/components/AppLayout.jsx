import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Upload, FileText, Table2, ChevronLeft, ChevronRight, Menu, X, Calendar, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard Online-shop", path: "/", icon: LayoutDashboard },
  { label: "Event Calendar", path: "/dashboard-events", icon: Calendar },
  { label: "Stock", path: "/stock", icon: Package },
  { label: "Import Center", path: "/import", icon: Upload },
  { label: "Review Sales", path: "/review-sales", icon: FileText },
  { label: "Review Bank", path: "/review-bank", icon: FileText },
  { label: "Mappings", path: "/mappings", icon: Table2 },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  const NavItem = ({ item }) => {
    const active = pathname === item.path || (item.path === "/" && pathname === "/dashboard-online-shop");
    const Icon = item.icon;
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const Sidebar = ({ mobile }) => (
    <div className={cn(
      "flex flex-col h-full",
      mobile ? "w-64 p-4" : collapsed ? "w-16 p-2" : "w-64 p-4"
    )}>
      <div className={cn("flex items-center mb-6", collapsed && !mobile ? "justify-center" : "justify-between")}>
        {(!collapsed || mobile) && (
          <span className="font-bold text-base tracking-tight">Asadazo Finance</span>
        )}
        {!mobile && (
          <button onClick={() => setCollapsed(c => !c)} className="p-1 rounded hover:bg-muted">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map(item => <NavItem key={item.path} item={item} />)}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn(
        "hidden md:flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}>
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full bg-card border-r shadow-xl">
            <Sidebar mobile />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card sticky top-0 z-10">
          <button onClick={() => setMobileOpen(true)} className="p-1 rounded hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Asadazo Finance</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
