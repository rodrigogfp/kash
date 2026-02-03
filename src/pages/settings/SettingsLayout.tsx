import { NavLink, Outlet } from "react-router-dom";
import { User, Shield, Building2, CreditCard, Bell, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const settingsNav = [
  { to: "/settings/profile", icon: User, label: "Perfil" },
  { to: "/settings/security", icon: Shield, label: "Segurança" },
  { to: "/settings/banks", icon: Building2, label: "Bancos Conectados" },
  { to: "/settings/billing", icon: CreditCard, label: "Assinatura" },
  { to: "/settings/notifications", icon: Bell, label: "Notificações" },
];

export default function SettingsLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <NavLink to="/">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar ao Dashboard
            </NavLink>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie sua conta, segurança e preferências
          </p>
        </div>
        
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <ScrollArea className="lg:h-[calc(100vh-200px)]">
              <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                {settingsNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </ScrollArea>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
