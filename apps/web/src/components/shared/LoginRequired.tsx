import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

interface LoginRequiredProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  onLogin?: () => void;
  onSignup?: () => void;
}

export const LoginRequired: React.FC<LoginRequiredProps> = ({
  title,
  description,
  icon,
  onLogin,
  onSignup
}) => {
  const handleLogin = () => {
    if (onLogin) onLogin();
    else window.location.href = "/login";
  };

  const handleSignup = () => {
    if (onSignup) onSignup();
    else window.location.href = "/signup";
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[400px]">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 260,
          damping: 20,
          duration: 0.6 
        }}
        className="w-full max-w-md"
      >
        <Card className="p-10 border-2 bg-card/50 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
          
          <div className="mb-8 flex justify-center relative">
            <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative bg-primary/5 p-6 rounded-3xl border border-primary/10 group-hover:scale-110 transition-transform duration-500">
              {icon || <LogIn size={48} className="text-primary/40" />}
            </div>
          </div>

          <h2 className="text-3xl font-black tracking-tight mb-4 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text">
            {title}
          </h2>
          
          <p className="text-muted-foreground font-medium mb-10 leading-relaxed">
            {description}
          </p>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleLogin}
              className="h-12 text-base font-bold shadow-lg shadow-primary/20 gap-2 hover:translate-y-[-2px] transition-all active:scale-95"
            >
              <LogIn size={18} />
              Sign In to Continue
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSignup}
              className="h-12 text-base font-bold border-2 hover:bg-muted gap-2 transition-all active:scale-95"
            >
              <UserPlus size={18} />
              Create New Account
            </Button>
          </div>

          <p className="mt-8 text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/40">
            Join the community today
          </p>
        </Card>
      </motion.div>
    </div>
  );
};
