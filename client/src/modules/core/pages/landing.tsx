import { Shield, FileText, Users, Lock, ArrowRight, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import heroImage from "@assets/techdeckhero_1771446566988.png";
import logoImage from "@assets/ShotgunNinjaVaulticon_1770412982737.png";

const features = [
  {
    icon: FileText,
    title: "Evidence Management",
    description:
      "Upload, organize, and search evidence files with full metadata tracking. Screenshots, logs, PDFs all in one secure location.",
  },
  {
    icon: Users,
    title: "Multi-Tenant Teams",
    description:
      "Role-based access control with OWNER, ADMIN, TECH, and CLIENT roles. Manage tickets, invoices, and evidence across isolated workspaces.",
  },
  {
    icon: Lock,
    title: "Compliance & Audit",
    description:
      "Every action is logged with a searchable audit trail. Generate compliance reports and maintain full accountability across your organization.",
  },
  {
    icon: Database,
    title: "Asset Tracking",
    description:
      "Link evidence to clients, sites, and assets. Build a complete picture of every device and server you manage.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="Tech Deck"
              className="w-8 h-8 rounded-md object-cover"
            />
            <span className="font-semibold text-sm tracking-tight">
              Tech Deck
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login">
              <a href="/api/login">
                Sign in
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
          <div className="relative z-10 flex flex-col min-h-[480px] sm:min-h-[540px] px-6">
            <div className="flex-1" />
            <div className="max-w-3xl mx-auto text-center pb-10 sm:pb-14">
              <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto mb-6 drop-shadow-lg">
                The multi-tenant platform for MSPs, IT teams, and consultants to
                manage tickets, track time, send invoices, and store evidence.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild className="backdrop-blur-sm bg-white/5 border-white/20 text-white">
                  <a href="#features">Learn More</a>
                </Button>
              </div>
              <div className="flex items-center justify-center gap-4 mt-5 text-xs text-white/50">
                <span>Free plan available</span>
                <span className="w-1 h-1 rounded-full bg-white/30" />
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 px-6 bg-card/50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                Everything you need
              </h2>
              <p className="text-muted-foreground">
                Built for IT professionals who need accountability.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature) => (
                <Card key={feature.title} className="hover-elevate">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-3">
              Ready to secure your evidence?
            </h2>
            <p className="text-muted-foreground mb-6">
              Start with a free account and upgrade as your team grows.
            </p>
            <Button size="lg" asChild>
              <a href="/api/login">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-1" />
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Tech Deck</span>
          <div className="flex items-center gap-3">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <a href="/delete-account" className="hover:text-foreground transition-colors">Delete Account</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
