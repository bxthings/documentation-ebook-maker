export function isSubpath(seedUrl: string, candidateUrl: string): boolean {
  const seed = new URL(seedUrl);
  const candidate = new URL(candidateUrl);
  if (seed.origin !== candidate.origin) return false;
  const seedPath = seed.pathname.replace(/\/$/, '');
  const candidatePath = candidate.pathname.replace(/\/$/, '');
  return candidatePath === seedPath || candidatePath.startsWith(seedPath + '/');
}
