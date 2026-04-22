const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { compareStablePath } = require('./fs.js');

function payloadSha256(rootDir) {
  const files = [];

  function walk(currentDir) {
    const children = fs
      .readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => compareStablePath(left.name, right.name));

    for (const child of children) {
      const absolutePath = path.join(currentDir, child.name);
      const relativePath = path
        .relative(rootDir, absolutePath)
        .split(path.sep)
        .join('/');

      if (relativePath.startsWith('_meta/')) {
        continue;
      }

      if (child.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      files.push([relativePath, fs.readFileSync(absolutePath)]);
    }
  }

  walk(rootDir);
  files.sort((left, right) => compareStablePath(left[0], right[0]));

  const hasher = crypto.createHash('sha256');
  for (const [relativePath, content] of files) {
    hasher.update(relativePath);
    hasher.update(Buffer.from([0]));
    hasher.update(content);
    hasher.update(Buffer.from([0]));
  }

  return `sha256:${hasher.digest('hex')}`;
}

function writeOfficialSignatureFiles(stagedRoot, options) {
  const privateKeyPem = fs.readFileSync(options.signingKeyPemFile, 'utf8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const release = {
    schema_version: 1,
    plugin_id: options.pluginId,
    provider_code: options.providerCode,
    version: options.version,
    contract_version: options.contractVersion,
    artifact_sha256: options.artifactSha256,
    payload_sha256: payloadSha256(stagedRoot),
    signature_algorithm: 'ed25519',
    signing_key_id: options.signingKeyId,
    issued_at: options.issuedAt,
  };
  const releaseBytes = Buffer.from(JSON.stringify(release), 'utf8');
  const signature = crypto.sign(null, releaseBytes, privateKey);
  const metaDir = path.join(stagedRoot, '_meta');

  fs.mkdirSync(metaDir, { recursive: true });
  fs.writeFileSync(path.join(metaDir, 'official-release.json'), releaseBytes);
  fs.writeFileSync(path.join(metaDir, 'official-release.sig'), signature);

  return {
    signatureAlgorithm: release.signature_algorithm,
    signingKeyId: release.signing_key_id,
  };
}

module.exports = {
  payloadSha256,
  writeOfficialSignatureFiles,
};
