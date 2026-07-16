/* ============================================================
 * 八字排盘 解读文案层  interpret.js
 * 信息分层：
 *   命盘 = 事实数据
 *   大运 = 时间轴 + 运势要点
 *   解读 = 总览 → 四柱 → 阶段 → 领域 → 流年 → 生活实践 → 折叠词典
 * ============================================================ */
(function () {
  'use strict';

  const WX_COLOR = { '木': '#3a7d3a', '火': '#c0392b', '土': '#8b6f3a', '金': '#8a8a3a', '水': '#2c5f7a' };

  const TEN_GOD_MEANING = {
    '比肩': '同我之比肩，主刚健自立、自信果决，朋辈助力，亦主竞争。',
    '劫财': '异我之劫财，主热情仗义、行动力强，慷慨好胜，亦防破耗。',
    '食神': '我生之食神，主温和聪慧、才艺口福，性情宽和，利于表达创造。',
    '伤官': '我生之伤官，主聪慧外露、才华横溢，叛逆不羁，利于专精技艺。',
    '正财': '我克之正财，主勤俭务实、踏实聚财，稳定收入，重信誉。',
    '偏财': '我克之偏财，传统上关联机会型资源与社交；现实中仍需预算、合同与风险评估。',
    '正官': '克我之正官，主端正守纪、责任荣誉，宜公职规束，贵气内敛。',
    '七杀': '克我之七杀，主威严果断、魄力挑战，压力亦机遇，宜制化方吉。',
    '正印': '生我之正印，主仁慈聪慧、学识荫护，长辈贵人，沉静包容。',
    '偏印': '生我之偏印，主孤僻多思、专长钻研，悟性高，亦主偏门技艺。',
  };

  const SHENSHA_MEANING = {
    '天乙贵人': '传统上关联支持与协助，可观察自己在困难中如何求助、协作与回馈。',
    '文昌': '传统上关联学习与表达，可作为复盘阅读、写作和知识输出习惯的提示。',
    '太极贵人': '传统上关联思辨与钻研，可观察自己是否适合留出独立研究时间。',
    '桃花': '传统上关联社交关注度；关系质量仍取决于沟通、选择与清晰边界。',
    '驿马': '传统上关联走动与变化，可观察出差、迁移或环境切换对状态的真实影响。',
    '华盖': '传统上关联独处与专注，可观察独立创作和团队协作之间的平衡。',
    '天医': '传统文化中的医药符号，不对应疾病、体质或诊断；只作术语了解。',
    '禄神': '传统上关联资源与稳定感，可观察自己的收入结构和支持系统。',
    '羊刃': '传统上关联行动强度，可提醒在高压和运动中放慢节奏、遵守安全规范。',
  };

  const USE_GOD_ADVICE = {
    '木': { 方位: '东方', 颜色: '青绿', 行业: '文化教育、农林、设计创意、出版', 数字: '3、8', 配饰: '绿植、木质、翡翠', 饮食: '增加多样蔬果、规律伸展' },
    '火': { 方位: '南方', 颜色: '红紫', 行业: '传媒、餐饮、能源、演艺、光电', 数字: '2、7', 配饰: '红绳、朱砂、暖光', 饮食: '苦味清心、少燥辣' },
    '土': { 方位: '中央/本地', 颜色: '黄棕', 行业: '地产、金融、咨询、农业服务', 数字: '5、0', 配饰: '陶瓷、黄玉、稳坐', 饮食: '甘味健脾、规律餐' },
    '金': { 方位: '西方', 颜色: '白银', 行业: '机械、金融、法律、精密技术', 数字: '4、9', 配饰: '金属、白玉、银饰', 饮食: '辛润、少寒凉' },
    '水': { 方位: '北方', 颜色: '黑蓝', 行业: '贸易、物流、信息、旅游、航运', 数字: '1、6', 配饰: '流水意象、黑曜、玻璃', 饮食: '咸淡适中、规律补水' },
  };

  const TEN_GOD_FOCUS = {
    '比肩': '自立合作', '劫财': '进取破耗', '食神': '才艺福气', '伤官': '技艺锋芒',
    '正财': '务实积财', '偏财': '机遇社交', '正官': '名位责任', '七杀': '突破挑战',
    '正印': '学业荫护', '偏印': '专长思辨',
  };

  const TEN_GOD_ACTION = {
    '比肩': '宜联合同道、分担项目',
    '劫财': '宜主动出击，财务记账防破',
    '食神': '宜出作品、养身体、轻理财',
    '伤官': '宜深耕一技，少口舌争执',
    '正财': '宜稳健理财、合同落纸',
    '偏财': '宜拓展人脉，不贪快钱',
    '正官': '宜考级升职、合规经营',
    '七杀': '宜迎难上，找贵人制杀',
    '正印': '宜进修考证、敬重长辈',
    '偏印': '宜钻研冷门专长或副业',
  };

  /* 格局专论（比一句名字更有用） */
  const PATTERN_NOTE = {
    '正官格': '官星当令，宜守规矩、担责任，求名求职循序渐进；忌伤官见官、刑冲官星。',
    '七杀格': '杀星主威，魄力与压力并存；有食伤制、印化则成大器，无制则躁进。',
    '正财格': '财来有道，宜稳职稳产、契约理财；忌比劫争财、冲动投机。',
    '偏财格': '偏财主机缘，宜人脉项目、多元收入；设止损，忌贪多。',
    '食神格': '泄秀有情，宜创作、技艺、口福养生；忌枭印夺食。',
    '伤官格': '锋芒外露，宜专业技艺、改革创新；身弱慎伤官见官。',
    '正印格': '印绶生身，宜学业文书、师长提携；忌财破印过重。',
    '偏印格': '偏印主奇，宜专研偏门、技术玄学；忌枭神夺食。',
    '建禄格': '月令临官，自立性强，宜靠己力；身旺喜财官食伤，忌再叠比劫。',
    '羊刃格': '刃主刚烈，进取果敢；有官杀制刃或印化则吉，无制防冲动。',
    '比肩格': '比肩当令，合群亦竞争，宜合伙分工清晰。',
    '劫财格': '劫财当令，行动力强，防破耗口舌，理财宜分账。',
  };

  const COMBO_NOTE = {
    '食神制杀': '食神制杀：才华收服压力，宜以专业化解挑战，可担重任。',
    '伤官制杀': '伤官制杀：锋芒对冲杀气，宜技术立威，忌口舌惹非。',
    '杀印相生': '杀印相生：压力化贵，利于武职、管理、逆境翻盘。',
    '伤官生财': '伤官生财：才智变现，宜作品、技能、创意变现。',
    '食神生财': '食神生财：温和生财，宜持续产出与口碑经营。',
    '财官相生': '财官相生：名利互促，宜职场晋升与稳健经营并进。',
    '官印相生': '官印相生：贵气内藏，宜公职、学术、体制内路线。',
    '印比护身': '印比护身：生扶有力，身弱得助，宜借贵人与同道。',
  };

  const PILLAR_ROLE = {
    year: { title: '年柱', life: '祖上根基 · 1–16 岁少年', focus: '家世背景、早年环境、社会归属' },
    month: { title: '月柱', life: '父母兄弟 · 17–32 岁青年', focus: '事业起步、社会角色、月令气场' },
    day: { title: '日柱', life: '自身配偶 · 33–48 岁中年', focus: '性情核心、婚姻宫、日主本气' },
    hour: { title: '时柱', life: '子女晚景 · 49 岁后', focus: '子女缘、事业收成、晚年心境' },
  };

  const DAY_MASTER_TRAIT = {
    '甲': '甲木如参天大树，主正直上进、有担当，宜领导规划，忌刚愎。',
    '乙': '乙木如花草藤萝，主柔韧细腻、善迂回，宜设计协调，忌优柔。',
    '丙': '丙火如太阳，主热情光明、感染力强，宜表达舞台，忌急躁。',
    '丁': '丁火如灯烛，主内敛专注、细火长明，宜研究精工，忌多疑。',
    '戊': '戊土如山岳，主厚重守信、承载包容，宜实业管理，忌固执。',
    '己': '己土如田园，主滋养变通、细心服务，宜运营后勤，忌多虑。',
    '庚': '庚金如刀剑，主果断义气、锋芒锐利，宜决断执行，忌刚烈。',
    '辛': '辛金如珠玉，主精致敏锐、审美高，宜技艺精品，忌敏感。',
    '壬': '壬水如江河，主智慧流动、胸怀开阔，宜统筹资源，忌散漫。',
    '癸': '癸水如雨露，主细腻直觉、润物无声，宜策划洞察，忌多愁。',
  };

  function wxColor(wx) { return WX_COLOR[wx] || '#333'; }
  function wxTag(wx) { return `<span class="wx-inline wx-${wx}">${wx}</span>`; }
  function primaryXi(ug) { return (ug.xi && ug.xi[0]) || '土'; }

  function collectShen(r) {
    const list = [];
    ['year', 'month', 'day', 'hour'].forEach(k => {
      const p = r.pillars[k];
      if (p.ganTenGod && p.ganTenGod !== '日主') list.push(p.ganTenGod);
      if (p.zhiTenGod) list.push(p.zhiTenGod);
      (p.canggan || []).forEach(g => { if (g.tenGod) list.push(g.tenGod); });
    });
    return list;
  }

  function countMap(arr) {
    const m = {};
    arr.forEach(x => { m[x] = (m[x] || 0) + 1; });
    return m;
  }

  /* ============== 格局与喜用 ============== */
  function genPatternText(pattern) {
    let s = `命局入 <span class="highlight">${pattern.gridName}</span>`;
    if (pattern.combos && pattern.combos.length) {
      s += '，兼带 ' + pattern.combos.map(c => `<span class="highlight">${c}</span>`).join('、');
    }
    s += '。';
    const note = PATTERN_NOTE[pattern.gridName];
    if (note) s += note;
    if (pattern.combos && pattern.combos.length) {
      s += pattern.combos.map(c => COMBO_NOTE[c] || '').filter(Boolean).join('');
    }
    return s;
  }

  function genStrengthText(strength) {
    const lvlMap = { '身强': '日主偏旺', '身弱': '日主偏弱', '中和': '日主中和' };
    let s = `月令${strength.state}（月支五行${strength.monthWx || ''}），生扶约占 <span class="highlight">${Math.round(strength.ratio * 100)}%</span>`;
    s += `（生扶 ${strength.support} / 克泄耗 ${strength.drain}），${lvlMap[strength.level] || strength.level}。`;
    s += strength.note || '';
    if (strength.level === '身弱') s += '用神重在生扶，行运用印比、喜用之地较顺。';
    else if (strength.level === '身强') s += '用神重在克泄耗，行运用财官食伤较利。';
    else s += '用神宜平衡，顺势取清，勿走极端。';
    return s;
  }

  function genUseGodText(useGod) {
    const xi = useGod.xi.map(wxTag).join('、');
    const ji = useGod.ji.map(wxTag).join('、');
    let html = `<p>喜用五行：${xi}；忌神五行：${ji}。日主本气 ${wxTag(useGod.dayWx)}。</p>`;
    html += '<ul class="use-list">';
    const seen = new Set();
    useGod.xi.forEach(wx => {
      if (seen.has(wx)) return; seen.add(wx);
      const a = USE_GOD_ADVICE[wx];
      html += `<li>${wxTag(wx)} 利 <b>${a.方位}</b> · 着 <b>${a.颜色}</b> · 业向 <b>${a.行业}</b> · 数 <b>${a.数字}</b></li>`;
    });
    html += '</ul>';
    return html;
  }

  /* ============== 命局总览（开篇一段话） ============== */
  function renderOverviewSection(r) {
    const dm = r.dayMaster;
    const trait = DAY_MASTER_TRAIT[dm.gan] || '';
    const st = r.strength;
    const pat = r.pattern;
    const ug = r.useGod;
    const shenCnt = countMap(collectShen(r));
    const topShen = Object.keys(shenCnt).sort((a, b) => shenCnt[b] - shenCnt[a]).slice(0, 3);
    const shaNames = [...new Set((r.shensha || []).map(s => s.name))];
    const gender = r.input.gender === 'male' ? '乾造' : '坤造';
    const age = (r._currentYear || new Date().getFullYear()) - r.input.year;

    let html = '<div class="read-card overview-card"><h3>命局总览</h3>';
    html += `<p class="ov-lead">${gender} · 日主 <b class="wx-${dm.wuxing}">${dm.gan}${dm.wuxing}</b>（${dm.yinyang}）· ${pat.gridName} · ${st.level}`;
    html += ` · 现约 <b>${age}</b> 岁</p>`;
    html += `<p>${trait}</p>`;
    html += `<p>四柱 <b>${r.pillars.year.name}</b> <b>${r.pillars.month.name}</b> <b>${r.pillars.day.name}</b> <b>${r.pillars.hour.name}</b>。`;
    html += `月令${st.state}，综合${st.level}，喜 ${ug.xi.map(wxTag).join('、')}，忌 ${ug.ji.map(wxTag).join('、')}。</p>`;
    if (topShen.length) {
      html += `<p>盘中十神多见 <b>${topShen.map(s => s + (shenCnt[s] > 1 ? '×' + shenCnt[s] : '')).join('、')}</b>`;
      html += `，人生课题偏重「${topShen.map(s => TEN_GOD_FOCUS[s] || s).join(' / ')}」。</p>`;
    }
    if (shaNames.length) {
      html += `<p>神煞亮点：${shaNames.map(n => `<span class="sha-item">${n}</span>`).join('')} — `;
      html += shaNames.slice(0, 3).map(n => (SHENSHA_MEANING[n] || '').replace(/。$/, '')).filter(Boolean).join('；') + '。</p>';
    }
    if (r.kongwang && r.kongwang.zhi) {
      html += `<p>日空 <b>${r.kongwang.zhi.join('')}</b>`;
      if (r.kongwang.fallen && r.kongwang.fallen.length) html += `，${r.kongwang.fallen.join('、')}`;
      else html += '，四柱地支未落空，根基尚实';
      html += '。</p>';
    }
    if (r.relations && r.relations.length) {
      const brief = r.relations.slice(0, 4).map(rr => {
        if (!rr.b) return `${rr.type.join('/')}${rr.az}`;
        return `${rr.az}${rr.type.join('/')}${rr.bz}`;
      }).join('，');
      html += `<p>地支关系：${brief}。冲合刑害影响人事起伏，宜在对应大运流年留意。</p>`;
    }

    // 当前大运 + 今年流年一句总评
    const curRun = (r.dayun.runs || []).find(d => age >= d.startAge && age < d.startAge + 10);
    const thisYear = (r.liunian || []).find(n => n.isCurrent);
    if (curRun || thisYear) {
      html += '<p>';
      if (curRun) {
        const rd = genStageReading(curRun, ug, {
          dayZhi: r.pillars.day.zhiName,
          relations: null,
        });
        html += `当前大运 <b class="wx-${curRun.ganWuxing}">${curRun.ganName}${curRun.zhiName}</b>（${rd.level}）：${rd.summary}`;
      }
      if (thisYear) {
        const focus = TEN_GOD_FOCUS[thisYear.tenGod] || thisYear.tenGod;
        html += `${curRun ? ' ' : ''}今年 <b>${thisYear.year}${thisYear.name}</b> 流年${thisYear.tenGod}，主题「${focus}」。`;
      }
      html += '</p>';
    }

    html += '<p class="sub-note">以下分栏展开；大运时间轴见「大运」页，此处不重复粘贴。</p>';
    html += '</div>';
    return html;
  }

  /* ============== 性情气象 ============== */
  function renderTemperamentSection(r) {
    const dm = r.dayMaster;
    const trait = DAY_MASTER_TRAIT[dm.gan] || '';
    const all = collectShen(r);
    const cnt = countMap(all);
    const tops = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 4);
    const st = r.strength;
    const sha = [...new Set((r.shensha || []).map(s => s.name))];

    let html = '<div class="read-card"><h3>性情与气象</h3>';
    html += `<p>${trait}</p>`;
    html += `<p>日主${st.level}（月令${st.state}），处事基调偏`;
    if (st.level === '身强') html += '「主动、承压、宜分流精力」';
    else if (st.level === '身弱') html += '「借力、蓄势、忌长期硬扛」';
    else html += '「进退有度、顺势而为」';
    html += '。</p>';

    if (tops.length) {
      html += '<ul class="use-list">';
      tops.forEach(s => {
        html += `<li><b>${s}</b>×${cnt[s]}：${TEN_GOD_MEANING[s] || TEN_GOD_FOCUS[s] || ''}</li>`;
      });
      html += '</ul>';
    }

    // 神煞性情点
    const tips = [];
    if (sha.includes('华盖')) tips.push('华盖：喜清静玄思，小圈深度社交更适。');
    if (sha.includes('桃花')) tips.push('桃花：魅力与异性缘显，界线清晰则吉。');
    if (sha.includes('驿马')) tips.push('驿马：好动求变，久居一隅易闷。');
    if (sha.includes('羊刃')) tips.push('羊刃：性刚果决，怒气宜疏导。');
    if (sha.includes('文昌') || sha.includes('太极贵人')) tips.push('文昌/太极：悟性与学习欲强，宜持续输入。');
    if (sha.includes('天乙贵人')) tips.push('天乙：人缘与贵人缘作底，危时易得援。');
    if (tips.length) {
      html += '<p class="sub-note">神煞映照性情：</p><ul class="use-list">';
      tips.forEach(t => { html += `<li>${t}</li>`; });
      html += '</ul>';
    }

    // 调候简述（极简：冬生喜火、夏生喜水）
    const monthWx = st.monthWx;
    let tiao = '';
    if (monthWx === '水') tiao = '冬令水旺，性情易沉静内敛；稍近火暖（表达、社交、日照）可调候。';
    else if (monthWx === '火') tiao = '夏令火旺，性情易急热外放；稍近水润（冷静、规律作息）可调候。';
    else if (monthWx === '木') tiao = '春令木旺，性情好生发进取；土金稍制则成器。';
    else if (monthWx === '金') tiao = '秋令金旺，性情利落果断；火土调之则不致过刚。';
    else if (monthWx === '土') tiao = '四季土旺，性情稳重包容；木疏土、水润土可免板滞。';
    if (tiao) html += `<p>${tiao}</p>`;

    html += '</div>';
    return html;
  }

  /* ============== 四柱分论 ============== */
  function pillarFavor(p, ug) {
    const xi = ug.xi || [], ji = ug.ji || [];
    const gXi = xi.includes(p.ganWuxing), gJi = ji.includes(p.ganWuxing);
    const zXi = xi.includes(p.zhiWuxing), zJi = ji.includes(p.zhiWuxing);
    if ((gXi || zXi) && !(gJi || zJi)) return { tag: '喜', cls: 'xi' };
    if ((gJi || zJi) && !(gXi || zXi)) return { tag: '忌', cls: 'ji' };
    if ((gXi || zXi) && (gJi || zJi)) return { tag: '杂', cls: 'neu' };
    return { tag: '平', cls: 'neu' };
  }

  function renderPillarSection(r) {
    const ug = r.useGod;
    const kw = (r.kongwang && r.kongwang.zhi) || [];
    let html = '<div class="read-card"><h3>四柱分论</h3>';
    html += '<p class="sub-note">每柱看天干十神、地支本气、藏干与喜忌，对应人生阶段侧重点。</p>';
    html += '<div class="pillar-read-grid">';
    ['year', 'month', 'day', 'hour'].forEach(k => {
      const p = r.pillars[k];
      const role = PILLAR_ROLE[k];
      const fav = pillarFavor(p, ug);
      const isKong = kw.includes(p.zhiName);
      const cang = (p.canggan || []).map(g => `${g.gan}${g.tenGod}`).join('、');
      html += `<div class="pillar-read">
        <div class="pr-head">
          <span class="pr-title">${role.title}</span>
          <span class="pr-gz"><i class="wx-${p.ganWuxing}">${p.ganName}</i><i class="wx-${p.zhiWuxing}">${p.zhiName}</i></span>
          <span class="pillar-tag ${fav.cls}">${fav.tag}</span>
        </div>
        <div class="pr-life">${role.life}</div>
        <p>天干 <b>${p.ganTenGod === '日主' ? '日主' : p.ganTenGod}</b>（${p.ganWuxing}）· 地支本气 <b>${p.zhiTenGod}</b>（${p.zhiWuxing}）</p>
        <p>藏干 ${cang || '—'} · 纳音 <b>${p.nayin}</b>${isKong ? ' · <span class="bt-kong">空亡</span>' : ''}</p>
        <p class="pr-focus">${role.focus}。${pillarAdvice(k, p, r)}</p>
      </div>`;
    });
    html += '</div></div>';
    return html;
  }

  function pillarAdvice(key, p, r) {
    const ug = r.useGod;
    const fav = pillarFavor(p, ug);
    const focus = TEN_GOD_FOCUS[p.ganTenGod] || TEN_GOD_FOCUS[p.zhiTenGod] || '';
    if (key === 'day') {
      return `日支为夫妻宫，坐${p.zhiTenGod}，配偶相处基调偏「${focus || p.zhiTenGod}」。`;
    }
    if (key === 'hour') {
      return `时柱看子女与晚景，天干${p.ganTenGod}主晚年课题偏「${focus || p.ganTenGod}」。`;
    }
    if (fav.tag === '喜') return `此柱多合喜用，该阶段助力较显，宜主动作为。`;
    if (fav.tag === '忌') return `此柱多犯忌神，该阶段宜守成学习，勿硬顶。`;
    return `此柱力量中和，按十神「${focus || p.ganTenGod}」顺势即可。`;
  }

  /* ============== 分时期 ============== */
  function genStageReading(step, useGod, ctx) {
    const xi = useGod.xi, ji = useGod.ji;
    const gz = step.ganName + step.zhiName;
    const gs = step.ganTenGod, zs = step.zhiTenGod;
    const wxGan = step.ganWuxing, wxZhi = step.zhiWuxing;
    const ganXi = xi.includes(wxGan), ganJi = ji.includes(wxGan);
    const zhiXi = xi.includes(wxZhi), zhiJi = ji.includes(wxZhi);
    const score = (ganXi ? 1 : ganJi ? -1 : 0) + (zhiXi ? 1 : zhiJi ? -1 : 0);

    let level, levelCls;
    if (score >= 2) { level = '大吉'; levelCls = 'lv-great'; }
    else if (score === 1) { level = '偏吉'; levelCls = 'lv-good'; }
    else if (score === 0) { level = '平顺'; levelCls = 'lv-mid'; }
    else if (score === -1) { level = '偏忌'; levelCls = 'lv-soft'; }
    else { level = '逢忌'; levelCls = 'lv-bad'; }

    const focusG = TEN_GOD_FOCUS[gs] || gs;
    const focusZ = TEN_GOD_FOCUS[zs] || zs;
    let summary;
    if (score >= 2) summary = `干支皆喜，主${focusG}兼${focusZ}，十年利进取。`;
    else if (score === 1) {
      summary = ganXi
        ? `天干喜用主${focusG}，地支${zs}平和，稳中有进。`
        : `地支助喜主${focusZ}，天干${gs}平和，宜顺势。`;
    } else if (score === 0) summary = `${gs}主事（${focusG}），地支${zs}辅之，平波蓄力。`;
    else if (score === -1) {
      summary = ganJi
        ? `天干${gs}偏忌（${focusG}）；地支${zs}尚可，宜守。`
        : `地支${zs}偏忌；天干${gs}（${focusG}）尚可，宜稳。`;
    } else summary = `${gs}+${zs}皆忌（${focusG}/${focusZ}），压力显，宜低调守成。`;

    let relNote = '';
    if (ctx && ctx.dayZhi && typeof ctx.relations === 'function') {
      const rel = ctx.relations(step.zhiName, ctx.dayZhi);
      if (rel && rel.length) {
        relNote = `运支${step.zhiName}${rel.join('')}日支${ctx.dayZhi}`;
        if (rel.includes('冲')) summary += ' 运支冲日，变动多。';
        else if (rel.includes('合') || rel.includes('半合')) summary += ' 运支合日，人事易成。';
        else if (rel.includes('刑') || rel.includes('害')) summary += ' 运支刑害日支，宜慎人际。';
      }
    }

    // 领域提示（当前运焦点卡用）
    const domainHint = stageDomainHint(gs, score);

    return {
      age: `${step.startAge}–${step.startAge + 9} 岁`,
      startAge: step.startAge,
      gz,
      tenGodText: `${gs}·${zs}`,
      tenGodFull: `天干 ${gs}（${wxGan}）· 地支 ${zs}（${wxZhi}）`,
      level, levelCls, summary,
      action: TEN_GOD_ACTION[gs] || '宜量力而行',
      focus: focusG, relNote, score, domainHint,
      tone: summary,
    };
  }

  function stageDomainHint(gs, score) {
    const map = {
      '比肩': '人际/合伙', '劫财': '财务/竞争', '食神': '创作/健康', '伤官': '技艺/表达',
      '正财': '正职/积蓄', '偏财': '项目/人脉财', '正官': '职场/考试', '七杀': '挑战/权责',
      '正印': '学业/贵人', '偏印': '专长/副业',
    };
    const area = map[gs] || '综合';
    if (score >= 1) return `此十年偏利：${area}`;
    if (score <= -1) return `此十年慎防：${area}`;
    return `此十年课题：${area}`;
  }

  function renderStageSection(r, P) {
    const ug = r.useGod;
    const dayun = r.dayun.runs;
    const dayZhi = r.pillars.day.zhiName;
    const relFn = (P && P.relations) ? P.relations.bind(P) : null;
    const ctx = { dayZhi, relations: relFn };
    const curAge = (r._currentYear || new Date().getFullYear()) - r.input.year;
    let curIdx = -1;
    dayun.forEach((step, i) => {
      if (curAge >= step.startAge && curAge < step.startAge + 10) curIdx = i;
    });

    let html = '<div class="read-card"><h3>人生阶段运势</h3>';
    html += `<p class="sub-note">自 <b>${r.dayun.startAge}岁</b>起运（${r.dayun.forward ? '顺' : '逆'}排，共 ${dayun.length} 步）。当前运展开；全程见表。</p>`;

    if (curIdx >= 0) {
      const step = dayun[curIdx];
      const rd = genStageReading(step, ug, ctx);
      const next = dayun[curIdx + 1];
      const nextRd = next ? genStageReading(next, ug, ctx) : null;
      html += `
        <div class="now-stage">
          <div class="now-badge">当前运</div>
          <div class="now-head">
            <span class="stage-age">${rd.age}</span>
            <span class="stage-gz wx-${step.ganWuxing}">${rd.gz}</span>
            <span class="lv-pill ${rd.levelCls}">${rd.level}</span>
          </div>
          <p class="now-sum">${rd.summary}</p>
          <p class="now-act"><b>宜：</b>${rd.action}${rd.relNote ? ' · ' + rd.relNote : ''}</p>
          <p class="now-act"><b>侧重：</b>${rd.domainHint}</p>
          ${nextRd ? `<p class="now-next">下步 ${nextRd.age} 行 <b>${nextRd.gz}</b>（${nextRd.level}）：${nextRd.summary}</p>` : ''}
        </div>`;
    } else {
      html += `<p class="sub-note">尚未进入大运或已超出推演范围；下列为全程概览。</p>`;
    }

    html += '<div class="stage-table">';
    html += '<div class="st-row st-head"><span>年龄</span><span>干支</span><span>十神</span><span>运势</span><span>要点</span></div>';
    dayun.forEach((step, i) => {
      const rd = genStageReading(step, ug, ctx);
      const cur = i === curIdx ? ' is-cur' : '';
      html += `<div class="st-row${cur}">
        <span class="st-age">${rd.age}</span>
        <span class="st-gz wx-${step.ganWuxing}">${rd.gz}</span>
        <span class="st-shen">${rd.tenGodText}</span>
        <span class="lv-pill ${rd.levelCls}">${rd.level}</span>
        <span class="st-sum">${rd.summary}</span>
      </div>`;
    });
    html += '</div></div>';
    return html;
  }

  /* ============== 六大领域（加深） ============== */
  const DOMAIN_RULES = {
    '事业': (r, pat, ug) => {
      const hasGuan = pat.tianShen.includes('正官') || pat.tianShen.includes('七杀');
      const hasYin = pat.tianShen.includes('正印') || pat.tianShen.includes('偏印');
      const hasShi = pat.tianShen.includes('食神') || pat.tianShen.includes('伤官');
      const xi = primaryXi(ug);
      const adv = USE_GOD_ADVICE[xi];
      const yima = (r.shensha || []).some(s => s.name === '驿马');
      let core;
      if (hasGuan && hasYin) core = '官印相生，体制/管理/专业职级路线较顺，宜循序求名';
      else if (pat.combos.includes('杀印相生')) core = '杀印相生，逆境中易见权责与突破，宜扛事换位';
      else if (hasGuan) core = '官杀透干，宜规则内担责、考证升迁或管理岗';
      else if (hasShi) core = '食伤泄秀，才艺技术、内容创作或自由专业更合';
      else if (pat.gridName.includes('建禄') || pat.gridName.includes('羊刃')) core = '禄刃坐月，自立创业或一线冲锋合局';
      else core = `以「${pat.gridName}」为本，专精一艺立足`;
      let s = `${core}。行业向喜用${wxTag(xi)}靠拢：${adv.行业}。`;
      if (yima) s += '命带驿马，宜动不宜静，外派、出差、跨城发展有气。';
      if (r.strength.level === '身弱') s += '身弱不耐高压长期消耗，宜选有团队支撑之岗。';
      if (r.strength.level === '身强') s += '身强可担压，宜争取主导权与决策位。';
      return s;
    },
    '财运': (r, pat, ug) => {
      const hasZheng = pat.tianShen.includes('正财');
      const hasPian = pat.tianShen.includes('偏财');
      const bi = pat.tianShen; // 比劫在 tianShen 已滤，用 collect
      const all = collectShen(r);
      const hasBi = all.includes('比肩') || all.includes('劫财');
      let s;
      if (pat.combos.includes('伤官生财') || pat.combos.includes('食神生财')) {
        s = '传统“食伤生财”把技能、作品与收入联系起来；可用小项目验证变现能力，不据此放弃稳定收入。';
      } else if (hasZheng && hasPian) {
        s = '正偏财同时出现：可把稳定收入与机会收入分开记录，先设预算和风险上限。';
      } else if (hasZheng) {
        s = '正财出现：适合用稳定现金流、合同和固定项目框架观察自己的财务习惯。';
      } else if (hasPian) {
        s = '偏财出现：面对人脉或机会型收入时，宜小额验证并预先写明退出条件。';
      } else {
        s = '财星信号不突出：仍应以真实收入、支出和能力定价为依据，不等待所谓“财运时机”。';
      }
      if (hasBi) s += '涉及合伙时应写清股权、流水、责任与退出机制。';
      if (r.strength.level === '身弱' && (hasZheng || hasPian)) s += '若精力和资源有限，不宜同时开启过多项目。';
      return s + '以上不构成投资建议，资金决定请独立评估风险。';
    },
    '婚姻感情': (r, pat, ug) => {
      const dayZhi = r.pillars.day.zhiName;
      const spouseShen = r.pillars.day.zhiTenGod;
      const focus = TEN_GOD_FOCUS[spouseShen] || spouseShen;
      let s = `夫妻宫日支 <b>${dayZhi}</b>，坐 <b>${spouseShen}</b>（${focus}），相处底色偏此。`;
      if (r.kongwang && r.kongwang.zhi && r.kongwang.zhi.includes(dayZhi)) {
        s += '日支落空亡，感情节奏易飘，宜实处经营、减少幻想。';
      }
      const dayRel = (r.relations || []).filter(rr => rr.a === '日' || rr.b === '日');
      dayRel.forEach(rr => {
        if (rr.type.includes('冲')) s += `日支见冲（${rr.az}${rr.bz}），传统上用来观察互动变化；重要承诺宜留出沟通和复核空间。`;
        if (rr.type.includes('合') || rr.type.includes('半合')) s += '日支有合，可观察关系中的靠近与依赖，同时保持个人边界。';
        if (rr.type.includes('害') || rr.type.includes('刑')) s += '日支见刑害，可把它当作检查误解和沟通习惯的提示。';
      });
      const hasTao = (r.shensha || []).some(ss => ss.name === '桃花');
      if (hasTao) s += '桃花作为传统社交符号，只提醒关注选择与界线，不判断缘分结果。';
      return s + '命盘不能判断关系成败，实际相处与双方选择更重要。';
    },
    '身心习惯': (r, pat, ug) => {
      const w = r.wuxingWeighted || r.wuxingCount;
      const order = ['木', '火', '土', '金', '水'];
      const sorted = [...order].sort((a, b) => (w[b] || 0) - (w[a] || 0));
      const strong = sorted[0], weak = sorted[4];
      let s = `加权五行中 <span class="highlight">${strong}</span>较突出（${(w[strong] || 0).toFixed(1)}），<span class="highlight">${weak}</span>较少（${(w[weak] || 0).toFixed(1)}）。这只是命理结构分布，不对应器官、疾病或体质。`;
      s += '可把睡眠、饮食、运动和压力分别记录四周，只依据现实变化调整习惯。';
      if ((r.shensha || []).some(item => item.name === '羊刃')) s += '若日常动作或训练强度较大，请循序增加负荷并遵守一般运动安全规范。';
      s += '任何不适、情绪困扰或健康问题都应咨询合格专业人员。';
      return s;
    },
    '学业': (r, pat, ug) => {
      const hasYin = pat.tianShen.includes('正印') || pat.tianShen.includes('偏印');
      const hasWen = (r.shensha || []).some(s => s.name === '文昌');
      const hasShi = pat.tianShen.includes('食神') || pat.tianShen.includes('伤官');
      const hasTai = (r.shensha || []).some(s => s.name === '太极贵人');
      let s;
      if (hasYin && hasWen) s = '印星+文昌：读书考试助力大，宜正规学历与应试路径。';
      else if (hasYin) s = '印星护身：利于涵养进修、拜师考证，厚积薄发。';
      else if (hasWen) s = '文昌在命：笔墨科名有气，宜应试、写作、表达类表现。';
      else if (hasShi) s = '食伤吐秀：实操、作品集、技能认证比死记更利。';
      else s = '学业以勤为径；书桌可朝喜用方位，助专注。';
      if (hasTai) s = (s || '') + '太极贵人助悟性，适合钻研与跨学科。';
      const xi = primaryXi(ug);
      s += `进修方向可参考喜用${wxTag(xi)}相关行业技能。`;
      return s;
    },
    '人际': (r, pat, ug) => {
      const all = collectShen(r);
      const hasBi = all.includes('比肩') || all.includes('劫财');
      const gui = (r.shensha || []).filter(s => s.name === '天乙贵人' || s.name === '太极贵人');
      const guiNames = [...new Set(gui.map(g => g.name + '（' + g.zhi + g.pillar + '）'))];
      let s;
      if (guiNames.length) s = `贵人星：${guiNames.join('、')}，危难可借力，宜维护长辈同僚与贵人缘。`;
      else if (hasBi) s = '比劫较显：朋友多也竞争多，合伙分清权责，择善而交。';
      else s = '待人以诚为上；喜用色饰可作社交场合气场调和。';
      if ((r.shensha || []).some(s => s.name === '华盖')) s += '华盖在命：喜清静小圈，深交胜广交，玄艺同道更合。';
      if ((r.shensha || []).some(s => s.name === '桃花')) s += '桃花助人缘，社交场合易被记住，把握分寸。';
      return s;
    },
  };

  function renderDomainSection(r, P) {
    const pat = r.pattern, ug = r.useGod;
    let html = '<div class="read-card"><h3>六大领域</h3>';
    html += '<p class="sub-note">结合格局、十神、神煞、旺衰与刑冲，非通用鸡汤。</p>';
    html += '<div class="domain-grid">';
    Object.keys(DOMAIN_RULES).forEach(name => {
      html += `<div class="domain-item">
        <div class="domain-name">${name}</div>
        <div class="domain-text">${DOMAIN_RULES[name](r, pat, ug)}</div>
      </div>`;
    });
    html += '</div></div>';
    return html;
  }

  /* ============== 流年细评（解读页专属，比大运页更长） ============== */
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };

  function renderLiunianSection(r) {
    if (!r.liunian || !r.liunian.length) return '';
    const cy = r._currentYear || new Date().getFullYear();
    const near = r.liunian.filter(n => n.year >= cy - 1 && n.year <= cy + 6);
    if (!near.length) return '';
    const ug = r.useGod;

    let html = '<div class="read-card"><h3>近流年细评</h3>';
    html += '<p class="sub-note">今年前后数年：十神主题 + 喜忌 + 与日支关系。完整网格见「大运」页。</p>';
    html += '<div class="ln-detail-list">';
    near.forEach(n => {
      const focus = TEN_GOD_FOCUS[n.tenGod] || n.tenGod;
      const action = TEN_GOD_ACTION[n.tenGod] || '';
      let wxNote = '平年';
      let cls = n.isCurrent ? ' is-now' : '';
      const wxG = GAN_WX[n.gan], wxZ = ZHI_WX[n.zhi];
      if (ug.xi.includes(wxG) || ug.xi.includes(wxZ)) { wxNote = '利喜用'; cls += ' ln-xi'; }
      else if (ug.ji.includes(wxG) || ug.ji.includes(wxZ)) { wxNote = '多犯忌'; cls += ' ln-ji'; }
      const rel = (n.relWithDayZhi && n.relWithDayZhi.length) ? n.relWithDayZhi.join('') + '日支' : '与日支无显著冲合';
      html += `<div class="ln-line${cls}">
        <div class="ln-line-h">
          <b>${n.year}</b>
          <span class="ln-line-gz">${n.name}</span>
          <span class="ln-line-shen">${n.tenGod}</span>
          ${n.isCurrent ? '<span class="now-badge-inline">今年</span>' : ''}
          <span class="ln-line-wx">${wxNote}</span>
        </div>
        <p>主题「${focus}」。${action}。${rel}。</p>
      </div>`;
    });
    html += '</div></div>';
    return html;
  }

  /* ============== 生活实践参考 ============== */
  function renderPracticalSection(r) {
    const ug = r.useGod;
    const xiList = ug.xi || [];
    const jiList = ug.ji || [];
    let html = '<div class="read-card"><h3>生活实践参考</h3>';
    html += '<p class="sub-note">以下是传统五行的联想练习，不具开运功效；职业、饮食和重大决定仍以现实证据为准。</p>';

    // 汇总喜用建议
    const dirs = [], colors = [], industries = [], nums = [], goods = [], foods = [];
    const seen = new Set();
    xiList.forEach(wx => {
      if (seen.has(wx)) return; seen.add(wx);
      const a = USE_GOD_ADVICE[wx];
      if (!a) return;
      dirs.push(a.方位); colors.push(a.颜色); industries.push(a.行业);
      nums.push(a.数字); goods.push(a.配饰); foods.push(a.饮食);
    });

    html += '<div class="prac-grid">';
    html += item('环境联想', `传统上会联想到 ${dirs.join('、')} 方；可把它作为空间布置偏好，不必据此避开任何方向。`);
    html += item('色彩偏好', `可尝试 ${colors.join('、')} 与 ${goods.join('、')}，只以个人审美和使用体验为准。`);
    html += item('职业联想', industries.join('；') + '。这些仅供探索兴趣，不能替代能力、机会和行业调研。');
    html += item('数字符号', `传统联想数字为 ${nums.join('、')}；不用于择日、下注、选号或判断吉凶。`);
    html += item('日常习惯', foods.join('；') + '。如有营养或健康需求，请咨询专业人员。');
    html += item('行为心法', r.strength.level === '身弱'
      ? '身弱宜借力：多请教、少硬扛，重要决策拉人一起。'
      : r.strength.level === '身强'
        ? '身强宜分流：用专业、理财、运动消耗过剩精力，避免争强。'
        : '中和之命宜平衡：进退有度，喜用年份进取、忌神年份修整。');
    html += '</div></div>';
    return html;

    function item(title, body) {
      return `<div class="prac-item"><div class="prac-title">${title}</div><div class="prac-body">${body}</div></div>`;
    }
  }

  /* ============== 词典折叠 ============== */
  function renderMeaningSection(r, P) {
    const shenSet = new Set();
    ['year', 'month', 'day', 'hour'].forEach(k => {
      const p = r.pillars[k];
      if (p.ganTenGod && p.ganTenGod !== '日主') shenSet.add(p.ganTenGod);
      if (p.zhiTenGod) shenSet.add(p.zhiTenGod);
    });
    (r.dayun.runs || []).forEach(step => {
      if (step.ganTenGod) shenSet.add(step.ganTenGod);
      if (step.zhiTenGod) shenSet.add(step.zhiTenGod);
    });

    let html = '<details class="dict-fold"><summary>附录 · 十神与神煞词典（点击展开）</summary>';
    html += '<div class="dict-body">';
    html += '<p class="sub-note">本命及大运涉及的十神：</p><div class="meaning-grid">';
    [...shenSet].forEach(s => {
      html += `<div class="meaning-card"><div class="m-title">${s}</div><div class="m-body">${TEN_GOD_MEANING[s] || ''}</div></div>`;
    });
    html += '</div>';

    const sha = r.shensha || [];
    html += '<p class="sub-note" style="margin-top:14px">本命神煞：</p>';
    if (sha.length) {
      html += '<div class="meaning-grid">';
      const seen = new Set();
      sha.forEach(s => {
        if (seen.has(s.name)) return; seen.add(s.name);
        html += `<div class="meaning-card"><div class="m-title">${s.name}<small>${s.zhi}${s.pillar}柱</small></div><div class="m-body">${SHENSHA_MEANING[s.name] || ''}</div></div>`;
      });
      html += '</div>';
    } else html += '<p>四柱神煞不显。</p>';
    html += '</div></details>';
    return html;
  }

  /* ============== 排盘页短片段 ============== */
  function renderShenShaInline(r) {
    const sha = r.shensha || [];
    if (!sha.length) return '<span style="color:var(--ink-2)">—</span>';
    const seen = new Set();
    return sha.map(s => {
      if (seen.has(s.name + s.zhi + s.pillar)) return '';
      seen.add(s.name + s.zhi + s.pillar);
      return `<span class="sha-item" title="${SHENSHA_MEANING[s.name] || ''}">${s.name}</span>`;
    }).join('');
  }

  function relationsText(rels) {
    if (!rels || !rels.length) return '无显著冲刑破害。';
    return rels.map(rr => {
      if (!rr.b) return `<b>${rr.type.join('/')}</b>${rr.az}`;
      return `${rr.a}${rr.az} <b>${rr.type.join('/')}</b> ${rr.bz}${rr.b}`;
    }).join('；');
  }

  const TEN_GOD_THEME = Object.fromEntries(
    Object.keys(TEN_GOD_FOCUS).map(k => [k, TEN_GOD_FOCUS[k]])
  );

  const API = {
    TEN_GOD_MEANING, SHENSHA_MEANING, USE_GOD_ADVICE, TEN_GOD_THEME, TEN_GOD_FOCUS, TEN_GOD_ACTION,
    PATTERN_NOTE, COMBO_NOTE, DAY_MASTER_TRAIT,
    wxColor, wxTag,
    genPatternText, genStrengthText, genUseGodText,
    genStageReading, renderStageSection,
    renderOverviewSection, renderTemperamentSection, renderPillarSection, renderDomainSection,
    renderLiunianSection, renderPracticalSection, renderMeaningSection,
    renderShenShaInline, relationsText,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    Bazi.interpret = API;
  }
})();
