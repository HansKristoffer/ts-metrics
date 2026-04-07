import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(scriptDir, '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'ts-metrics-pack-'))

let tarballPath

function run(command, args, cwd) {
	return execFileSync(command, args, {
		cwd,
		stdio: 'pipe',
		encoding: 'utf8'
	})
}

try {
	run('bun', ['run', 'build'], rootDir)
	const packOutput = run('npm', ['pack', '--json', '--ignore-scripts'], rootDir)
	const [{ filename }] = JSON.parse(packOutput)
	tarballPath = path.join(rootDir, filename)

	writeFileSync(
		path.join(tempDir, 'package.json'),
		JSON.stringify(
			{
				name: 'ts-metrics-smoke',
				private: true,
				type: 'module'
			},
			null,
			2
		)
	)

	run(
		'npm',
		['install', '--no-package-lock', '--no-save', tarballPath, 'zod'],
		tempDir
	)

	writeFileSync(
		path.join(tempDir, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					target: 'ES2022',
					module: 'NodeNext',
					moduleResolution: 'NodeNext',
					strict: true,
					noEmit: true,
					skipLibCheck: true
				},
				include: ['smoke.ts']
			},
			null,
			2
		)
	)

	writeFileSync(
		path.join(tempDir, 'smoke.ts'),
		`import { z } from 'zod'
import { BaseFiltersSchema, createMetricsEngine, defineKpiOutput } from 'ts-metrics'
import { createMetricsRouter } from 'ts-metrics/orpc'
import { redisCacheAdapter } from 'ts-metrics/cache-redis'
import { defineMetricsRequest } from 'ts-metrics/frontend'
import { resolveMetricType } from 'ts-metrics/helpers'

const engine = createMetricsEngine<
  { viewerId: string },
  z.infer<typeof BaseFiltersSchema>
>({
  cache: redisCacheAdapter({
    async mget(...keys) {
      return keys.map(() => null)
    },
    pipeline() {
      return {
        setex() {
          return this
        },
        async exec() {}
      }
    }
  })
})

const metric = engine.defineKpiMetric({
  key: 'users.active',
  description: 'Active users',
  supportsTimeRange: false,
  filterSchema: BaseFiltersSchema,
  async resolve() {
    return defineKpiOutput({
      value: 1,
      label: resolveMetricType(undefined, 'TOTAL')
    })
  }
})

const registry = engine.createRegistry([metric] as const)

createMetricsRouter({
  registry,
  createContext: async (ctx: { viewerId: string }) => ctx
})

defineMetricsRequest<typeof registry>({
  metrics: [{ key: 'users.active' }] as const
})
`
	)

	writeFileSync(
		path.join(tempDir, 'smoke.mjs'),
		`import { BaseFiltersSchema, createMetricsEngine, defineKpiOutput } from 'ts-metrics'
import { createMetricsRouter } from 'ts-metrics/orpc'
import { redisCacheAdapter } from 'ts-metrics/cache-redis'
import { defineMetricsRequest } from 'ts-metrics/frontend'
import { resolveMetricType } from 'ts-metrics/helpers'

const engine = createMetricsEngine()
const metric = engine.defineKpiMetric({
  key: 'runtime.metric',
  description: 'Runtime metric',
  supportsTimeRange: false,
  filterSchema: BaseFiltersSchema,
  async resolve() {
    return defineKpiOutput({
      value: 1,
      label: resolveMetricType(undefined, 'TOTAL')
    })
  }
})
const router = createMetricsRouter({
  registry: engine.createRegistry([metric]),
  createContext: async (ctx) => ctx
})

const cache = redisCacheAdapter({
  async mget() {
    return []
  },
  pipeline() {
    return {
      setex() {
        return this
      },
      async exec() {}
    }
  }
})

if (!engine || !router || !cache || !defineMetricsRequest || !resolveMetricType) {
  throw new Error('Failed to load published entry points')
}
`
	)

	run(
		'node',
		[path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'],
		tempDir
	)
	run('node', ['smoke.mjs'], tempDir)
} finally {
	if (tarballPath) {
		rmSync(tarballPath, { force: true })
	}
	rmSync(tempDir, { recursive: true, force: true })
}
