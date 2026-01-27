import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const svgPath = join(projectRoot, 'public/images/hero.svg');
const pngPath = join(projectRoot, 'public/images/hero.png');

const svgBuffer = readFileSync(svgPath);

sharp(svgBuffer)
  .resize(1200, 630)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('Successfully created hero.png');
  })
  .catch(err => {
    console.error('Error:', err);
  });
