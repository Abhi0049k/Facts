export function stageNumberFromName(stageName: string | undefined): number | null {
  if (!stageName) {
    return null;
  }
  const spaced = stageName.match(/stage\s+(\d+)/i);
  if (spaced) {
    return Number(spaced[1]);
  }
  const glued = stageName.match(/stage(\d+)/i);
  return glued ? Number(glued[1]) : null;
}
