import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  format?: (val: number) => string | number;
}

export function AnimatedNumber({ 
  value, 
  duration = 1500, 
  className = "",
  format = Math.round 
}: AnimatedNumberProps) {
  const [hasMounted, setHasMounted] = useState(false);
  
  const spring = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: duration,
  });

  const display = useTransform(spring, (current) => format(current));

  useEffect(() => {
    setHasMounted(true);
    spring.set(value);
  }, [spring, value]);

  if (!hasMounted) {
    return <span className={className}>{format(0)}</span>;
  }

  return <motion.span className={className}>{display as any}</motion.span>;
}
