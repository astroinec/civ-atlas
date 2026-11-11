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
});
