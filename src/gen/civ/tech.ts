/**
 * 分项技术(规则项 split.techFrom;riseRules.ts 第十三批)。表在 techTable.ts。
 *
 * 一国有哪些技术(按国家记,国都那州说了算):
 *   - 起始那一步、新国第一次看到时:国都那州的能力离档位差 GRAND 以内、前提齐的,都算已有(承认已经发生的发展);
 *   - 以后每一步(发展度每 STEP 年一步):
 *       自创:国都那州的能力到了档位 − 0.1,前提齐 → 有了;
 *       引进:世上有国家会了,按渠道(接壤、隔海峡、航线、盟约宗藩、同奉国教、交战)之和 × 底子 × 本国的学习倍数 × 对方外传倍数,
 *             每年 TECH_BASE 的机会(这一步 dt 年里累计);底子 = 国都那州这样能力离档位差 0.8 以内 1、差 1.6 以内 0.3、更远学不会;
 *             要的物产本国没有、只能从邻国盟国进口的 × 0.5。
 *     有了以后国都那州这样能力当即提到档位 − 0.1(学会了就一下子赶上),国内照原来的同国学习往外传。
 *   - 效果全按“有没有”算,不看能力值:人口上限(乡村、城)、饥荒、饥民起事、国力、打仗。时代只剩名字。
 * 随机数 keyed4(seed, 国, 技术, 年, U_TECH);只由推演状态决定,逐年推和一口气推一样。
 */
import type { CivSim } from './engine/sim';
import { AdjKind, Layer } from './types';
import { keyed4 } from './engine/rand';
import { civApi } from './api';
import { faithSimOf } from './religion';
import { warModelOf } from './wars';
import { RISE_KNOBS } from './riseRules';
import { TECHS, TECH_COUNT, techIndex } from './techTable';
import type { PolityModel } from './polities';

export interface TechState {
  /** 国家 × 技术:有没有、哪一年有的(承认已有的记起始那一年) */
  has: Uint8Array[];
  at: Float64Array[];
  /** 国家看过没有(第一次看到时承认已有的) */
  seen: Uint8Array;
  /** 世上第一次有这项技术的年份、国家 */
  first: Float64Array;
  firstBy: Int32Array;
}

const U_TECH = 31;
/** 承认已有:能力离档位差这么多以内 */
const GRAND = 0.3;
const SELF_GAP = 0.1;
const NEAR = 0.8;
const FAR = 1.6;
const FAR_ABSORB = 0.3;
const IMPORT = 0.5;
/** 渠道权重 */
const W_LAND = 1;
const W_STRAIT = 0.5;
const SEA0 = 0.2;
const SEA1 = 0.6;
const W_PACT = 0.6;
const W_FAITH = 0.4;
const W_WAR_MIL = 1;
const W_WAR = 0.3;
const S_MAX = 3;
const H_MAX = 0.3;
/** 打仗:双方技术倍数之比封顶 */
const EDGE_MAX = 3;
/** 种得了地的地貌(草原、温带林、温带雨林、稀树草原、热带干林、湿地;同 biomes.ts 的 Biome) */
const FARM_BIOME = new Set([8, 9, 10, 12, 13, 15]);
const PLAIN = 500;

const I = {
  stirrup: techIndex('马镫'),
  gun: techIndex('火器'),
  ocean: techIndex('远洋帆船'),
};
const PRE: number[][] = TECHS.map((x) => (x.techs ?? []).map(techIndex));
const VOID: number[] = TECHS.map((x) => (x.void ? techIndex(x.void) : -1));

export function emptyTech(): TechState {
  return { has: [], at: [], seen: new Uint8Array(0), first: new Float64Array(TECH_COUNT).fill(Infinity), firstBy: new Int32Array(TECH_COUNT).fill(-1) };
}

