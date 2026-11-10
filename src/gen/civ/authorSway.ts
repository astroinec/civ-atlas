/**
 * 作者的人物左右天下的三条干预(字段见 gen/edits.ts):不当君主的名臣、国师、元老也能推一把历史。
 *   mission 传教:b 国此刻所奉之教在 a 国(a 那时的国土)传得快 mul 倍,from 到 until(不含)
 *   urge    倡议学说:a 国鼓吹第 idea 说,国中已传进来(接受度过 URGE_FOOT)的州每一步往 1 靠 URGE_MIX(ideology.ts 每 20 年一步)
 *   sway    议事施压:a 国议 issue 这一类议题时分数推一把 / 拦一把 SWAY(council.ts、reform.ts 的 x)
 * 史事:intervene,a = 国家,b = −1 生效了 / −3 那一年这国已亡 / IV_NO_FAITH 传教的那国没有国教;war = 第几条干预,n = 传的是哪个教(传教)。
 * **不存内存状态**:生效的由史事 intervene(b = −1)+ 干预列表推出来(installSways);没下这三样的世界逐字节不变。纯计算,不碰 DOM。
 */
import type { Intervention, SwayIssue } from '../edits';
import type { CivSim } from './engine/sim';
import { interventionModelOf, type InterventionModel } from './interventions';
import { Issue } from './councilRules';
import type { Annal, Civ, Year } from './types';
import { faithSimOf } from './religion';

export type SwayKindIv = Extract<Intervention, { kind: 'mission' | 'urge' | 'sway' }>;

/** 史事 intervene 的 b:传教的那国此刻没有国教 */
export const IV_NO_FAITH = -21;
/** 倡议:接受度到这么多才算"已传进来"(之前倡也没人听) */
export const URGE_FOOT = 0.02;
/** 倡议:每一步往 1 靠几成 */
export const URGE_MIX = 0.12;
/** 施压:议事分数加减多少(随机那一截是 ±0.4) */
export const SWAY = 0.35;

/** 一段生效的:哪国(p)、哪一样(k:传教 = 教,倡议 = 第几说,施压 = 议题)、哪几年、多少(w:传教 = 倍数,施压 = ±SWAY) */
export interface SwaySeg {
  p: number;
  k: number;
  from: Year;
  until: Year;
  w: number;
}
interface Segs {
  mission: SwaySeg[];
  urge: SwaySeg[];
  sway: SwaySeg[];
}
const store = new WeakMap<CivSim, Segs>();
const EMPTY: readonly SwaySeg[] = [];

/** 施压的几类议题 → 议事的议题与方向(+1 = for 那一边更容易办成) */
export const SWAY_MAP: Record<SwayIssue, readonly (readonly [Issue, number])[]> = {
  tax: [
    [Issue.Tax, 1],
    [Issue.Untax, -1],
  ],
  army: [
    [Issue.ArmyIn, 1],
    [Issue.ArmyOut, -1],
  ],
  office: [
    [Issue.OfficeIn, 1],
    [Issue.OfficeOut, -1],
  ],
  fief: [
    [Issue.Fief, 1],
    [Issue.Unfief, -1],
  ],
  cut: [
    [Issue.Cut, 1],
    [Issue.Reorg, 1],
  ],
  reform: [
    [Issue.Charter, 1],
    [Issue.Widen, 1],
    [Issue.Abolish, 1],
  ],
};

function segOf(v: SwayKindIv, a: number, n: number): { kind: keyof Segs; seg: SwaySeg } {
  if (v.kind === 'mission') return { kind: 'mission', seg: { p: a, k: n, from: v.from, until: v.until, w: v.mul } };
  if (v.kind === 'urge') return { kind: 'urge', seg: { p: a, k: v.idea, from: v.from, until: v.until, w: 1 } };
  return { kind: 'sway', seg: { p: a, k: SWAY_ISSUES_INDEX[v.issue], from: v.from, until: v.until, w: v.side === 'for' ? SWAY : -SWAY } };
}
const SWAY_ISSUES_INDEX: Record<SwayIssue, number> = { tax: 0, army: 1, office: 2, fief: 3, cut: 4, reform: 5 };
const SWAY_BY_INDEX: SwayIssue[] = ['tax', 'army', 'office', 'fief', 'cut', 'reform'];

