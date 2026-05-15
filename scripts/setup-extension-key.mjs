import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'build-temp');
const keyFilePath = path.join(outDir, 'extension-key.txt');

const args = new Set(process.argv.slice(2));
const force = args.has('--force') || args.has('-f');

if (fs.existsSync(keyFilePath) && !force) {
  const existing = fs.readFileSync(keyFilePath, 'utf8').trim();
  if (existing) {
    console.log(`[MarksVault] 已存在 extension key：${keyFilePath}`);
    console.log('[MarksVault] 如需重新生成，请执行：node scripts/setup-extension-key.mjs --force');
    process.exit(0);
  }
}

fs.mkdirSync(outDir, { recursive: true });

const { publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
fs.writeFileSync(keyFilePath, `${publicKeyBase64}\n`, 'utf8');

console.log(`[MarksVault] 已生成 Chromium extension key：${keyFilePath}`);
console.log('[MarksVault] 说明：该 key 会被写入 manifest.key，用于稳定扩展 ID。');