/** 存进 DevState(铺平)、读回 */
export function packTech(st: TechState): { n: number; has: Uint8Array; at: Float64Array; seen: Uint8Array; first: Float64Array; firstBy: Int32Array } {
  const n = st.has.length;
  const has = new Uint8Array(n * TECH_COUNT);
  const at = new Float64Array(n * TECH_COUNT);
  for (let p = 0; p < n; p++) {
    has.set(st.has[p], p * TECH_COUNT);
    at.set(st.at[p], p * TECH_COUNT);
  }
  return { n, has, at, seen: st.seen.slice(), first: st.first.slice(), firstBy: st.firstBy.slice() };
}
export function unpackTech(x: { n: number; has: Uint8Array; at: Float64Array; seen: Uint8Array; first: Float64Array; firstBy: Int32Array }): TechState {
  const st: TechState = { has: [], at: [], seen: x.seen.slice(), first: x.first.slice(), firstBy: x.firstBy.slice() };
  for (let p = 0; p < x.n; p++) {
    st.has.push(x.has.slice(p * TECH_COUNT, (p + 1) * TECH_COUNT));
    st.at.push(x.at.slice(p * TECH_COUNT, (p + 1) * TECH_COUNT));
  }
  return st;
}

const grow = (st: TechState, P: number) => {
  while (st.has.length < P) {
    st.has.push(new Uint8Array(TECH_COUNT));
    st.at.push(new Float64Array(TECH_COUNT).fill(Infinity));
  }
  if (st.seen.length < P) {
    const s = new Uint8Array(Math.max(P, st.seen.length * 2));
    s.set(st.seen);
    st.seen = s;
  }
};

/** 一国此刻有的技术(推演外 / 没生效 = 空) */
export function techsOf(st: TechState | undefined, p: number): string[] {
  const h = st?.has[p];
  return h ? TECHS.filter((_, i) => h[i]).map((x) => x.id) : [];
}

export interface TechCtx {
  sim: CivSim;
  pm: PolityModel;
  seed: number;
  R: number;
  RC: number;
  cur: Float64Array;
  best: Float64Array;
  availNow: Float64Array;
  capR: Int32Array;
  write: (id: string, r: number, c: number, v: number) => void;
}

