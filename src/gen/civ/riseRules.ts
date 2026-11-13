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
  /** 第四批(自由结盟)从这一年起生效(规则项 split.pactFrom);65535 = 不用 */
  FROM4: 65535,
  /**
   * 自由结盟(diplomacy.ts):结盟少设门槛。
   *   - 候选不只是强邻的邻国,自己够得着的国家都算:接壤的,和国都离自己国都不超过 PACT_RANGE 路程的(不接壤也行);
   *   - 不再要求对方国力够强邻的几成、也不再要求对方同样怕这个强邻;
   *   - 没有够得上"强邻"的邻国时,也可以对着够得着的国家里最强的那个不友好的找盟友;
   *   - 不看对方比自己强多少:每次看邦交,有合适的盟友就按 PACT_FREE 的赔率结(0.7 ≈ 四成;正同在交兵的再 × 3);
   *   - 一国最多结 PACT_MAX 个盟、断盟后歇 PACT_REST 年就能再结(原来 2 个、100 年)。
   * 还留着的只有:藩属不另结盟、已在交兵的不结、方针里的仇国不结、强邻自己的盟友藩属不结。
   */
  PACT_MAX: 4,
  PACT_REST: 30,
  PACT_FREE: 0.7,
  PACT_RANGE: 20,
  /** 第五批(农耕守势)从这一年起生效(规则项 split.farmDefFrom);65535 = 不用 */
  FROM5: 65535,
  /** 农耕守势(wars.ts):农耕国、大河国在本族的州上防守,守方兵力再乘这么多 */
  FARM_DEF: 1.15,
  /** 第六批(发展倾向)从这一年起生效(规则项 split.devLeanFrom);65535 = 不用 */
  FROM6: 65535,
  /** 发展倾向(development.ts):当朝说了算的人"发展"倾向每偏 50,本国各州四样能力"自己长"增减这么多 */
  DEV_LEAN: 0.1,
  /**
   * 第七批(疆土与封建)从这一年起生效(规则项 split.realmFrom);65535 = 不用:
   *   ① 新国不急着称臣(diplomacy.ts):立国不满 SUBMIT_GRACE 年的国家不主动遣使称臣、被宣战也不当场称臣(战败称臣照旧;分藩、分封的不算)
   *   ② 分封(politics.ts):国土至少 FEUD_MIN 州、超出国都能稳管的州数(OVER_BASE + OVER_PER × 行政能力)、没在打仗的大国,
   *      每次看内政有 FEUD_P × 2 × 超出的倍数(最多 1)的机会,把离国都最远的 FEUD_GROUP_MIN–FEUD_GROUP_MAX 州(不超过国土 FEUD_FRAC;
   *      在打仗时不封挨着敌国的州)分封出去立国,受封的国家向它称臣;分封以后 FEUD_REST 年内不再分封;
   *      超出能稳管州数的大国宣战赔率 × (能稳管 ÷ 州数)^OVER_WAR_EXP,新立的国家挨打 × YOUNG_PREY
   *   ③ 无主大城立国更容易,还能合众(politics.ts):人口过 BIG7_POP(千人)就行,不看城龄、人口上限和国都间距;立国时把挨着的、同族、有城(人口过 FED_POP)的无主州一并带上,最多 FED_MAX 州;
   *      紧挨别国国都的大城先有 ABSORB_P 的机会被那国和平收编
   *   ⑤ 厌战(wars.ts):同一对国家来回拉锯、得失相抵的仗,打得越多越不想再打、打起来也越早议和
   *   ④ 州自身的地形(wars.ts):守方按那州的平均海拔、地貌再乘 TERRAIN_*;游牧国攻打山地、林地、湿地 × NOMAD_ROUGH,攻打草原、荒漠 × NOMAD_OPEN
   */
  FROM7: 65535,
  SUBMIT_GRACE: 40,
  /** 立国不满 SUBMIT_GRACE 年的国家挨打的赔率倍数;超出能稳管州数的大国宣战赔率 × (能稳管 ÷ 州数)^OVER_WAR_EXP */
  YOUNG_PREY: 0.5,
  OVER_WAR_EXP: 2,
  FEUD_MIN: 14,
  FEUD_P: 0.6,
  FEUD_GROUP_MIN: 2,
  FEUD_GROUP_MAX: 4,
  FEUD_FRAC: 0.2,
  FEUD_REST: 60,
  BIG7_CAP: 0,
  BIG7_POP: 10,
  BIG7_AGE: 0,
  BIG7_P: 0.5,
  BIG7_MAX: 6,
  FED_POP: 8,
  FED_MAX: 3,
  /**
   * 无主大城不看国都间距;紧挨着在世国家国都(陆上 1 跳)的,每次看部落地带先有 ABSORB_P 的机会被那一国和平收编(纳入版图),
   * 没收编的照样可以自立。人口 ≥ ABSORB_POP 的城才收编(小村落不值得)
   */
  ABSORB_P: 0.35,
  ABSORB_POP: 5,
  /**
   * 厌战(wars.ts):两国近 WEARY_YEARS 年里已打过 n 场仗、彼此净得失不超过 WEARY_NET 州(拉锯)时,
   * 再开战的赔率 × WEARY_DECLARE^n(两场起算),正在打的这场的年限 × WEARY_LEN^n(早些议和)
   */
  WEARY_YEARS: 80,
  WEARY_NET: 1,
  WEARY_DECLARE: 0.5,
  WEARY_LEN: 0.7,
  /** 海拔(米)≥ 这几档时守方的倍数 */
  TERRAIN_ELEV: [600, 1000, 1600],
  TERRAIN_ELEV_DEF: [1.1, 1.2, 1.35],
  /** 湿地、雨林守方的倍数;荒漠守方的倍数(攻方粮道难继);游牧国的山林 = 海拔 ≥ TERRAIN_ELEV[1]、雨林、湿地、针叶林,开阔地 = 草原、稀树草原、荒漠 */
  TERRAIN_WET_DEF: 1.15,
  TERRAIN_DRY_DEF: 1.1,
  NOMAD_ROUGH: 0.85,
  NOMAD_OPEN: 1.1,
});
