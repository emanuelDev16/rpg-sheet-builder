import React, { useEffect, useRef } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  pulseOnChange?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 0.4,
  className = '',
  pulseOnChange = true,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const safeValue = Number.isFinite(value) ? value : 0;
  const motionVal = useMotionValue(safeValue);
  const scaleVal = useMotionValue(1);
  const rounded = useTransform(motionVal, (latest) => Math.round(latest));
  const isFirstMount = useRef(true);
  const prevValueRef = useRef(safeValue);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      motionVal.set(safeValue);
      scaleVal.set(1);
      prevValueRef.current = safeValue;
      return;
    }

    if (prevValueRef.current === safeValue) return;
    prevValueRef.current = safeValue;

    const isEink =
      typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'eink';

    if (prefersReducedMotion || isEink) {
      motionVal.set(safeValue);
      scaleVal.set(1);
      return;
    }

    const countControls = animate(motionVal, safeValue, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });

    const scaleControls = pulseOnChange
      ? animate(scaleVal, [1, 1.14, 1], {
          duration: 0.28,
          times: [0, 0.35, 1],
          ease: 'easeOut',
        })
      : null;

    return () => {
      countControls.stop();
      scaleControls?.stop();
    };
  }, [safeValue, duration, motionVal, scaleVal, prefersReducedMotion, pulseOnChange]);

  return (
    <motion.span
      style={{ scale: scaleVal }}
      className={`inline-block tabular-nums origin-center ${className}`.trim()}
    >
      {rounded}
    </motion.span>
  );
};
