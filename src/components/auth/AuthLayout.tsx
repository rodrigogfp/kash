import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background dark">
      {/* Subtle ambient glow - Apple style */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2 group">
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-8 h-8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" className="stroke-primary" />
              <path d="M12 6v12M6 12h12" className="stroke-primary" />
            </svg>
          </motion.div>
          <span className="text-xl font-semibold text-foreground">Kash</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Apple-style glass card */}
          <div className="glass-strong rounded-3xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <motion.h1 
                className="text-2xl font-semibold text-foreground"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {title}
              </motion.h1>
              {subtitle && (
                <motion.p 
                  className="text-muted-foreground text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  {subtitle}
                </motion.p>
              )}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Kash. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}