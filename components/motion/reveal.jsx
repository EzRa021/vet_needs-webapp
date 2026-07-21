"use client"

import { motion, useReducedMotion } from "framer-motion"

// Shared motion vocabulary for the storefront.
//
// Two rules shape everything here:
//   1. Only opacity and transform are animated. Animating height/top/width
//      would reflow the page and show up as layout shift (CLS).
//   2. Every variant collapses to a plain fade when the OS asks for reduced
//      motion — the content still appears, it just stops moving.
//
// Durations sit in the 300-500ms band with an ease-out curve: long enough to
// read as deliberate, short enough that a scrolling user never waits on it.

const EASE = [0.22, 1, 0.36, 1] // ease-out-quint — decelerates into place

/** Distance presets, in px, for the direction a element travels from. */
const OFFSETS = {
  up: { y: 24, x: 0 },
  down: { y: -24, x: 0 },
  left: { x: 32, y: 0 },
  right: { x: -32, y: 0 },
  none: { x: 0, y: 0 },
}

/**
 * Reveals its children once, when scrolled into view.
 *
 * `once` keeps it from re-firing every time the user scrolls back up, which
 * quickly reads as noise on a long page.
 */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  className,
  as = "div",
  amount = 0.2,
}) {
  const reduce = useReducedMotion()
  const offset = reduce ? OFFSETS.none : OFFSETS[direction] || OFFSETS.up
  const MotionTag = motion[as] || motion.div

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{
        duration: reduce ? 0.01 : duration,
        delay: reduce ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </MotionTag>
  )
}

/**
 * Plays immediately on mount rather than on scroll — for above-the-fold
 * content, which is already visible and would otherwise pop in late.
 */
export function RevealOnLoad({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  className,
  as = "div",
}) {
  const reduce = useReducedMotion()
  const offset = reduce ? OFFSETS.none : OFFSETS[direction] || OFFSETS.up
  const MotionTag = motion[as] || motion.div

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration: reduce ? 0.01 : duration,
        delay: reduce ? 0 : delay,
        ease: EASE,
      }}
    >
      {children}
    </MotionTag>
  )
}

/**
 * Parent for a list or grid: children animate in sequence rather than all at
 * once. Pair with <RevealItem> for each child.
 *
 * Stagger is deliberately small (60ms). Anything slower and the last card in a
 * row of eight arrives half a second after the first, which feels sluggish.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.06,
  delayChildren = 0,
  amount = 0.15,
  as = "div",
}) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as] || motion.div

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
            delayChildren: reduce ? 0 : delayChildren,
          },
        },
      }}
    >
      {children}
    </MotionTag>
  )
}

/** A single child of <RevealGroup>. Inherits timing from the parent. */
export function RevealItem({
  children,
  className,
  direction = "up",
  duration = 0.45,
  as = "div",
}) {
  const reduce = useReducedMotion()
  const offset = reduce ? OFFSETS.none : OFFSETS[direction] || OFFSETS.up
  const MotionTag = motion[as] || motion.div

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: { opacity: 0, ...offset },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: { duration: reduce ? 0.01 : duration, ease: EASE },
        },
      }}
    >
      {children}
    </MotionTag>
  )
}
