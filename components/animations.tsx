"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { ReactNode } from "react"

interface PageTransitionProps {
  children: ReactNode
  id: string
}

/**
 * High-fidelity page transition wrapper
 * Uses a sequence of opacity, scale, and y-axis shift for a professional clinical feel.
 */
export function PageTransition({ children, id }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.02, y: -10 }}
        transition={{ 
            duration: 0.4, 
            ease: [0.22, 1, 0.36, 1] // Custom quintic ease-out
        }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Smooth fade-in with subtle upward drift
 */
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
          duration: 0.6, 
          delay, 
          ease: [0.16, 1, 0.3, 1] 
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Directional slide-in for sidebar or contextual elements
 */
export function SlideIn({ 
    children, 
    direction = "left", 
    delay = 0 
}: { 
    children: ReactNode; 
    direction?: "left" | "right" | "up" | "down";
    delay?: number 
}) {
  const variants = {
    initial: {
      opacity: 0,
      x: direction === "left" ? -40 : direction === "right" ? 40 : 0,
      y: direction === "up" ? 40 : direction === "down" ? -40 : 0,
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
    }
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={variants}
      transition={{ 
          duration: 0.5, 
          delay,
          ease: [0.25, 1, 0.5, 1] 
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Staggered container for list items
 */
export function StaggerContainer({ 
    children, 
    staggerDelay = 0.1,
    delay = 0 
}: { 
    children: ReactNode; 
    staggerDelay?: number;
    delay?: number 
}) {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            variants={{
                animate: {
                    transition: {
                        staggerChildren: staggerDelay,
                        delayChildren: delay
                    }
                }
            }}
        >
            {children}
        </motion.div>
    )
}
