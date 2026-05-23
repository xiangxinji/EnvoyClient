export const motionPresets = {
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    enter: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 200, damping: 20 },
    },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.92 },
    enter: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 300, damping: 25 },
    },
  },
  slideLeft: {
    initial: { opacity: 0, x: -30 },
    enter: {
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 200, damping: 22 },
    },
  },
  slideRight: {
    initial: { opacity: 0, x: 30 },
    enter: {
      opacity: 1,
      x: 0,
      transition: { type: "spring", stiffness: 200, damping: 22 },
    },
  },
  slideUp: {
    initial: { opacity: 0, y: 10 },
    enter: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 25 },
    },
  },
  popIn: {
    initial: { opacity: 0, scale: 0.6 },
    enter: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", stiffness: 400, damping: 15 },
    },
  },
  pressScale: {
    initial: { scale: 1 },
    enter: { scale: 1 },
    tapped: {
      scale: 0.96,
      transition: { type: "spring", stiffness: 400, damping: 17 },
    },
  },
};
