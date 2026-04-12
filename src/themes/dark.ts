import type { Theme } from '../types';
import { createTheme } from './default';

// Minimal dark-mode variant. Panels stay cream (the Braun aesthetic looks
// fine on dark backgrounds). Only out-of-panel text (port labels, annotations,
// legend) changes to remain readable on dark page backgrounds like GitHub's.
//
// Port labels and legend switch from near-black to a cream/light tone so they
// read on the dark page background while still looking acceptable when they
// graze the cream panel edges.
export const darkTheme: Theme = createTheme({
  port: {
    // Port labels sit outside the panel, on the page. Use a light cream so
    // they read on dark page backgrounds.
    labelColor: '#e8e4dc',
  },
  annotation: {
    // Annotations on cables sit on the page bg. Lighten the text and match
    // the halo to the GitHub dark page bg so the "chip" doesn't flash cream.
    color: '#d0d0d0',
    haloColor: '#0d1117',
  },
  grid: {
    // Faint dot grid needs to be visible on dark backgrounds too.
    dotColor: '#555555',
    dotRadius: 0.5,
    spacing: 12,
    opacity: 0.5,
  },
});
