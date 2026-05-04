import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Lock, LogIn, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

interface LoginRequiredProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export const LoginRequired: React.FC<LoginRequiredProps> = ({ 
  title = "Authentication Required", 
  description = "Please sign in to your account to access this feature and sync your data.",
  icon = <Lock size={48} className="text-primary/20" />
}) => {
  const [, setLocation] = useLocation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[400px] animate-in fade-in duration-700">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-card border-2 border-dashed rounded-3xl p-10 text-center space-y-6 shadow-xl shadow-primary/[0.02]"
      >
        <div className="flex justify-center mb-2">
          {icon}
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">{title}</h2>
          <p className="text-muted-foreground font-medium text-sm leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <Button 
            onClick={() => setLocation("/login")}
            className="gap-2 font-bold h-11 rounded-xl shadow-lg shadow-primary/20"
          >
            <LogIn size={16} /> Sign In
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setLocation("/register")}
            className="gap-2 font-bold h-11 rounded-xl border-2"
          >
            <UserPlus size={16} /> Join Us
          </Button>
        </div>
        
        <p className="text-[10px] text-muted-foreground/60 font-medium pt-2 italic">
          Your academic data is private and securely encrypted.
        </p>
      </motion.div>
    </div>
  );
};
