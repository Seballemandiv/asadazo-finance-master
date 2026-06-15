import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#FFF7EA", color: "#171111" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ backgroundColor: "#F4BE6E", color: "#611111" }}>
            <Icon className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#171111" }}>{title}</h1>
          {subtitle && <p className="mt-2" style={{ color: "#6B5A50" }}>{subtitle}</p>}
        </div>
        <div className="rounded-2xl shadow-sm border p-8" style={{ backgroundColor: "#FFFCF5", borderColor: "#E8D1AD" }}>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm mt-6" style={{ color: "#6B5A50" }}>{footer}</p>
        )}
      </div>
    </div>
  );
}
