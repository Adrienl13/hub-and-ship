import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type HTMLMotionProps,
} from "framer-motion";

/**
 * Compteur animé (spring) – idéal pour pourcentages, prix, KPI.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  format,
  className,
  suffix,
}: {
  value: number;
  decimals?: number;
  format?: (n: number) => string;
  className?: string;
  suffix?: string;
}) {
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 90, damping: 18, mass: 0.6 });
  const display = useTransform(spring, (latest) => {
    if (format) return format(latest);
    return latest.toFixed(decimals);
  });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  useEffect(() => {
    return display.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v) + (suffix ?? "");
    });
  }, [display, suffix]);

  return (
    <span ref={ref} className={className}>
      {format ? format(value) : value.toFixed(decimals)}
      {suffix ?? ""}
    </span>
  );
}

/**
 * Reveal au scroll, une seule fois.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger pour grilles/listes : enveloppe ses enfants <RevealItem/>.
 */
export function RevealStagger({
  children,
  className,
  stagger = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const RevealItem = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 16 },
      show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
    }}
    className={className}
  >
    {children}
  </motion.div>
);
