import { render } from '../src/index';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const samples = [
  {
    name: 'bouncing-ball',
    notation: `MATHS:
* CH 1: Cycle ON
* CH 2: Attenuverter ~2 o'clock

- MATHS.CH 1 (OUT) >> MATHS.CH 2 (In)
- MATHS.CH 2 (Out) >> MATHS.CH 1 (Fall CV) // shortens fall each cycle`,
  },
  {
    name: 'quadrature-lfos',
    notation: `MATHS:
* CH 1: Cycle OFF, Rise + Fall matched
* CH 4: Cycle OFF, Rise + Fall matched

- MATHS.CH 1 (EOR) g> MATHS.CH 4 (Trig)
- MATHS.CH 4 (EOC) g> MATHS.CH 1 (Trig)
- MATHS.CH 1 (OUT) >> Filter (Cutoff)
- MATHS.CH 4 (OUT) >> VCA (CV)`,
  },
  {
    name: 'simple-chain',
    notation: `- Oscillator (Out) -> Filter (In)
- Envelope (Out) >> Filter (Cutoff)
- Filter (Out) -> VCA (In)
- LFO (Out) >> VCA (CV)`,
  },
  {
    name: 'multi-voice',
    notation: `VOICE 1:
- Osc1 (Out) -> Mixer (In1)
- Env1 (Out) >> VCA1 (CV)

VOICE 2:
- Osc2 (Out) -> Mixer (In2)
- Env2 (Out) >> VCA2 (CV)

- Mixer (Out) -> Filter (In)
- Filter (Out) -> Output (In)`,
  },
];

const outDir = join(import.meta.dir, '..', 'samples');
mkdirSync(outDir, { recursive: true });

for (const sample of samples) {
  const svg = render(sample.notation);
  writeFileSync(join(outDir, `${sample.name}.svg`), svg);

  const resvg = new Resvg(svg, {
    background: '#f7f5f0',
    fitTo: { mode: 'width', value: 1200 },
  });
  const pngData = resvg.render();
  writeFileSync(join(outDir, `${sample.name}.png`), pngData.asPng());

  console.log(`Generated ${sample.name}.svg and ${sample.name}.png`);
}
