export interface ModelScene { kind: string; controls: { name: string; min: number; max: number; step: number; default: number }[] }
export interface ModelResult {
  values: Record<string, number>;
  series: { label: string; fn(x: number): number; range: number }[];
  readouts: [string, string][]; notes: string[];
  spectrum: { f: number; label: string }[] | { family: number } | null;
  flow: { labels: string[]; active: number } | null;
  plots: { label: string; svg: string }[]; extraSvg: string | null;
}
declare const Models: {
  defaults(scene: ModelScene): Record<string, number>;
  values(scene: ModelScene, input: Record<string, number>): Record<string, number>;
  render(scene: ModelScene, input: Record<string, number>, cursor?: number): ModelResult;
  butterworth(frequency: number, cutoff: number): { gain: number; phase: number };
};
export default Models;
