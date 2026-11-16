/**
 * 分项技术表(规则项 split.techFrom;riseRules.ts 第十三批,tech.ts 用)。一项技术一行:
 *   - cap、level:属于五种能力(inventions.ts 的 CAPS)里哪一样、在那把尺子上的哪一档;
 *   - 前提:techs(先要有的技术)、res(物产;本国地里有,或邻国、盟国有可以进口——进口的学得慢一半)、geo(沿海 / 大河);
 *   - 效果:只改它自己那个方向的事,阶跃(有了就乘,没有就不乘)。
 * 和引擎的发明表同名的那些档位一样;★ 是新加的。只放数据,不依赖推演模块。
 */

/** 物产编号(同 development.ts 的 Res;这里不引 development.ts,免得模块绕圈) */
export const T_RES = { Livestock: 1, Copper: 2, Iron: 3, Coal: 4, Timber: 5 } as const;

export interface TechRow {
  id: string;
  cap: number;
  level: number;
  techs?: readonly string[];
  /** 物产:列出的几样都要(本国有 / 可进口) */
  res?: readonly number[];
  /** 物产:列出的几样有一样就行 */
  resAny?: readonly number[];
  geo?: 'coast' | 'river';
  /** 乡村人口上限乘(scope:farm = 种得了地的州、不是游牧民族;river = 靠大河的州;all = 都乘) */
  rural?: number;
  scope?: 'farm' | 'river' | 'all';
  /** 城的人口上限乘 */
  city?: number;
  /** 饥荒赔率、饥荒折损、饥民起事赔率乘 */
  famine?: number;
  hit?: number;
  revolt?: number;
  /** 国力(兵员)乘 */
  mil?: number;
  /** 打仗(本方兵力乘;见 tech.ts 的 edgeOf) */
  field?: number;
  siege?: number;
  wall?: number;
  /** 马镫:平原、草原上野战乘这么多;对面有火器就作废 */
  horse?: number;
  /** 被这一项取代(有了那一项,这一项的打仗效果作废) */
  void?: string;
  /** 引进别人的技术快几倍、别人从你这里学快几倍 */
  learn?: number;
  teach?: number;
  /** 航线:有了以后隔海航线的传播从 SEA0 提到 SEA1 */
  ocean?: boolean;
}

const { Livestock, Copper, Iron, Coal, Timber } = T_RES;

/** 按档位排好(同一步里前提先过);改这张表 = 改规则 */
export const TECHS: readonly TechRow[] = [
  // ---- 生产 ----
  { id: '陶轮', cap: 0, level: 0.5, famine: 0.95, hit: 0.9 },
  { id: '灌溉', cap: 0, level: 1.2, geo: 'river', rural: 1.3, scope: 'river', hit: 0.85 },
  { id: '犁耕', cap: 0, level: 1.5, res: [Livestock], rural: 1.25, scope: 'farm' },
  { id: '水车', cap: 0, level: 2.6, geo: 'river', rural: 1.1, scope: 'river', city: 1.1 },
  { id: '轮作', cap: 0, level: 3.2, techs: ['犁耕'], rural: 1.2, scope: 'farm', famine: 0.8 },
  { id: '高炉', cap: 0, level: 3.4, res: [Iron], city: 1.1 },
  { id: '机械织机', cap: 0, level: 4.6, city: 1.2 },
  { id: '蒸汽机', cap: 0, level: 5.2, techs: ['高炉', '机械织机'], res: [Coal, Iron], city: 1.6 },
  { id: '化学肥料', cap: 0, level: 5.6, techs: ['蒸汽机', '轮作'], rural: 1.5, scope: 'farm', famine: 0.4 },
  // ---- 运输 ----
  { id: '车轮', cap: 1, level: 0.6 },
  { id: '帆船', cap: 1, level: 1.2, geo: 'coast' },
  { id: '驿道', cap: 1, level: 2.0, techs: ['车轮'], hit: 0.9 },
  { id: '运河', cap: 1, level: 2.8, geo: 'river', techs: ['驿道'], famine: 0.8 },
  { id: '指南针', cap: 1, level: 3.0, techs: ['帆船'] },
  { id: '远洋帆船', cap: 1, level: 3.7, geo: 'coast', techs: ['指南针'], res: [Timber], ocean: true },
  { id: '铁路', cap: 1, level: 5.4, techs: ['蒸汽机', '驿道'], res: [Iron], hit: 0.6, mil: 1.15 },
  // ---- 信息 ----
  { id: '文字', cap: 2, level: 0.7, learn: 1.3 },
  { id: '字母', cap: 2, level: 1.6, techs: ['文字'], learn: 1.2 },
  { id: '造纸', cap: 2, level: 2.5, techs: ['文字'], learn: 1.4, teach: 1.2 },
  { id: '印刷术', cap: 2, level: 3.4, techs: ['造纸'], learn: 2, teach: 1.5 },
  { id: '报刊', cap: 2, level: 4.6, techs: ['印刷术'] },
  { id: '电报', cap: 2, level: 5.6, techs: ['报刊', '铁路'], learn: 1.5 },
  // ---- 行政 ----
  { id: '成文法', cap: 3, level: 1.0, techs: ['文字'] },
  { id: '户籍', cap: 3, level: 1.8, techs: ['成文法'] },
  { id: '常平仓', cap: 3, level: 2.4, techs: ['户籍'], hit: 0.7, revolt: 0.6 },
  { id: '文官考选', cap: 3, level: 2.8, techs: ['户籍', '造纸'] },
  { id: '人口普查', cap: 3, level: 4.5, techs: ['文官考选'] },
  // ---- 军事 ----
  { id: '战车', cap: 4, level: 0.9, techs: ['车轮'], res: [Livestock], field: 1.15, void: '马镫' },
  { id: '马镫', cap: 4, level: 2.2, res: [Livestock], horse: 1.3 },
  { id: '常备军', cap: 4, level: 3.0, techs: ['户籍'], mil: 1.1 },
  { id: '棱堡', cap: 4, level: 3.8, techs: ['常备军', '高炉'], wall: 1.3 },
  { id: '火器', cap: 4, level: 4.1, resAny: [Iron, Copper], field: 1.25, siege: 1.5 },
  { id: '征兵制', cap: 4, level: 5.0, techs: ['户籍', '人口普查', '报刊'], mil: 1.5 },
];

export const TECH_COUNT = TECHS.length;
export const techIndex = (id: string): number => TECHS.findIndex((x) => x.id === id);
