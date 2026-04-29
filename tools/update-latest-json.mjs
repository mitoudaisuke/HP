import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_REPO = 'mitoudaisuke/NIRFI-RELEASE';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const latestJsonPath = path.resolve(__dirname, '..', 'latest.json');

const platformByAssetName = {
  'NIRFI-Mac-arm64.dmg': {
    platformKey: 'darwin-arm64',
    assetType: 'dmg',
    installMethod: 'manual-dmg',
    signed: false,
    notarized: false
  },
  'NIRFI-Windows-x64.zip': {
    platformKey: 'win32-x64',
    assetType: 'zip',
    installMethod: 'manual-zip',
    signed: false
  }
};

const formatMiB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const versionFromTag = (tagName) => tagName.replace(/^v/i, '');

function readRequestedVersion(argv) {
  const versionArgIndex = argv.indexOf('--version');
  const rawVersion = versionArgIndex >= 0 ? argv[versionArgIndex + 1] : process.env.NIRFI_RELEASE_VERSION;
  const version = rawVersion?.trim().replace(/^v/i, '');

  if (versionArgIndex >= 0 && (!version || version.startsWith('-'))) {
    throw new Error('Usage: node tools/update-latest-json.mjs [--version <package.json version>]');
  }

  if (!version) {
    return undefined;
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid NIRFI release version: ${version}`);
  }

  return version;
}

const requestedVersion = readRequestedVersion(process.argv.slice(2));
const requestedReleaseTag = requestedVersion ? `v${requestedVersion}` : undefined;
const releaseApiUrl = requestedReleaseTag
  ? `https://api.github.com/repos/${RELEASE_REPO}/releases/tags/${requestedReleaseTag}`
  : `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'toaoptics-hp-latest-json-updater'
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const res = await fetch(releaseApiUrl, { headers });

if (!res.ok) {
  throw new Error(`GitHub release API failed: ${res.status} ${res.statusText}`);
}

const release = await res.json();
const releaseVersion = versionFromTag(release.tag_name);

if (requestedVersion && releaseVersion !== requestedVersion) {
  throw new Error(`GitHub release tag mismatch: expected ${requestedReleaseTag}, got ${release.tag_name}`);
}

const current = JSON.parse(await readFile(latestJsonPath, 'utf8'));
const next = {
  ...current,
  latestVersion: releaseVersion,
  releaseTag: release.tag_name,
  releaseTitle: release.name || `NIRFI Viewer Software ${release.tag_name}`,
  releasedAt: release.published_at || release.created_at || current.releasedAt
};

for (const asset of release.assets || []) {
  const platform = platformByAssetName[asset.name];
  if (!platform) continue;

  const previous = current.platforms?.[platform.platformKey] || {};
  next.platforms[platform.platformKey] = {
    ...previous,
    supported: true,
    version: next.latestVersion,
    releaseTag: next.releaseTag,
    fileName: asset.name,
    assetType: platform.assetType,
    assetSizeBytes: asset.size,
    assetSizeDisplay: formatMiB(asset.size),
    downloadUrl: asset.browser_download_url,
    directAssetUrl: asset.browser_download_url,
    releasePageUrl: release.html_url,
    minimumSupportedVersion: previous.minimumSupportedVersion || '0.1.0',
    installMethod: platform.installMethod,
    signed: platform.signed
  };

  if ('notarized' in platform) {
    next.platforms[platform.platformKey].notarized = platform.notarized;
  }
}

await writeFile(latestJsonPath, `${JSON.stringify(next, null, 2)}\n`);
