/** Operational env — `SPATIAL_AI_*` prefix (organization-neutral). */
export function readSpatialAiEnv(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const key = name.startsWith('SPATIAL_AI_') ? name : `SPATIAL_AI_${name}`
  const value = env[key]?.trim()
  return value || undefined
}