// Keeps build-time tools out of the API's production install (`pnpm install --prod`, the
// runtime image). pnpm resolves an optional peer whenever the importer has the package, even as
// a devDependency, and installs it with the production dependencies:
// - `@prisma/client` names the Prisma CLI (`prisma`) as one; only the old `prisma-client-js`
//   generator needed it. With it resolved the image carried the CLI, Studio, effect, pglite and
//   React (≈ 240 MB). Migrations run in their own image (apps/migrate), the API never calls it.
// - `@prisma/client` and `@nestjs/swagger` name `typescript`: for type generation and swagger's
//   compiler plugin, neither of which runs in production (≈ 24 MB).
// Changing this file changes `pnpmfileChecksum` in the lockfile: run `pnpm install` after it.
const DROPPED_PEERS = {
  '@prisma/client': ['prisma', 'typescript'],
  '@nestjs/swagger': ['typescript'],
};

function readPackage(pkg) {
  for (const peer of DROPPED_PEERS[pkg.name] ?? []) {
    if (pkg.peerDependencies) delete pkg.peerDependencies[peer];
    if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[peer];
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
