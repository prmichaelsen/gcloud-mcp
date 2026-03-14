import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: [
    '@modelcontextprotocol/sdk',
    '@google-cloud/cloudbuild',
    '@google-cloud/logging',
    '@google-cloud/run',
    '@google-cloud/artifact-registry',
    '@google-cloud/secret-manager',
    'google-auth-library',
    'dotenv',
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
});

console.log('✓ Built server.js');

await esbuild.build({
  entryPoints: ['src/server-factory.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server-factory.js',
  sourcemap: true,
  external: [
    '@modelcontextprotocol/sdk',
    '@google-cloud/cloudbuild',
    '@google-cloud/logging',
    '@google-cloud/run',
    '@google-cloud/artifact-registry',
    '@google-cloud/secret-manager',
    'google-auth-library',
    'dotenv',
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
});

console.log('✓ Built server-factory.js');

// Generate TypeScript declarations
console.log('Generating TypeScript declarations...');
try {
  execSync('tsc --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });
  console.log('✓ Generated TypeScript declarations');
} catch (error) {
  console.error('✗ Failed to generate TypeScript declarations');
  process.exit(1);
}

console.log('✓ Build complete');
