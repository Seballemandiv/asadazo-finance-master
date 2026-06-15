import React from "react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

const SUPPORT_EMAIL = "sebastianallemandiv@gmail.com";

export default function HelloPage() {
  const subject = encodeURIComponent("Asadazo Business OS support");
  const body = encodeURIComponent("Hello Asadazo team,\n\nPlease help me with my app access.\n\nAccount email:\n\nThank you.");
  return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="max-w-xl w-full rounded-lg border bg-card p-6 space-y-4">
        <h1 className="text-2xl font-bold">Asadazo Business OS support</h1>
        <p className="text-sm text-muted-foreground">Contact the app owner for account access, privacy, or support requests.</p>
        <Button asChild><a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}><Mail className="w-4 h-4 mr-2" /> Email support</a></Button>
      </div>
    </div>
  );
}