/** 这一步(y,距上一步 dt 年):承认已有、自创、引进 */
export function techStep(st: TechState, c: TechCtx, y: number, dt: number): void {
  const { sim, pm, R, RC, cur, availNow, capR } = c;
  const P = pm.polities.length;
  grow(st, P);
  const reg = pm.terrain.regions;
  const T = pm.terrain;
  const ownP = sim.owners[Layer.Polity];
  const api = civApi(sim);
  // 各国:沿海、靠大河、有的物产(按位)
  const coast = new Uint8Array(P);
  const river = new Uint8Array(P);
  const res = new Uint32Array(P);
  for (let r = 0; r < R; r++) {
    const p = ownP[r];
    if (p < 0) continue;
    if (pm.port[r]) coast[p] = 1;
    if (T.river[r] || T.riverSeat[r]) river[p] = 1;
    for (let k = 0; k < RC; k++) if (availNow[r * RC + k] > 0) res[p] |= 1 << k;
  }
  // 国与国的渠道:边界(按最好的一种邻接)、盟约宗藩、同奉国教、交战
  const link = new Map<number, Map<number, number>>();
  const land = new Map<number, Map<number, number>>();
  const add = (m: Map<number, Map<number, number>>, a: number, b: number, w: number, max = false) => {
    let x = m.get(a);
    if (!x) m.set(a, (x = new Map()));
    x.set(b, max ? Math.max(x.get(b) ?? 0, w) : (x.get(b) ?? 0) + w);
  };
  for (let r = 0; r < R; r++) {
    const p = ownP[r];
    if (p < 0) continue;
    for (let q = reg.adjStart[r]; q < reg.adjStart[r + 1]; q++) {
      const j = reg.adj[q];
      if (j >= R) continue;
      const o = ownP[j];
      if (o < 0 || o === p) continue;
      const k = reg.adjKind[q];
      add(land, p, o, k === AdjKind.SeaRoute ? -1 : k === AdjKind.Strait ? W_STRAIT : W_LAND, true);
    }
  }
  const alive = (p: number) => p >= 0 && p < P && capR[p] >= 0;
  const fs = faithSimOf(sim);
  const sf = new Int32Array(P).fill(-1);
  if (fs) for (let p = 0; p < P; p++) if (alive(p)) sf[p] = fs.stateFaith(p);
  const wm = warModelOf(sim);
  const war = new Set<number>();
  if (wm) for (const w of wm.active) war.add(w.a * 65536 + w.b), war.add(w.b * 65536 + w.a);
  const pacts = (p: number): number[] => {
    const out = api.diplomacy.alliesOf?.(p) ?? [];
    const L = api.diplomacy.liegeOf?.(p) ?? -1;
    return L >= 0 ? [...out, L] : out;
  };
  for (let p = 0; p < P; p++) {
    if (!alive(p)) continue;
    for (const [o, w] of land.get(p) ?? []) {
      // 航线:有远洋帆船的一方在内就是 SEA1
      const ww = w < 0 ? (st.has[p][I.ocean] || st.has[o]?.[I.ocean] ? SEA1 : SEA0) : w;
      add(link, p, o, ww);
    }
    for (const o of pacts(p)) if (alive(o) && o !== p) add(link, p, o, W_PACT), add(link, o, p, W_PACT);
  }
  const learnOf = (p: number) => {
    let m = 1;
    for (let i = 0; i < TECH_COUNT; i++) if (st.has[p][i] && TECHS[i].learn) m *= TECHS[i].learn!;
    return m;
  };
  const teachOf = (p: number) => {
    let m = 1;
    for (let i = 0; i < TECH_COUNT; i++) if (st.has[p][i] && TECHS[i].teach) m *= TECHS[i].teach!;
    return m;
  };
  // 物产:本国有 = 1;邻国、盟国有 = IMPORT;都没有 = 0
  const near = (p: number) => [...(land.get(p)?.keys() ?? []), ...pacts(p)];
  const resF = (p: number, i: number): number => {
    const X = TECHS[i];
    const need = X.res ?? [];
    const any = X.resAny ?? [];
    const own = (q: number, k: number) => alive(q) && (res[q] & (1 << k)) !== 0;
    let f = 1;
    for (const k of need) {
      if (own(p, k)) continue;
      if (near(p).some((q) => own(q, k))) f = IMPORT;
      else return 0;
    }
    if (any.length && !any.some((k) => own(p, k))) {
      if (near(p).some((q) => any.some((k) => own(q, k)))) f = IMPORT;
      else return 0;
    }
    return f;
  };
  const ready = (p: number, i: number) => {
    const X = TECHS[i];
    if (X.geo === 'coast' && !coast[p]) return false;
    if (X.geo === 'river' && !river[p]) return false;
    for (const j of PRE[i]) if (!st.has[p][j]) return false;
    return true;
  };
  const gain = (p: number, i: number, t: number) => {
    const X = TECHS[i];
    st.has[p][i] = 1;
    st.at[p][i] = t;
    if (t < st.first[i]) (st.first[i] = t), (st.firstBy[i] = p);
    // 国都那州这样能力当即提到档位 − 0.1
    const r = capR[p];
    const o = r * 5 + X.cap;
    const v = X.level - SELF_GAP;
    if (cur[o] < v) {
      cur[o] = v;
      if (X.cap < 4) {
        c.write('能力', r, X.cap, v);
        if (c.best[o] < v) {
          c.best[o] = v;
          c.write('最高', r, X.cap, v);
        }
      } else c.write('动员', r, 0, v);
    }
  };
  const vOf = (p: number, i: number) => cur[capR[p] * 5 + TECHS[i].cap];
  // 新国:承认已有
  const fresh: number[] = [];
  for (let p = 0; p < P; p++) {
    if (!alive(p) || st.seen[p]) continue;
    st.seen[p] = 1;
    fresh.push(p);
    for (let i = 0; i < TECH_COUNT; i++) {
      if (!ready(p, i) || !resF(p, i)) continue;
      if (vOf(p, i) >= TECHS[i].level - GRAND) {
        st.has[p][i] = 1;
        st.at[p][i] = y;
        if (y < st.first[i]) (st.first[i] = y), (st.firstBy[i] = p);
      }
    }
  }
  if (!(dt > 0)) return;
  const k = pm.knobs.get(RISE_KNOBS);
  const base = k.TECH_BASE;
  // 这一步开头谁会了什么(同一步里刚学会的不再外传)
  const holders: number[][] = TECHS.map(() => []);
  for (let p = 0; p < P; p++) if (alive(p)) for (let i = 0; i < TECH_COUNT; i++) if (st.has[p][i]) holders[i].push(p);
  const isFresh = new Set(fresh);
  for (let p = 0; p < P; p++) {
    if (!alive(p) || isFresh.has(p)) continue;
    const L = link.get(p);
    for (let i = 0; i < TECH_COUNT; i++) {
      if (st.has[p][i] || !ready(p, i)) continue;
      const rf = resF(p, i);
      if (!rf) continue;
      const X = TECHS[i];
      const v = vOf(p, i);
      if (v >= X.level - SELF_GAP) {
        gain(p, i, y);
        continue;
      }
      const ab = v >= X.level - NEAR ? 1 : v >= X.level - FAR ? FAR_ABSORB : 0;
      if (!ab || !holders[i].length) continue;
      let S = 0;
      const mil = X.cap === 4;
      for (const q of holders[i]) {
        let w = L?.get(q) ?? 0;
        if (sf[p] >= 0 && sf[p] === sf[q]) w += W_FAITH;
        if (war.has(p * 65536 + q)) w += mil ? W_WAR_MIL : W_WAR;
        if (w > 0) S += w * teachOf(q);
      }
      if (!(S > 0)) continue;
      const h = Math.min(H_MAX, base * Math.min(S_MAX, S) * ab * learnOf(p) * rf);
      const pr = 1 - Math.pow(1 - h, dt);
      const u = keyed4(c.seed, pm.ptag[p], i, Math.floor(y), U_TECH);
      if (u < pr) gain(p, i, Math.floor(y - dt * (1 - u / pr)));
    }
  }
}

