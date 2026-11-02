import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function convertFile(inputPath, outputPath, quality = 85) {
  if (!fs.existsSync(inputPath)) {
    console.log(`Skipping: ${inputPath} (does not exist)`);
    return;
  }
  const inputStat = fs.statSync(inputPath);
  await sharp(inputPath)
    .webp({ quality, effort: 6 })
    .toFile(outputPath);
  const outputStat = fs.statSync(outputPath);
  const saved = ((1 - outputStat.size / inputStat.size) * 100).toFixed(1);
  console.log(`Converted: ${path.basename(inputPath)} (${(inputStat.size / 1024).toFixed(0)} KB) -> ${path.basename(outputPath)} (${(outputStat.size / 1024).toFixed(0)} KB) [Saved ${saved}%]`);
}

async function main() {
  console.log('--- Converting Core Portfolio Images to WebP ---');

  // Hero portrait
  await convertFile('public/hero-portrait.png', 'public/hero-portrait.webp', 90);

  // Avatar
  await convertFile('public/avatar.png', 'public/avatar.webp', 90);

  // Emojis in src/assets/emojis
  await convertFile('src/assets/emojis/emoji1.png', 'src/assets/emojis/emoji1.webp', 85);
  await convertFile('src/assets/emojis/emoji2.png', 'src/assets/emojis/emoji2.webp', 85);
  await convertFile('src/assets/emojis/emoji3.png', 'src/assets/emojis/emoji3.webp', 85);
  await convertFile('src/assets/emojis/emoji4.png', 'src/assets/emojis/emoji4.webp', 85);

  // Convert any .png/.jpg/.jpeg files placed in public/projects/
  const projectsDir = 'public/projects';
  if (fs.existsSync(projectsDir)) {
    for (const file of fs.readdirSync(projectsDir)) {
      if (/\.(png|jpg|jpeg)$/i.test(file)) {
        const inputPath = path.join(projectsDir, file);
        const outputPath = path.join(projectsDir, file.replace(/\.(png|jpg|jpeg)$/i, '.webp'));
        await convertFile(inputPath, outputPath, 85);
      }
    }
  }

  console.log('--- Conversion Complete! ---');
}

main().catch(console.error);
