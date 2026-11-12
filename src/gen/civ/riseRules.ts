import { defineKnobs } from './engine/knobs';

/**
 * 新立国规则(规则项 split.riseFrom;从 FROM 年起才生效,之前的历史照旧;65535 = 不用):
 *   - 大城自立、边缘立国更勤:politics.ts
 *   - GRACE:这一年起新立的国家(非分裂 / 复国的;那两种另有 wars.NEWBORN)头 GRACE 年内别国不对它宣战
 *   - DIP_FIRST:这一年起新立的国家,立国满这么多年就开始看邦交(称臣、结盟、立约);原来是 50 年
 *   - 战争(wars.ts):小国丢国都后只剩 1 州才亡;小国加成看国力差;灭国之战门槛 4 倍
 *   - 邦交(diplomacy.ts):被大国宣战可当场称臣罢兵
 *   - 分藩(politics.ts):大国分裂、崩解出去的州,不少仍向原国称臣,日后宗主衰弱或藩属壮大再自立(diplomacy 原有的藩属自立)
 */
export const RISE_KNOBS = defineKnobs('rise', {
  FROM: 65535,
  /** 立国潮:到这一年(不含)为止,够格的大城、边地一律立国(不掷机会、不限个数);0 = 没有 */
  RUSH_UNTIL: 0,
  /** 第二批(疆域超出治理能力、借道援救)从这一年起生效(规则项 split.limitFrom);65535 = 不用 */
  FROM2: 65535,
  GRACE: 5,
  DIP_FIRST: 1,
  /** 丢了国都、只剩不到这么多州才撑不下去(原 wars.MIN_STATE = 4:小国丢一州就亡) */
  MIN_STATE: 2,
  /** 小国加成(wars.PREY_ODDS)只在攻方国力是对方这么多倍以上时才算:小国之间不互相当猎物 */
  PREY_GAP: 3,
  /** 灭国之战、连续吞并、破都纳降的国力差(原 2.5 倍) */
  CRUSH: 4,
  /** 被宣战当场称臣:国力差这么多倍以上、守方不超过 SUBMIT_MAX 州时,基础机会 DECLARE_SUBMIT(再乘守方君主肯不肯称臣、同族异族、离攻方远近) */
  DECLARE_RATIO: 3,
  DECLARE_SUBMIT: 0.3,
  /** 分藩:大国分裂出去的一块,原国还比它大 VASSAL_SIZE 倍以上、没在打仗时,有 VASSAL_SPLIT 的机会仍向原国称臣(同族;异族 × VASSAL_FOREIGN);大崩解散出去的 × VASSAL_COLLAPSE */
  VASSAL_SIZE: 2,
  VASSAL_SPLIT: 0.5,
  VASSAL_FOREIGN: 0.5,
  VASSAL_COLLAPSE: 0.5,
  /**
   * 疆域超出治理能力(control.ts 的动荡):能稳管的州数 = OVER_BASE + OVER_PER × 国都的行政能力(0–9);
   * 超出几成,动荡加 OVER_W × 超出的倍数(最多 OVER_MAX)。动荡高了:分裂、割据、民变、大崩解、被邻国趁虚而入都更容易(这些原有的规则都读动荡)
   */
  OVER_BASE: 6,
  OVER_PER: 3,
  OVER_W: 1,
  OVER_MAX: 1.5,
  /**
   * 借道援救:盟国、宗主不和攻方接壤,也能借道出兵——从自己的国土走陆路 / 已会的海路,沿途只经过自己、守方、无主之地、
   * 或肯借道的国家(没和自己交战、不是攻方的盟国 / 藩属),最多 FAR_HOPS 州;出兵的机会再乘 FAR_JOIN
   */
  /** 治理极限下大国更易分裂:分裂门槛 SPLIT_D0 降 LIMIT_D0_CUT、赔率再乘 LIMIT_SPLIT_MUL(politics.ts) */
  LIMIT_D0_CUT: 0.4,
  LIMIT_SPLIT_MUL: 1.5,
  /** 起兵成团的门槛放低:离心力够 LIMIT_GROUP_MIN_D 的州就肯跟着走,凑够 LIMIT_MIN_GROUP 州就能自立(原 1.0、5 州) */
  LIMIT_GROUP_MIN_D: 0.6,
  LIMIT_MIN_GROUP: 3,
  FAR_HOPS: 14,
  FAR_JOIN: 0.6,
  /** 第三批(商路之利)从这一年起生效(规则项 split.tradeFrom);65535 = 不用 */
  FROM3: 65535,
  /**
   * 商路之利(control.ts 填钱粮的输入时算,记在"收贡"一栏里):通着的商道给沿途的国家添进项。
   * 一条商道:买方、产地所属的国各记 1 份,只是过境的国各记 TRADE_PASS 份;
   * 每份 = 本国应缴的 TRADE_PER,再乘当朝的重商倾向(50 = 1 倍,每偏 50 增减 TRADE_LEAN),全国最多应缴的 TRADE_CAP。
   * 商道断了、废了就没有;按上一个整步(商道每 20 年算一步)时通着的商道算,和推演怎么分段无关
   */
  TRADE_PER: 0.04,
  TRADE_PASS: 0.5,
  TRADE_LEAN: 0.5,
  TRADE_CAP: 0.15,
});
