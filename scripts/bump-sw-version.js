import { readFileSync, writeFileSync } from 'fs';

const swPath = 'public/sw.js';
const content = readFileSync(swPath, 'utf-8');

// Replace the CACHE_NAME with a new timestamp
const updated = content.replace(
  /const CACHE_NAME = 'fastdoc-v[\d.]+-?\d*';/,
  `const CACHE_NAME = 'fastdoc-v1.4.27-${Date.now()}';`
);

writeFileSync(swPath, updated, 'utf-8');
console.log(`✅ SW version bumped: fastdoc-v1.4.27-${Date.now()}`);
