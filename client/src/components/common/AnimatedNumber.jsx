import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

// Counts up smoothly to `value` (used for the big money figures)
export default function AnimatedNumber({ value, format = (v) => v, className = "" }) {
  const spring = useSpring(0, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => format(current));

  useEffect(() => {
    spring.set(Number(value) || 0);
  }, [spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
