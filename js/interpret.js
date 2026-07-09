/* ============================================================
 * 八字排盘 解读文案层  interpret.js
 * 提供释义词典与生成函数（纯函数，输入引擎结果，输出字符串/HTML片段）。
 * 依赖：Bazi.constants、Bazi.plus。浏览器全局；Node 下 module.exports。
 * ============================================================ */
(function () {
  'use strict';

  const WX_COLOR = { '木': '#3a7d3a', '火': '#c0392b', '土': '#8b6f3a', '金': '#8a8a3a', '水': '#2c5f7a' };

  /* ---------- 十神释义 ---------- */
  const TEN_GOD_MEANING = {
    '比肩': '同我之比肩，主刚健自立、自信果决，朋辈助力，亦主竞争。',
    '劫财': '异我之劫财，主热情仗义、行动力强，慷慨好胜，亦防破耗。',
    '食神': '我生之食神，主温和聪慧、才艺口福，性情宽和，利于表达创造。',
    '伤官': '我生之伤官，主聪慧外露、才华横溢，叛逆不羁，利于专精技艺。',
    '正财': '我克之正财，主勤俭务实、踏实聚财，稳定收入，重信誉。',
    '偏财': '我克之偏财，主慷慨多情、机变生财，横财机遇，善社交。',
    '正官': '克我之正官，主端正守纪、责任荣誉，宜公职规束，贵气内敛。',
    '七杀': '克我之七杀，主威严果断、魄力挑战，压力亦机遇，宜制化方吉。',
    '正印': '生我之正印，主仁慈聪慧、学识荫护，长辈贵人，沉静包容。',
    '偏印': '生我之偏印，主孤僻多思、专长钻研，悟性高，亦主偏门技艺。',
  };

  /* ---------- 神煞释义 ---------- */
  const SHENSHA_MEANING = {
    '天乙贵人': '逢凶化吉之星，主贵人扶助、危难得脱，处世多遇提携。',
    '文昌': '文曲之星，主聪明好学、文采斐然，利于考试与笔墨。',
    '太极贵人': '聪慧沉静之星，主悟性高、喜钻研，遇事多有转机。',
    '桃花': '咸池之星，主人缘魅力、感情丰富，异性缘佳，亦需防滥情。',
    '驿马': '奔驰之星，主走动迁移、外出得财，宜动不宜静，多变通。',
    '华盖': '孤高之星，主聪颖好学、喜玄艺，性偏孤傲，宜技艺修行。',
    '天医': '医药之星，主体弱多病亦易近医道，可习医养生。',
    '禄神': '养命之源，主衣禄丰足、安稳有靠，身临禄地气足。',
    '羊刃': '刚烈之星，主果敢刚强亦易冲动，身弱可助，身旺防伤。',
  };

  /* ---------- 五行 -> 开运建议 ---------- */
  const USE_GOD_ADVICE = {
    '木': { 方位: '东方', 颜色: '青绿', 行业: '文化教育、农林、设计创意', 数字: '3、8' },
    '火': { 方位: '南方', 颜色: '红紫', 行业: '传媒、餐饮、能源、演艺', 数字: '2、7' },
    '土': { 方位: '中央/本地', 颜色: '黄棕', 行业: '地产、金融、咨询、服务', 数字: '5、0' },
    '金': { 方位: '西方', 颜色: '白银', 行业: '机械、金融、法律、技术', 数字: '4、9' },
    '水': { 方位: '北方', 颜色: '黑蓝', 行业: '贸易、物流、信息、旅游', 数字: '1、6' },
  };

  function wxColor(wx) { return WX_COLOR[wx] || '#333'; }
  function wxTag(wx) { return `<span class="wx-inline wx-${wx}">${wx}</span>`; }

  /* ============== 格局与喜用神文案 ============== */
  function genPatternText(pattern) {
    let s = `命局入 <span class="highlight">${pattern.gridName}</span>`;
    if (pattern.combos && pattern.combos.length) {
      s += '，兼带 ' + pattern.combos.map(c => `<span class="highlight">${c}</span>`).join('、') + ' 之象';
    }
    s += '。';
    return s;
  }
  function genStrengthText(strength) {
    const lvlMap = { '身强': '日主偏旺', '身弱': '日主偏弱', '中和': '日主中和' };
    return `月令${strength.state}之地，生扶之力约占 <span class="highlight">${Math.round(strength.ratio * 100)}%</span>，${lvlMap[strength.level]}。${strength.note}`;
  }
  function genUseGodText(useGod) {
    const xi = useGod.xi.map(wxTag).join('、');
    const ji = useGod.ji.map(wxTag).join('、');
    let html = `<p>喜用五行：${xi}；忌神五行：${ji}。</p>`;
    html += '<ul>';
    const seen = new Set();
    useGod.xi.forEach(wx => {
      if (seen.has(wx)) return; seen.add(wx);
      const a = USE_GOD_ADVICE[wx];
      html += `<li><span class="wx-inline wx-${wx}">${wx}</span> 为用：利 <b>${a.方位}</b>、着 <b>${a.颜色}</b>、宜从事 <b>${a.行业}</b>、吉祥数 <b>${a.数字}</b>。</li>`;
    });
    html += '</ul>';
    return html;
  }

  /* ============== 分时期人生解读 ============== */
  // 十神主题词（用于分时期文案）
  const TEN_GOD_THEME = {
    '比肩': '主自立与合作，宜结交同道、独当一面',
    '劫财': '主进取与破耗，行动力强但需防财务口舌',
    '食神': '主才艺与享受，宜表达创作、修身养福',
    '伤官': '主锋芒与变革，才华外显，宜专精技艺、忌恃才傲物',
    '正财': '主务实与积累，正财稳进，宜勤勉理财',
    '偏财': '主机遇与social，偏财活络，善抓机会',
    '正官': '主责任与名位，宜守规上进、求职升迁',
    '七杀': '主压力与突破，挑战与机遇并存，宜制化得宜',
    '正印': '主学业与荫护，长辈贵人相助，宜进修沉淀',
    '偏印': '主专长与思辨，悟性高，宜钻研偏门技艺',
  };
  // 基于每步大运生成十年运势文案。
  function genStageReading(step, useGod) {
    const xi = useGod.xi, ji = useGod.ji;
    const gz = step.ganName + step.zhiName;
    const gs = step.ganTenGod, zs = step.zhiTenGod;
    const wxGan = step.ganWuxing, wxZhi = step.zhiWuxing;
    const ganXi = xi.includes(wxGan), ganJi = ji.includes(wxGan);
    const zhiXi = xi.includes(wxZhi), zhiJi = ji.includes(wxZhi);
    const score = (ganXi ? 1 : ganJi ? -1 : 0) + (zhiXi ? 1 : zhiJi ? -1 : 0);
    const theme = TEN_GOD_THEME[gs] || '';
    let tone;
    if (score >= 2) tone = `大吉之运。天干${gs}、地支${zs}皆为喜用，${theme}，此十年顺风顺水，宜大胆进取、把握良机。`;
    else if (score === 1) tone = `偏吉之运。${gs}当令，${theme}；干支一喜一平，稳中有进，宜顺势而为。`;
    else if (score === 0) tone = `平顺之运。${gs}主事，${theme}；喜忌相参，宜守成蓄势、稳扎稳打，不宜冒进。`;
    else if (score === -1) tone = `小逆之运。${gs}临事，干支一忌一平，${theme}，此十年多有牵绊，宜守不宜攻、谨慎周旋。`;
    else tone = `逢忌之运。天干${gs}、地支${zs}皆犯所忌，压力较显，宜低调守成、修身避险，静待运转。`;
    return {
      age: `${step.startAge}–${step.startAge + 9} 岁`,
      gz,
      tenGodText: `天干 ${gs}（${wxGan}）· 地支 ${zs}（${wxZhi}）`,
      tone,
    };
  }
  function renderStageSection(r, P) {
    const ug = r.useGod;
    const dayun = r.dayun.runs;
    let html = '<div class="read-card"><h3>分时期人生解读</h3>';
    html += `<p>以下依大运起运 <span class="highlight">${r.dayun.startAge}岁</span>（${r.dayun.forward ? '顺' : '逆'}排）逐十年论之，重在趋势，非定数。</p>`;
    dayun.forEach(step => {
      const rd = genStageReading(step, ug);
      html += `
        <div class="stage-item">
          <div class="stage-head">
            <span class="stage-age">${rd.age}</span>
            <span class="stage-gz wx-${step.ganWuxing}">${rd.gz}</span>
            <span class="stage-shen">${rd.tenGodText}</span>
          </div>
          <p class="stage-text">${rd.tone}</p>
        </div>`;
    });
    // 当前及未来流年简评
    if (r.liunian && r.liunian.length) {
      const now = r.liunian.filter(n => n.isCurrent || (n.year >= (r.input.year + r.dayun.startAge) && n.year <= (r.input.year + r.dayun.startAge + 20)));
      if (now.length) {
        html += '<div class="stage-sub">近年流年提示（流年干支相对日主十神）：</div>';
        html += '<div class="ln-mini-grid">';
        now.slice(0, 10).forEach(n => {
          const rel = n.relWithDayZhi.length ? '（'+ n.relWithDayZhi.join('') +'日支）' : '';
          html += `<span class="ln-mini"><b>${n.year}</b> ${n.name}<small>${n.tenGod}${rel}</small></span>`;
        });
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }

  /* ============== 六大领域分析 ============== */
  const DOMAIN_RULES = {
    '事业': (r, pat, ug) => {
      const hasGuan = pat.tianShen.includes('正官') || pat.tianShen.includes('七杀');
      const hasYin = pat.tianShen.includes('正印') || pat.tianShen.includes('偏印');
      if (hasGuan && hasYin) return '官印相生，宜公职、管理、体制内发展，贵气内藏，循序渐进可成。';
      if (hasGuan) return '官星透显，宜守规矩、担责任，-management 或专业岗可得赏识。';
      if (pat.gridName.includes('伤官') || pat.gridName.includes('食神')) return '食伤泄秀，宜凭才艺、技术、创作立身，自由职业或专精一艺易成。';
      return '宜以一技之长立足，结合喜用五行选择行业方向，踏实积累。';
    },
    '财运': (r, pat, ug) => {
      const hasCai = pat.tianShen.includes('正财') || pat.tianShen.includes('偏财');
      if (pat.combos.includes('伤官生财') || pat.combos.includes('食神生财')) return '食伤生财，以才智技艺生财，财源有创意性、流动性，宜活络经营。';
      if (hasCai) return '财星透干，正财宜稳、偏财宜机；理财以稳健为主，偶可把握机遇。';
      return '财星不显，宜以专长换酬，量入为出，借运年财旺之时进取。';
    },
    '婚姻感情': (r, pat, ug) => {
      const dayZhi = r.pillars.day.zhiName;
      const spouseShen = r.pillars.day.zhiTenGod;
      let s = `日支为夫妻宫（${dayZhi}），坐 ${spouseShen}，主配偶性情与相处基调。`;
      if (r.input.gender === 'male') s += '男看财为妻星，' + (pat.tianShen.includes('正财') || pat.tianShen.includes('偏财') ? '妻星有现，感情可托。' : '妻星隐伏，宜晚婚或借运年引动。');
      else s += '女看官为夫星，' + (pat.tianShen.includes('正官') || pat.tianShen.includes('七杀') ? '夫星有现，良缘可期。' : '夫星隐伏，宜待运年逢合方稳。');
      return s;
    },
    '健康': (r, pat, ug) => {
      const w = r.wuxingCount;
      const order = ['木', '火', '土', '金', '水'];
      const sorted = [...order].sort((a, b) => w[b] - w[a]);
      const strong = sorted[0], weak = sorted[4];
      const map = {
        '木': '木旺防肝胆、筋骨；木弱宜养肝。',
        '火': '火旺防心脑、血脉；火弱宜养心。',
        '土': '土旺防脾胃、肌肤；土弱宜养脾。',
        '金': '金旺防肺肠、呼吸道；金弱宜润肺。',
        '水': '水旺防肾膀胱、泌尿；水弱宜补肾。',
      };
      return `五行最旺为 <span class="highlight">${strong}</span>、最弱为 <span class="highlight">${weak}</span>。${map[strong]}${map[weak]}（健康以现代医学为准，此仅作传统养生参考。）`;
    },
    '学业': (r, pat, ug) => {
      const hasYin = pat.tianShen.includes('正印') || pat.tianShen.includes('偏印');
      const hasWen = pat.tianShen.includes('食神') || pat.tianShen.includes('伤官') || (r.shensha || []).some(s => s.name === '文昌');
      if (hasYin && hasWen) return '印星生身、文昌文曲并见，聪慧好学，考试科名多有助益。';
      if (hasYin) return '印星护身，利于读书涵养、师友提点，宜厚积薄发。';
      if (hasWen) return '食伤吐秀、文昌在命，才思敏捷，宜文科艺能表现。';
      return '学业以勤为径，结合喜用方位设案、择师，可增助益。';
    },
    '人际': (r, pat, ug) => {
      const hasBi = pat.tianShen.includes('比肩') || pat.tianShen.includes('劫财');
      const hasGui = (r.shensha || []).some(s => s.name === '天乙贵人' || s.name === '太极贵人');
      if (hasGui) return '贵人星照，危难有人扶、处事宜借力长辈同僚，广结善缘。';
      if (hasBi) return '比劫并见，朋辈助力多，亦主竞争，交友贵在择善而交。';
      return '待人宜诚，借喜用五行之方位颜色调和气场，和合为贵。';
    },
  };
  function renderDomainSection(r, P) {
    const pat = r.pattern, ug = r.useGod;
    let html = '<div class="read-card"><h3>六大领域分析</h3>';
    html += '<div class="domain-grid">';
    Object.keys(DOMAIN_RULES).forEach(name => {
      const txt = DOMAIN_RULES[name](r, pat, ug);
      html += `
        <div class="domain-item">
          <div class="domain-name">${name}</div>
          <div class="domain-text">${txt}</div>
        </div>`;
    });
    html += '</div></div>';
    return html;
  }

  /* ============== 十神+神煞释义卡片 ============== */
  function renderMeaningSection(r, P) {
    // 十神：本盘出现过的
    const shenSet = new Set();
    ['year', 'month', 'day', 'hour'].forEach(k => {
      const p = r.pillars[k];
      if (p.ganTenGod && p.ganTenGod !== '日主') shenSet.add(p.ganTenGod);
      if (p.zhiTenGod) shenSet.add(p.zhiTenGod);
    });
    let html = '<div class="read-card"><h3>十神释义</h3><p class="sub-note">本命出现的十神及含义：</p><div class="meaning-grid">';
    [...shenSet].forEach(s => {
      html += `<div class="meaning-card"><div class="m-title">${s}</div><div class="m-body">${TEN_GOD_MEANING[s] || ''}</div></div>`;
    });
    html += '</div></div>';

    // 神煞
    const sha = r.shensha || [];
    html += '<div class="read-card"><h3>神煞释义</h3>';
    if (sha.length) {
      html += '<div class="meaning-grid">';
      const seen = new Set();
      sha.forEach(s => {
        if (seen.has(s.name)) return; seen.add(s.name);
        html += `<div class="meaning-card"><div class="m-title">${s.name}<small>${s.zhi}${s.pillar}柱</small></div><div class="m-body">${SHENSHA_MEANING[s.name] || ''}</div></div>`;
      });
      html += '</div>';
    } else {
      html += '<p>四柱神煞不显，格局清雅。</p>';
    }
    html += '</div>';
    return html;
  }

  /* ============== 排盘结果页：神煞/空亡/关系 展示片段 ============== */
  function renderShenShaInline(r) {
    const sha = r.shensha || [];
    if (!sha.length) return '<span style="color:var(--ink-light)">—</span>';
    const seen = new Set();
    return sha.map(s => {
      if (seen.has(s.name + s.zhi + s.pillar)) return '';
      seen.add(s.name + s.zhi + s.pillar);
      return `<span class="sha-item" title="${SHENSHA_MEANING[s.name] || ''}">${s.name}</span>`;
    }).join('');
  }
  function relationsText(rels) {
    if (!rels || !rels.length) return '无显著冲刑破害。';
    return rels.map(rr => `${rr.a}${rr.az} <b>${rr.type.join('/')}</b> ${rr.bz}${rr.b}`).join('；');
  }

  const API = {
    TEN_GOD_MEANING, SHENSHA_MEANING, USE_GOD_ADVICE, TEN_GOD_THEME,
    wxColor, wxTag,
    genPatternText, genStrengthText, genUseGodText,
    genStageReading, renderStageSection,
    renderDomainSection, renderMeaningSection,
    renderShenShaInline, relationsText,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    Bazi.interpret = API;
  }
})();
