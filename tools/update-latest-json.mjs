import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RELEASE_REPO = 'mitoudaisuke/NIRFI-RELEASE';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const latestJsonPath = path.resolve(__dirname, '..', 'latest.json');
const softwareHtmlPath = path.resolve(__dirname, '..', 'software.html');

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
const platformOrder = ['darwin-arm64', 'win32-x64'];
const platformLabels = {
  'darwin-arm64': 'macOS',
  'win32-x64': 'Windows'
};

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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;');
}

function getSupportedPlatforms(metadata) {
  return platformOrder
    .map((platformKey) => [platformKey, metadata.platforms?.[platformKey]])
    .filter(([, platform]) => platform?.supported !== false && platform?.fileName);
}

function formatPlatformVersionList(platforms) {
  return platforms
    .map(([platformKey, platform]) => `${platformLabels[platformKey] || platformKey} ${platform.version}`)
    .join(' / ');
}

function formatPlatformReleaseTagList(platforms, fallbackReleaseTag) {
  const tags = platforms
    .map(([, platform]) => platform.releaseTag)
    .filter(Boolean);

  if (tags.length > 0 && new Set(tags).size === 1) {
    return tags[0];
  }

  return platforms
    .map(([platformKey, platform]) => `${platformLabels[platformKey] || platformKey}: ${platform.releaseTag || fallbackReleaseTag}`)
    .join(' / ');
}

function formatReleaseHeading(platforms, fallbackVersion) {
  const versions = platforms
    .map(([, platform]) => platform.version)
    .filter(Boolean);

  if (versions.length > 0 && new Set(versions).size === 1) {
    return `NIRFI ${versions[0]}`;
  }

  return fallbackVersion ? `NIRFI platform releases` : 'NIRFI releases';
}

function formatAssetList(platforms, separator) {
  return platforms.map(([, platform]) => platform.fileName).join(separator);
}

function formatFileSizeList(platforms) {
  return platforms
    .map(([platformKey, platform]) => `${platformLabels[platformKey] || platformKey}: ${platform.assetSizeDisplay}`)
    .join(' / ');
}

function formatFileSizeDetail(platforms) {
  return platforms
    .map(([, platform]) => `${platform.fileName}: ${platform.assetSizeDisplay}`)
    .join('; ');
}

function replaceDataText(html, dataAttribute, value) {
  const pattern = new RegExp(`(<[^>]*\\s${dataAttribute}(?:=[^>]*)?[^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`, 'g');
  let matched = false;
  const nextHtml = html.replace(pattern, (_match, openTag, _text, closeTag) => {
    matched = true;
    return `${openTag}${escapeHtml(value)}${closeTag}`;
  });
  if (!matched) {
    throw new Error(`software.html did not contain ${dataAttribute}.`);
  }
  return nextHtml;
}

function replaceDownloadLink(html, platformKey, platform) {
  const pattern = new RegExp(`(<a\\b[^>]*data-nirfi-download="${platformKey}"[^>]*>)([\\s\\S]*?)(<\\/a>)`, 'g');
  let matched = false;
  const nextHtml = html.replace(pattern, (match, openTag, _text, closeTag) => {
    matched = true;
    const nextOpenTag = openTag.replace(
      /href="[^"]*"/,
      `href="${escapeAttribute(platform.downloadUrl || platform.directAssetUrl)}"`
    );
    return `${nextOpenTag}Download ${escapeHtml(platform.fileName)}${closeTag}`;
  });
  if (!matched) {
    throw new Error(`software.html did not contain download link for ${platformKey}.`);
  }
  return nextHtml;
}

function replaceReleaseLink(html, releasePageUrl) {
  const pattern = /(<a\b[^>]*data-nirfi-release-link[^>]*>)([\s\S]*?)(<\/a>)/g;
  let matched = false;
  const nextHtml = html.replace(pattern, (match, openTag, text, closeTag) => {
    matched = true;
    const nextOpenTag = openTag.replace(
      /href="[^"]*"/,
      `href="${escapeAttribute(releasePageUrl)}"`
    );
    return `${nextOpenTag}${text}${closeTag}`;
  });
  if (!matched) {
    throw new Error('software.html did not contain data-nirfi-release-link.');
  }
  return nextHtml;
}

function replacePlatformMeta(html, platformName, version, assetLabel) {
  const pattern = new RegExp(
    `(<div class="platform-name">${platformName}<\\/div>\\s*<div class="platform-meta">)Version [^<]+(&middot; ${assetLabel} &middot; [^<]+<\\/div>)`
  );
  let matched = false;
  const nextHtml = html.replace(pattern, (_match, prefix, suffix) => {
    matched = true;
    return `${prefix}Version ${escapeHtml(version)} ${suffix}`;
  });
  if (!matched) {
    throw new Error(`software.html did not contain platform metadata for ${platformName}.`);
  }
  return nextHtml;
}

function updateSoftwareHtmlFallback(html, metadata) {
  const platforms = getSupportedPlatforms(metadata);
  if (!platforms.length) {
    throw new Error('No supported NIRFI release platforms were found.');
  }

  let nextHtml = html;
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-latest-version', formatPlatformVersionList(platforms));
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-release-title', metadata.releaseTitle);
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-release-tag', formatPlatformReleaseTagList(platforms, metadata.releaseTag));
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-release-heading', formatReleaseHeading(platforms, metadata.latestVersion));
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-asset-list', formatAssetList(platforms, '; '));
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-file-size-list', formatFileSizeList(platforms));
  nextHtml = replaceDataText(nextHtml, 'data-nirfi-file-size-detail', formatFileSizeDetail(platforms));

  const macPlatform = metadata.platforms?.['darwin-arm64'];
  if (macPlatform) {
    nextHtml = replacePlatformMeta(nextHtml, 'macOS Apple Silicon', macPlatform.version, 'DMG');
    nextHtml = replaceDownloadLink(nextHtml, 'darwin-arm64', macPlatform);
  }

  const windowsPlatform = metadata.platforms?.['win32-x64'];
  if (windowsPlatform) {
    nextHtml = replacePlatformMeta(nextHtml, 'Windows x64', windowsPlatform.version, 'ZIP');
    nextHtml = replaceDownloadLink(nextHtml, 'win32-x64', windowsPlatform);
  }

  const releasePageUrl = platforms.map(([, platform]) => platform.releasePageUrl).find(Boolean);
  if (releasePageUrl) {
    nextHtml = replaceReleaseLink(nextHtml, releasePageUrl);
  }

  return nextHtml;
}

const currentSoftwareHtml = await readFile(softwareHtmlPath, 'utf8');
await writeFile(softwareHtmlPath, updateSoftwareHtmlFallback(currentSoftwareHtml, next));