// ---- 效果 ----
const prodOf = (st: TechState, p: number, f: (x: (typeof TECHS)[number]) => number | undefined) => {
  const h = st.has[p];
  let m = 1;
  if (h) for (let i = 0; i < TECH_COUNT; i++) if (h[i]) { const v = f(TECHS[i]); if (v !== undefined) m *= v; }
  return m;
};

/** 州 r(归国 p)乡村人口上限的倍数:按这州种不种得了地、靠不靠大河 */
export function ruralMulOf(st: TechState, pm: PolityModel, p: number, r: number, nomad: boolean): number {
  if (p < 0 || !st.has[p]) return 1;
  const T = pm.terrain;
  const farm = !nomad && FARM_BIOME.has(T.regions.biome[r]);
  const riv = !!(T.river[r] || T.riverSeat[r]);
  return prodOf(st, p, (x) => (x.rural === undefined ? undefined : x.scope === 'all' || (x.scope === 'farm' && farm) || (x.scope === 'river' && riv) ? x.rural : undefined));
}
export const cityMulOf = (st: TechState, p: number) => (p >= 0 ? prodOf(st, p, (x) => x.city) : 1);
export const famineMulOf = (st: TechState, p: number) => (p >= 0 ? prodOf(st, p, (x) => x.famine) : 1);
export const hitMulOf = (st: TechState, p: number) => (p >= 0 ? prodOf(st, p, (x) => x.hit) : 1);
export const revoltMulOf = (st: TechState, p: number) => (p >= 0 ? prodOf(st, p, (x) => x.revolt) : 1);
export const milMulOf = (st: TechState, p: number) => (p >= 0 ? prodOf(st, p, (x) => x.mil) : 1);

/** x 攻 y 的州 r:双方兵力各乘多少(比值封顶 EDGE_MAX) */
export function edgeOf(st: TechState, pm: PolityModel, x: number, y: number, r: number): [number, number] {
  const hx = st.has[x];
  const hy = st.has[y];
  if (!hx || !hy) return [1, 1];
  const reg = pm.terrain.regions;
  const open = reg.elevation[r] < PLAIN || reg.biome[r] === 8;
  const city = pm.cityOf[r] >= 0;
  const side = (h: Uint8Array, o: Uint8Array, att: boolean) => {
    let m = 1;
    for (let i = 0; i < TECH_COUNT; i++) {
      if (!h[i]) continue;
      const X = TECHS[i];
      if (VOID[i] >= 0 && h[VOID[i]]) continue;
      if (X.horse && open && !o[I.gun]) m *= X.horse;
      if (att && city && X.siege) m *= X.siege;
      else if (X.field) m *= X.field;
      if (!att && city && X.wall) m *= X.wall;
    }
    return m;
  };
  let kx = side(hx, hy, true);
  let ky = side(hy, hx, false);
  if (kx > EDGE_MAX * ky) kx = EDGE_MAX * ky;
  if (ky > EDGE_MAX * kx) ky = EDGE_MAX * kx;
  return [kx, ky];
}
