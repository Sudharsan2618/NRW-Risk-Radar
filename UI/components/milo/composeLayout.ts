/**
 * Shared geometry for the pinned compose docks at the bottom of the My Tasks
 * side panels.
 *
 * The Emails tab renders a 200px preview and the LinkedIn tab renders a note
 * box; when each owned its own number the two tabs sat at visibly different
 * heights and the panel jumped as you switched. Both import this, so they stay
 * the same length by construction rather than by coincidence.
 */
export const COMPOSE_BODY_HEIGHT = 200;

/** Padding of the dock itself — kept identical across tabs for the same reason. */
export const COMPOSE_DOCK_PADDING = '14px 20px';
