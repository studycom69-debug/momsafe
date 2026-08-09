import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.99 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.22, 1, 0.36, 1], // Custom easing for premium feel
        staggerChildren: 0.1
      }}
      className={`w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8 ${className}`}
    >
      {children}
    </motion.div>
  );
}
