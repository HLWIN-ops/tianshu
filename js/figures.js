/**
 * 天枢 · 古今人物相似度
 * 趣味模块：以日主 / 日柱 / 格局 / 喜用 / 十神 / 神煞 / 五行 等维度
 * 将用户命盘与历史人物库比对，输出 Top 匹配与相似理由。
 *
 * 依赖：Bazi（engine.js）、Bazi.plus（engine-plus.js）
 * 挂载：Bazi.figures
 *
 * 说明：人物生辰多为史料考证或通行说法，古人生辰尤难确证；
 * 本功能纯属趣味对照，非史实鉴定。
 */
(function () {
  'use strict';

  let BaziRef;
  if (typeof module !== 'undefined' && module.exports) {
    BaziRef = require('./engine.js');
    BaziRef.plus = require('./engine-plus.js');
  } else {
    BaziRef = Bazi;
  }

  /* ========== 人物库 ==========
   * birth: 公历近似生辰（时辰未知者取午时 12:00）
   * 仅作趣味对照，不作历史考据结论
   */
  const FIGURES = [
    // —— 古代中国 ——
    { id: 'sushi', name: '苏轼', alias: '东坡', era: '北宋', category: '文人', tags: ['文豪', '豪放', '通达'], note: '唐宋八大家，豪放词宗', gender: 'male', birth: { year: 1037, month: 1, day: 8, hour: 12 } },
    { id: 'libai', name: '李白', alias: '诗仙', era: '唐', category: '文人', tags: ['诗仙', '浪漫', '豪迈'], note: '盛唐浪漫主义诗人', gender: 'male', birth: { year: 701, month: 2, day: 28, hour: 12 } },
    { id: 'dufu', name: '杜甫', alias: '诗圣', era: '唐', category: '文人', tags: ['诗圣', '忧国', '沉郁'], note: '现实主义诗人之宗', gender: 'male', birth: { year: 712, month: 2, day: 12, hour: 12 } },
    { id: 'baijuyi', name: '白居易', alias: '乐天', era: '唐', category: '文人', tags: ['通俗', '民生', '诗酒'], note: '中唐大诗人', gender: 'male', birth: { year: 772, month: 2, day: 28, hour: 12 } },
    { id: 'simaqian', name: '司马迁', alias: '子长', era: '西汉', category: '文人', tags: ['史笔', '坚忍', '实录'], note: '史家之绝唱', gender: 'male', birth: { year: -145, month: 1, day: 1, hour: 12 } },
    { id: 'zhugeliang', name: '诸葛亮', alias: '孔明', era: '三国', category: '谋略', tags: ['智谋', '忠义', '军政'], note: '蜀汉丞相，鞠躬尽瘁', gender: 'male', birth: { year: 181, month: 7, day: 23, hour: 12 } },
    { id: 'caocao', name: '曹操', alias: '孟德', era: '三国', category: '帝王', tags: ['枭雄', '诗才', '权谋'], note: '魏武帝，治世之能臣', gender: 'male', birth: { year: 155, month: 7, day: 18, hour: 12 } },
    { id: 'guanyu', name: '关羽', alias: '云长', era: '三国', category: '武将', tags: ['忠义', '武勇', '神威'], note: '武圣，义薄云天', gender: 'male', birth: { year: 160, month: 6, day: 24, hour: 12 } },
    { id: 'wuzetian', name: '武则天', alias: '武曌', era: '唐', category: '帝王', tags: ['女帝', '铁腕', '改革'], note: '中国唯一正统女皇帝', gender: 'female', birth: { year: 624, month: 2, day: 17, hour: 12 } },
    { id: 'yuefei', name: '岳飞', alias: '鹏举', era: '南宋', category: '武将', tags: ['忠勇', '精忠', '将帅'], note: '抗金名将，精忠报国', gender: 'male', birth: { year: 1103, month: 3, day: 24, hour: 12 } },
    { id: 'zengguofan', name: '曾国藩', alias: '涤生', era: '清', category: '政商', tags: ['中兴', '治军', '修身'], note: '晚清中兴名臣', gender: 'male', birth: { year: 1811, month: 11, day: 26, hour: 12 } },
    { id: 'linzexu', name: '林则徐', alias: '少穆', era: '清', category: '政商', tags: ['禁烟', '忠直', '开眼'], note: '虎门销烟，民族英雄', gender: 'male', birth: { year: 1785, month: 8, day: 30, hour: 12 } },
    { id: 'wangyangming', name: '王阳明', alias: '守仁', era: '明', category: '哲人', tags: ['心学', '知行合一', '儒将'], note: '心学集大成者', gender: 'male', birth: { year: 1472, month: 10, day: 31, hour: 12 } },
    { id: 'liuche', name: '汉武帝', alias: '刘彻', era: '西汉', category: '帝王', tags: ['开疆', '雄才', '文治'], note: '汉武盛世缔造者', gender: 'male', birth: { year: -156, month: 7, day: 14, hour: 12 } },
    { id: 'lizhi', name: '李世民', alias: '唐太宗', era: '唐', category: '帝王', tags: ['贞观', '纳谏', '武功'], note: '贞观之治', gender: 'male', birth: { year: 598, month: 1, day: 28, hour: 12 } },
    { id: 'kangxi', name: '康熙', alias: '玄烨', era: '清', category: '帝王', tags: ['勤政', '武功', '盛世'], note: '清圣祖，康乾盛世', gender: 'male', birth: { year: 1654, month: 5, day: 4, hour: 12 } },

    // —— 近现代 / 当代中国 ——
    { id: 'luxun', name: '鲁迅', alias: '周树人', era: '近现代', category: '文人', tags: ['批判', '文豪', '启蒙'], note: '中国现代文学奠基人', gender: 'male', birth: { year: 1881, month: 9, day: 25, hour: 8 } },
    { id: 'jinyong', name: '金庸', alias: '查良镛', era: '当代', category: '文人', tags: ['武侠', '叙事', '家国'], note: '新派武侠小说泰斗', gender: 'male', birth: { year: 1924, month: 3, day: 10, hour: 12 } },
    { id: 'mo_yan', name: '莫言', alias: '', era: '当代', category: '文人', tags: ['乡土', '魔幻', '诺奖'], note: '诺贝尔文学奖得主', gender: 'male', birth: { year: 1955, month: 2, day: 17, hour: 12 } },
    { id: 'hu_shi', name: '胡适', alias: '适之', era: '近现代', category: '哲人', tags: ['白话', '自由', '实验'], note: '新文化运动领袖', gender: 'male', birth: { year: 1891, month: 12, day: 17, hour: 12 } },
    { id: 'qianxuesen', name: '钱学森', alias: '', era: '当代', category: '科学', tags: ['航天', '报国', '严谨'], note: '中国航天之父', gender: 'male', birth: { year: 1911, month: 12, day: 11, hour: 12 } },
    { id: 'tu_youyou', name: '屠呦呦', alias: '', era: '当代', category: '科学', tags: ['医药', '坚持', '诺奖'], note: '青蒿素发现者', gender: 'female', birth: { year: 1930, month: 12, day: 30, hour: 12 } },
    { id: 'yangliwei', name: '杨利伟', alias: '', era: '当代', category: '科学', tags: ['航天', '勇气', '开拓'], note: '中国首位航天员', gender: 'male', birth: { year: 1965, month: 6, day: 21, hour: 12 } },
    { id: 'dengxiaoping', name: '邓小平', alias: '', era: '当代', category: '帝王', tags: ['改革', '务实', '战略'], note: '改革开放总设计师', gender: 'male', birth: { year: 1904, month: 8, day: 22, hour: 12 } },
    { id: 'zhouenlai', name: '周恩来', alias: '', era: '当代', category: '政商', tags: ['外交', '周全', '奉献'], note: '共和国总理', gender: 'male', birth: { year: 1898, month: 3, day: 5, hour: 12 } },
    { id: 'sunzhongshan', name: '孙中山', alias: '逸仙', era: '近现代', category: '帝王', tags: ['革命', '民主', '共和'], note: '国父', gender: 'male', birth: { year: 1866, month: 11, day: 12, hour: 12 } },
    { id: 'mayun', name: '马云', alias: '', era: '当代', category: '政商', tags: ['电商', '演讲', '创业'], note: '阿里巴巴创始人', gender: 'male', birth: { year: 1964, month: 9, day: 10, hour: 12 } },
    { id: 'mahuateng', name: '马化腾', alias: 'Pony', era: '当代', category: '政商', tags: ['互联网', '产品', '稳健'], note: '腾讯创始人', gender: 'male', birth: { year: 1971, month: 10, day: 29, hour: 12 } },
    { id: 'lei_jun', name: '雷军', alias: '', era: '当代', category: '政商', tags: ['互联网', '性价比', '演讲'], note: '小米创始人', gender: 'male', birth: { year: 1969, month: 12, day: 16, hour: 12 } },
    { id: 'lee_ka_shing', name: '李嘉诚', alias: '', era: '当代', category: '政商', tags: ['商业', '稳健', '慈善'], note: '华人商界传奇', gender: 'male', birth: { year: 1928, month: 7, day: 29, hour: 12 } },
    { id: 'brucelee', name: '李小龙', alias: 'Bruce Lee', era: '当代', category: '武将', tags: ['武术', '哲思', '突破'], note: '功夫巨星，截拳道创始人', gender: 'male', birth: { year: 1940, month: 11, day: 27, hour: 7 } },
    { id: 'yaoming', name: '姚明', alias: '', era: '当代', category: '武将', tags: ['篮球', '国际化', '领导'], note: '中国篮球巨星', gender: 'male', birth: { year: 1980, month: 9, day: 12, hour: 12 } },
    { id: 'liuxiang', name: '刘翔', alias: '', era: '当代', category: '武将', tags: ['短跨', '突破', '速度'], note: '中国田径奥运冠军', gender: 'male', birth: { year: 1983, month: 7, day: 13, hour: 12 } },
    { id: 'li_na', name: '李娜', alias: '', era: '当代', category: '武将', tags: ['网球', '突破', '直率'], note: '亚洲首位大满贯单打冠军', gender: 'female', birth: { year: 1982, month: 2, day: 26, hour: 12 } },
    { id: 'lang_ping', name: '郎平', alias: '', era: '当代', category: '武将', tags: ['排球', '铁榔头', '教练'], note: '中国女排传奇', gender: 'female', birth: { year: 1960, month: 12, day: 10, hour: 12 } },
    { id: 'gu_ailling', name: '谷爱凌', alias: 'Eileen', era: '当代', category: '武将', tags: ['滑雪', '自信', '双语'], note: '冬奥冠军', gender: 'female', birth: { year: 2003, month: 9, day: 3, hour: 12 } },
    { id: 'meilanfang', name: '梅兰芳', alias: '', era: '近现代', category: '艺人', tags: ['京剧', '艺术', '优雅'], note: '京剧大师', gender: 'male', birth: { year: 1894, month: 10, day: 22, hour: 12 } },
    { id: 'zhangyimou', name: '张艺谋', alias: '', era: '当代', category: '艺人', tags: ['导演', '视觉', '史诗'], note: '第五代导演代表', gender: 'male', birth: { year: 1951, month: 11, day: 14, hour: 12 } },
    { id: 'jaychou', name: '周杰伦', alias: 'Jay', era: '当代', category: '艺人', tags: ['音乐', '创意', '流行'], note: '华语流行天王', gender: 'male', birth: { year: 1979, month: 1, day: 18, hour: 12 } },
    { id: 'andy_lau', name: '刘德华', alias: 'Andy', era: '当代', category: '艺人', tags: ['全能', '勤奋', '国民'], note: '香港四大天王', gender: 'male', birth: { year: 1961, month: 9, day: 27, hour: 12 } },
    { id: 'jackie_chan', name: '成龙', alias: 'Jackie', era: '当代', category: '艺人', tags: ['功夫', '喜剧', '国际'], note: '功夫喜剧巨星', gender: 'male', birth: { year: 1954, month: 4, day: 7, hour: 12 } },
    { id: 'gong_li', name: '巩俐', alias: '', era: '当代', category: '艺人', tags: ['演技', '气场', '国际'], note: '国际影后', gender: 'female', birth: { year: 1965, month: 12, day: 31, hour: 12 } },
    { id: 'zhang_ziyi', name: '章子怡', alias: '', era: '当代', category: '艺人', tags: ['国际', '演技', '坚韧'], note: '国际影星', gender: 'female', birth: { year: 1979, month: 2, day: 9, hour: 12 } },
    { id: 'fan_bingbing', name: '范冰冰', alias: '', era: '当代', category: '艺人', tags: ['明星', '气场', '造型'], note: '知名演员', gender: 'female', birth: { year: 1981, month: 9, day: 16, hour: 12 } },
    { id: 'linzhiling', name: '林志玲', alias: '', era: '当代', category: '艺人', tags: ['亲和', '美丽', '主持'], note: '知名模特、主持人', gender: 'female', birth: { year: 1974, month: 11, day: 29, hour: 12 } },

    // —— 世界 ——
    { id: 'einstein', name: '爱因斯坦', alias: 'Einstein', era: '近现代', category: '科学', tags: ['相对论', '天才', '好奇'], note: '现代物理学巨擘', gender: 'male', birth: { year: 1879, month: 3, day: 14, hour: 11 } },
    { id: 'newton', name: '牛顿', alias: 'Newton', era: '近代', category: '科学', tags: ['力学', '数学', '孤高'], note: '经典物理学奠基人', gender: 'male', birth: { year: 1643, month: 1, day: 4, hour: 12 } },
    { id: 'curie', name: '居里夫人', alias: 'Marie Curie', era: '近现代', category: '科学', tags: ['科研', '坚韧', '两诺奖'], note: '两获诺贝尔奖的女科学家', gender: 'female', birth: { year: 1867, month: 11, day: 7, hour: 12 } },
    { id: 'tesla', name: '特斯拉', alias: 'Nikola Tesla', era: '近现代', category: '科学', tags: ['电力', '奇想', '发明'], note: '交流电先驱', gender: 'male', birth: { year: 1856, month: 7, day: 10, hour: 0 } },
    { id: 'da_vinci', name: '达·芬奇', alias: 'Leonardo', era: '文艺复兴', category: '科学', tags: ['全能', '艺术', '发明'], note: '文艺复兴全能天才', gender: 'male', birth: { year: 1452, month: 4, day: 15, hour: 12 } },
    { id: 'napoleon', name: '拿破仑', alias: 'Napoleon', era: '近代', category: '帝王', tags: ['军事', '野心', '改革'], note: '法兰西皇帝', gender: 'male', birth: { year: 1769, month: 8, day: 15, hour: 11 } },
    { id: 'churchill', name: '丘吉尔', alias: 'Churchill', era: '近现代', category: '帝王', tags: ['演讲', '坚毅', '战时'], note: '二战英国首相', gender: 'male', birth: { year: 1874, month: 11, day: 30, hour: 1 } },
    { id: 'mandela', name: '曼德拉', alias: 'Mandela', era: '当代', category: '帝王', tags: ['和解', '坚韧', '自由'], note: '南非反种族隔离领袖', gender: 'male', birth: { year: 1918, month: 7, day: 18, hour: 12 } },
    { id: 'beethoven', name: '贝多芬', alias: 'Beethoven', era: '近代', category: '艺人', tags: ['音乐', '抗争', '激情'], note: '乐圣，命运交响曲', gender: 'male', birth: { year: 1770, month: 12, day: 16, hour: 12 } },
    { id: 'mozart', name: '莫扎特', alias: 'Mozart', era: '近代', category: '艺人', tags: ['音乐', '天才', '灵动'], note: '古典音乐神童', gender: 'male', birth: { year: 1756, month: 1, day: 27, hour: 20 } },
    { id: 'shakespeare', name: '莎士比亚', alias: 'Shakespeare', era: '文艺复兴', category: '文人', tags: ['戏剧', '人性', '语言'], note: '英国戏剧之父', gender: 'male', birth: { year: 1564, month: 4, day: 23, hour: 12 } },
    { id: 'jobs', name: '乔布斯', alias: 'Steve Jobs', era: '当代', category: '政商', tags: ['创新', '审美', '偏执'], note: '苹果联合创始人', gender: 'male', birth: { year: 1955, month: 2, day: 24, hour: 19 } },
    { id: 'musk', name: '马斯克', alias: 'Elon Musk', era: '当代', category: '政商', tags: ['创业', '航天', '颠覆'], note: '特斯拉与 SpaceX', gender: 'male', birth: { year: 1971, month: 6, day: 28, hour: 7 } },
    { id: 'oprah', name: '奥普拉', alias: 'Oprah', era: '当代', category: '艺人', tags: ['传媒', '励志', '影响力'], note: '美国传媒女王', gender: 'female', birth: { year: 1954, month: 1, day: 29, hour: 4 } },
    { id: 'taylor', name: '泰勒·斯威夫特', alias: 'Taylor Swift', era: '当代', category: '艺人', tags: ['音乐', '叙事', '商业'], note: '流行音乐巨星', gender: 'female', birth: { year: 1989, month: 12, day: 13, hour: 8 } },
  ];

  const CAT_LABEL = {
    '文人': '文采风骨',
    '帝王': '权略领袖',
    '武将': '勇毅行动',
    '谋略': '运筹帷幄',
    '哲人': '思想洞察',
    '科学': '求知创造',
    '政商': '经营布局',
    '艺人': '艺术表达',
  };

  const STRENGTH_RANK = { '身强': 2, '中和': 1, '身弱': 0 };

  /* ========== 特征提取 ========== */
  function extractFeatures(r) {
    const pillars = {
      year: r.pillars.year.name,
      month: r.pillars.month.name,
      day: r.pillars.day.name,
      hour: r.pillars.hour.name,
    };
    const ganTen = {
      year: r.pillars.year.ganTenGod,
      month: r.pillars.month.ganTenGod,
      hour: r.pillars.hour.ganTenGod,
    };
    const tenSet = new Set(
      [ganTen.year, ganTen.month, ganTen.hour].filter(s => s && s !== '日主')
    );
    // 藏干十神也纳入
    ['year', 'month', 'day', 'hour'].forEach(k => {
      (r.pillars[k].canggan || []).forEach(g => {
        if (g.tenGod && g.tenGod !== '日主') tenSet.add(g.tenGod);
      });
    });
    const shensha = [...new Set((r.shensha || []).map(s => s.name))];
    return {
      pillars,
      dayMaster: r.dayMaster.gan,
      dayWx: r.dayMaster.wuxing,
      dayYinyang: r.dayMaster.yinyang,
      dayZhi: r.pillars.day.zhiName,
      yearZhi: r.pillars.year.zhiName,
      monthZhi: r.pillars.month.zhiName,
      hourZhi: r.pillars.hour.zhiName,
      pattern: (r.pattern && r.pattern.gridName) || '',
      combos: (r.pattern && r.pattern.combos) || [],
      strength: (r.strength && r.strength.level) || '中和',
      xi: (r.useGod && r.useGod.xi) || [],
      ji: (r.useGod && r.useGod.ji) || [],
      ganTen,
      tenSet,
      shensha,
      wuxing: r.wuxingWeighted || r.wuxingCount || {},
    };
  }

  /* ========== 懒加载人物特征 ========== */
  let cache = null; // [{meta, features}]
  let cacheError = null;

  function buildCache() {
    if (cache) return cache;
    const plus = BaziRef.plus;
    if (!plus || !plus.fullChart) {
      cacheError = '排盘引擎未就绪';
      cache = [];
      return cache;
    }
    const list = [];
    FIGURES.forEach(f => {
      try {
        const r = plus.fullChart({
          year: f.birth.year,
          month: f.birth.month,
          day: f.birth.day,
          hour: f.birth.hour == null ? 12 : f.birth.hour,
          minute: 30,
          gender: f.gender || 'male',
          longitude: 120,
          tz: 8,
          useTrueSolar: false,
          ziDayRule: 'next',
        });
        list.push({ meta: f, features: extractFeatures(r) });
      } catch (e) {
        // 个别古人生辰算法失败则跳过
        console.warn('[figures] skip', f.name, e.message);
      }
    });
    cache = list;
    return cache;
  }

  /* ========== 相似度打分 ========== */
  function jaccard(a, b) {
    const A = a instanceof Set ? a : new Set(a || []);
    const B = b instanceof Set ? b : new Set(b || []);
    if (!A.size && !B.size) return 0;
    let inter = 0;
    A.forEach(x => { if (B.has(x)) inter++; });
    const uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
  }

  function wxCosine(a, b) {
    const keys = ['木', '火', '土', '金', '水'];
    let dot = 0, na = 0, nb = 0;
    keys.forEach(k => {
      const va = +(a[k] || 0);
      const vb = +(b[k] || 0);
      dot += va * vb;
      na += va * va;
      nb += vb * vb;
    });
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function scoreOne(u, f) {
    const reasons = [];
    let score = 0;
    const max = 100;

    // 1. 日主天干（权重最高）
    if (u.dayMaster === f.dayMaster) {
      score += 28;
      reasons.push({ key: 'dayMaster', text: `同为日主「${u.dayMaster}」${u.dayWx}`, weight: 28 });
    } else if (u.dayWx === f.dayWx) {
      score += 14;
      reasons.push({ key: 'dayWx', text: `日主同属「${u.dayWx}」行`, weight: 14 });
    } else if (u.dayYinyang === f.dayYinyang) {
      score += 4;
    }

    // 2. 日柱完全相同 / 同日支
    if (u.pillars.day === f.pillars.day) {
      score += 18;
      reasons.push({ key: 'dayPillar', text: `日柱同为「${u.pillars.day}」——性情核心极近`, weight: 18 });
    } else if (u.dayZhi === f.dayZhi) {
      score += 8;
      reasons.push({ key: 'dayZhi', text: `同坐「${u.dayZhi}」支`, weight: 8 });
    }

    // 3. 年/月/时柱
    let pillarHits = 0;
    ['year', 'month', 'hour'].forEach(k => {
      if (u.pillars[k] === f.pillars[k]) {
        pillarHits++;
        score += 6;
        const label = { year: '年柱', month: '月柱', hour: '时柱' }[k];
        reasons.push({ key: 'pillar:' + k, text: `${label}同为「${u.pillars[k]}」`, weight: 6 });
      }
    });
    // 地支部分重合（整柱不同时才额外加分，避免重复）
    if (u.yearZhi === f.yearZhi && u.pillars.year !== f.pillars.year) score += 2;
    if (u.monthZhi === f.monthZhi && u.pillars.month !== f.pillars.month) score += 3;
    if (u.hourZhi === f.hourZhi && u.pillars.hour !== f.pillars.hour) score += 2;

    // 4. 格局
    if (u.pattern && u.pattern === f.pattern) {
      score += 12;
      reasons.push({ key: 'pattern', text: `同入「${u.pattern}」`, weight: 12 });
    }
    // 组合格局
    const comboJ = jaccard(u.combos, f.combos);
    if (comboJ > 0) {
      const pts = Math.round(comboJ * 6);
      score += pts;
      const shared = (u.combos || []).filter(c => (f.combos || []).includes(c));
      if (shared.length) {
        reasons.push({ key: 'combo', text: `同带「${shared.join('、')}」`, weight: pts });
      }
    }

    // 5. 身强弱
    const su = STRENGTH_RANK[u.strength] != null ? STRENGTH_RANK[u.strength] : 1;
    const sf = STRENGTH_RANK[f.strength] != null ? STRENGTH_RANK[f.strength] : 1;
    if (su === sf) {
      score += 6;
      reasons.push({ key: 'strength', text: `日主同为「${u.strength}」`, weight: 6 });
    } else if (Math.abs(su - sf) === 1) {
      score += 2;
    }

    // 6. 喜用神
    const xiJ = jaccard(u.xi, f.xi);
    if (xiJ > 0) {
      const pts = Math.round(xiJ * 10);
      score += pts;
      const shared = (u.xi || []).filter(x => (f.xi || []).includes(x));
      if (shared.length) {
        reasons.push({ key: 'xi', text: `喜用同向「${shared.join('、')}」`, weight: pts });
      }
    }

    // 7. 十神结构
    const tenJ = jaccard(u.tenSet, f.tenSet);
    if (tenJ >= 0.4) {
      const pts = Math.round(tenJ * 10);
      score += pts;
      reasons.push({ key: 'tengod', text: `十神结构相近（重合度 ${(tenJ * 100).toFixed(0)}%）`, weight: pts });
    } else if (tenJ > 0) {
      score += Math.round(tenJ * 6);
    }

    // 8. 神煞
    const shaJ = jaccard(u.shensha, f.shensha);
    if (shaJ > 0) {
      const pts = Math.round(shaJ * 6);
      score += pts;
      const shared = (u.shensha || []).filter(s => (f.shensha || []).includes(s));
      if (shared.length && pts >= 2) {
        reasons.push({ key: 'shensha', text: `同见神煞「${shared.slice(0, 3).join('、')}」`, weight: pts });
      }
    }

    // 9. 五行分布余弦
    const cos = wxCosine(u.wuxing, f.wuxing);
    if (cos >= 0.85) {
      const pts = Math.round((cos - 0.5) * 12);
      score += Math.max(2, pts);
      reasons.push({ key: 'wuxing', text: `五行力量分布高度相似`, weight: pts });
    } else if (cos >= 0.7) {
      score += 3;
    }

    // 裁剪到 0–99，保留趣味感（极少打满分）
    score = Math.max(0, Math.min(99, Math.round(score)));

    // 理由按权重排序，最多 4 条
    reasons.sort((a, b) => b.weight - a.weight);
    const topReasons = reasons.slice(0, 4).map(r => r.text);

    // 若几乎没理由但分数尚可，补一句
    if (!topReasons.length && score >= 20) {
      topReasons.push('命盘气场有几分相近');
    }

    return { score, reasons: topReasons, pillarHits };
  }

  function vibeLine(meta, score) {
    const cat = CAT_LABEL[meta.category] || meta.category;
    if (score >= 75) return `命盘气场高度共鸣，${cat}气质与${meta.name}颇有几分神似。`;
    if (score >= 60) return `在${cat}一路上，与${meta.name}有明显同频之处。`;
    if (score >= 45) return `命理轮廓与${meta.name}有所交叠，可作趣味对照。`;
    return `略有相似痕迹，更多是气质上的遥相呼应。`;
  }

  /**
   * 主入口：对 fullChart 结果做古今人物匹配
   * @param {object} chartResult fullChart 返回值
   * @param {object} [opts]
   * @param {number} [opts.top=6]
   * @param {string} [opts.category] 过滤分类
   * @param {string} [opts.era] 过滤时代（子串匹配）
   * @returns {{ matches: Array, userSummary: object, total: number, disclaimer: string }}
   */
  function match(chartResult, opts) {
    opts = opts || {};
    const topN = opts.top || 6;
    const list = buildCache();
    if (!list.length) {
      return {
        matches: [],
        userSummary: null,
        total: 0,
        error: cacheError || '人物库未能生成',
        disclaimer: DISCLAIMER,
      };
    }

    const u = extractFeatures(chartResult);
    let candidates = list;
    if (opts.category) {
      candidates = candidates.filter(x => x.meta.category === opts.category);
    }
    if (opts.era) {
      candidates = candidates.filter(x => (x.meta.era || '').includes(opts.era));
    }

    const scored = candidates.map(({ meta, features }) => {
      const { score, reasons } = scoreOne(u, features);
      return {
        id: meta.id,
        name: meta.name,
        alias: meta.alias || '',
        era: meta.era,
        category: meta.category,
        categoryLabel: CAT_LABEL[meta.category] || meta.category,
        tags: meta.tags || [],
        note: meta.note || '',
        gender: meta.gender,
        pillars: features.pillars,
        dayMaster: features.dayMaster,
        dayWx: features.dayWx,
        pattern: features.pattern,
        strength: features.strength,
        score,
        reasons,
        vibe: vibeLine(meta, score),
      };
    });

    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh'));

    // 轻微拉开并列：同分时优先日主相同者已在 score 内体现
    const matches = scored.slice(0, topN);

    return {
      matches,
      userSummary: {
        dayMaster: u.dayMaster,
        dayWx: u.dayWx,
        dayPillar: u.pillars.day,
        pattern: u.pattern,
        strength: u.strength,
        pillars: u.pillars,
        xi: u.xi,
      },
      total: list.length,
      categories: CATEGORIES,
      disclaimer: DISCLAIMER,
    };
  }

  const CATEGORIES = [
    { key: '', label: '全部' },
    { key: '文人', label: '文人' },
    { key: '帝王', label: '领袖' },
    { key: '武将', label: '将帅' },
    { key: '谋略', label: '谋略' },
    { key: '哲人', label: '哲人' },
    { key: '科学', label: '科学' },
    { key: '政商', label: '政商' },
    { key: '艺人', label: '艺人' },
  ];

  const DISCLAIMER =
    '趣味对照而已：人物生辰多为通行说法或史料推估，古人生辰尤难确证；相似度按命盘结构启发式打分，非科学鉴定，更非命运断言。';

  function getFigures() {
    return FIGURES.map(f => ({
      id: f.id, name: f.name, alias: f.alias, era: f.era,
      category: f.category, tags: f.tags, note: f.note, gender: f.gender,
    }));
  }

  function warmup() {
    buildCache();
    return cache ? cache.length : 0;
  }

  const API = {
    match,
    extractFeatures,
    getFigures,
    warmup,
    CATEGORIES,
    DISCLAIMER,
    FIGURES_COUNT: FIGURES.length,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    Bazi.figures = API;
  }
})();
