// Hexagonal: npm run lint falha se uma camada importar o que não deve.
/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'domain-puro',
      comment: 'domain/ só usa TypeScript e builtins do Node: nada de app, infra ou pacotes npm.',
      severity: 'error',
      from: { path: '^src/[^/]+/domain/' },
      to: { pathNot: '^src/[^/]+/domain/', dependencyTypesNot: ['core', 'type-only'] },
    },
    {
      name: 'application-sem-infra',
      comment: 'application/ conhece domain e as próprias ports; de npm, só @nestjs/common (@Injectable).',
      severity: 'error',
      from: { path: '^src/[^/]+/application/' },
      to: {
        pathNot: ['^src/[^/]+/(application|domain)/', 'node_modules/@nestjs/common/'],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'sem-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.spec\\.ts$' },
  },
};