/** 挂上(interventions.ts 的 installInterventions;一口气推和接着推都走这里):已生效的由史事推出来。列表里没有这三样 = 什么都不挂 */
export function installSways(sim: CivSim, iv: InterventionModel): void {
  store.set(sim, segsFrom(iv.list, sim.annalCount, (k) => sim.annal(k)));
}

/** 照史事 intervene(b = −1)+ 干预列表推出生效的几段 */
function segsFrom(list: readonly Intervention[], n: number, annal: (k: number) => Annal): Segs {
  const segs: Segs = { mission: [], urge: [], sway: [] };
  if (!list.some((v) => v.kind === 'mission' || v.kind === 'urge' || v.kind === 'sway')) return segs;
  for (let k = 0; k < n; k++) {
    const e = annal(k);
    if (e.kind !== 'intervene' || e.b !== -1) continue;
    const v = list[e.war];
    if (v?.kind !== 'mission' && v?.kind !== 'urge' && v?.kind !== 'sway') continue;
    const s = segOf(v, e.a, e.n ?? -1);
    segs[s.kind].push(s.seg);
  }
  return segs;
}

/** 生效那一刻(interventions.ts 在 from 那一刻调用;a = 国家此刻的编号,第 i 条干预) */
export function strikeSway(sim: CivSim, iv: InterventionModel, v: SwayKindIv, i: number, a: number, t: Year): void {
  const pm = iv.pm!;
  const P = pm.polities[a];
  const at = { a, region: -1, settlement: -1, war: i };
  if (P.ended !== undefined) return void sim.record('intervene', { ...at, b: -3 });
  let n = -1;
  if (v.kind === 'mission') {
    const b = iv.resolve(v.b);
    const fs = faithSimOf(sim);
    n = b >= 0 && fs ? fs.stateFaith(b) : -1;
    if (n < 0) return void sim.record('intervene', { ...at, b: IV_NO_FAITH });
  }
  sim.record('intervene', { ...at, b: -1, ...(n >= 0 ? { n } : {}) });
  let segs = store.get(sim);
  if (!segs) store.set(sim, (segs = { mission: [], urge: [], sway: [] }));
  const s = segOf(v, a, n);
  segs[s.kind].push(s.seg);
  void t;
}

/** 此刻生效的几段(没有 = 空) */
export function swaySegs(sim: CivSim, kind: keyof Segs, civ?: Pick<Civ, 'annals' | 'interventions'>): readonly SwaySeg[] {
  // 接着推时信仰先于干预恢复(modules.ts 的次序):还没挂上就照 civ 的史事 + 干预列表先推出来(干预模型装上时会照同样的史事重推一遍)
  if (!store.has(sim)) {
    const iv = interventionModelOf(sim);
    if (iv) installSways(sim, iv);
    else if (civ?.interventions?.length) store.set(sim, segsFrom(civ.interventions, civ.annals.length, (k) => civ.annals[k]));
  }
  return store.get(sim)?.[kind] ?? EMPTY;
}

/** 议事施压:p 国此刻议 issue 时的加减(没有 = 0,调用方不加) */
export function swayBias(sim: CivSim, p: number, issue: Issue, t: Year): number {
  const segs = swaySegs(sim, 'sway');
  if (!segs?.length) return 0;
  let x = 0;
  for (const s of segs) {
    if (s.p !== p || t < s.from || t >= s.until) continue;
    for (const [is, sign] of SWAY_MAP[SWAY_BY_INDEX[s.k]]) if (is === issue) x += s.w * sign;
  }
  return x;
}
