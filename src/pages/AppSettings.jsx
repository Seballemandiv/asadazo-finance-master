import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { LogOut, Mail, ExternalLink } from "lucide-react";

const SUPPORT_EMAIL = "sebastianallemandiv@gmail.com";

export default function AppSettings() {
  const { user, logout } = useAuth();
  const subject = encodeURIComponent("Asadazo Business OS support request");
  const body = encodeURIComponent(`Hello Asadazo team,\n\nPlease help me with my account.\n\nAccount email: ${user?.email || ""}\n\nThank you.`);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">App Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Support and account preferences.</p>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Signed in as <strong>{user?.email || user?.full_name || "current user"}</strong>.</p>
        <Button variant="outline" onClick={() => logout(true)}><LogOut className="w-4 h-4 mr-2" /> Sign out</Button>
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold">Privacy and account removal</h2>
        <p className="text-sm text-muted-foreground">Use these options to request privacy support or removal of your app account. Some business records may be retained where required for accounting, tax, security, or legal obligations.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="destructive"><a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}><Mail className="w-4 h-4 mr-2" /> Request account removal</a></Button>
          <Button asChild variant="outline"><a href="/account-support" target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-2" /> Public support page</a></Button>
        </div>
      </section>
    </div>
  );
}
