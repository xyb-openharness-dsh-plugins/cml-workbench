/* 36 号 · 疾病概要数据（慢性粒细胞白血病 / CML）
 * 四段固定顺序：definition → evidence → landscape → trend。
 * 内容只取本仓 README / docs / research 的事实性整理，不写判定、不复制指南条文。
 * 链接逐条用 primer-backfill-2026-10-27/verify-links.mjs 实测；未取得可验证 OK 链接的写 nolink + note。
 */
window.DISEASE_PRIMER = {
  brand: '小粒宝 GranPal',
  name: '慢性粒细胞白血病',
  en: 'Chronic Myeloid Leukemia（CML）',
  updated: '2026-10-27',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: '慢性粒细胞白血病（CML）是骨髓造血干细胞克隆性增殖的白血病。本台只整理公开资料里的事实，不对任何个人情况做判读。',
      points: [
        '诊断依据是 Ph 染色体和/或 BCR::ABL1 融合基因阳性；报告需明确转录本类型（e13a2 / e14a2 / 非典型）。',
        '2022 ICC 分类按骨髓或外周血原始细胞比例划分病程：慢性期（CP）<10%、加速期（AP）10–19%、急变期（BP）≥20%。',
        'BCR::ABL1 定量结果以国际标尺（IS%）报告；IS 需要实验室用转换因子（CF）本地标准化。',
        '本仓医学调研记录：中国患者中位发病年龄 45–50 岁，美国报告为 66 岁（指南原文口径）。'
      ],
      sources: [
        { org: '中华医学会血液学分会', doc: '中国 CML 诊断与治疗指南（2025）', version: '中华血液学杂志 2025;46(12):1081-1093', original: true, nolink: true, note: 'PMC12790979 实测返回 203/0 chars、DOI 落地页为 JS 渲染，验链器未取得 OK；本台研究阶段曾据 PMC 全文核对口径' },
        { org: 'ICC', doc: 'International Consensus Classification of Myeloid Neoplasms and Acute Leukemias', version: '2022（Blood 2022;140(11):1200-1228）', original: true, nolink: true, note: 'Blood DOI 返回 403、PMC9479031 返回 203/0 chars，验链器未取得 OK' },
        { org: 'ELN', doc: '2025 European LeukemiaNet recommendations for the management of CML', version: 'Leukemia 2025;39(8):1797-1813', original: true, kind: 'fulltext', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12310532/', page: '页码待核' }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '这个工作台里出现的每一条「该查什么、如何记录」，都应能追到下面某份文件。未取得可验证原件的，在表里如实标出来，不假装看过。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台的用途'],
        rows: [
          ['中华医学会血液学分会', '中国 CML 诊断与治疗指南（2025）', '中华血液学杂志 2025;46(12):1081-1093',
            { text: '未取得可验证原件', nolink: true, note: 'PMC12790979 返回 203/0 chars、DOI 落地页为 JS 渲染，验链器未取得 OK' },
            '诊断线、监测节奏、TFR 条件等原文口径的出处'],
          ['ELN', '2025 European LeukemiaNet recommendations for the management of CML', 'Leukemia 2025;39(8):1797-1813',
            { text: '已取得：PMC 全文', kind: 'fulltext', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12310532/' },
            '风险分层、监测与 TFR 口径的并列引用'],
          ['ELN', 'ELN CML 项目页（官网入口）', '访问于 2026-10-27',
            { text: '官方入口', kind: 'hub', url: 'https://www.leukemia-net.org/leukemias/cml/project_info/', note: 'ELN 官网 CML 项目页；2025 建议全文见 Leukemia 2025;39(8):1797-1813 / PMC12310532，本台未在该页取得全文' },
            '官方入口，便于读者自行查找 ELN 资料'],
          ['NCCN', 'NCCN Guidelines · Chronic Myeloid Leukemia', 'V2.2024（JNCCN 2024;22(1):43-69）',
            { text: '官方入口（临床版）', kind: 'hub', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1096', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
            '分期检查与治疗线序的并列引用'],
          ['ICC', 'International Consensus Classification of Myeloid Neoplasms and Acute Leukemias', '2022（Blood 2022;140(11):1200-1228）',
            { text: '未取得可验证原件', nolink: true, note: 'Blood DOI 返回 403、PMC9479031 返回 203/0 chars' },
            'CP / AP / BP 原始细胞界值的分类口径']
        ]
      },
      points: [
        '指南给的是「通常怎么做」，不是「你该怎么做」；版本号写清，同一份指南隔一年条目会变。',
        '本台对未取得原件的文件只记「存在」与「大致讲什么」，不引用其具体条文。'
      ],
      sources: [
        { org: 'ELN', doc: '2025 European LeukemiaNet recommendations for the management of CML', version: 'Leukemia 2025;39(8):1797-1813', original: true, kind: 'fulltext', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12310532/', page: '页码待核' },
        { org: 'NCCN', doc: 'NCCN Guidelines · Chronic Myeloid Leukemia', version: 'V2.2024', entry: true, kind: 'hub', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1096', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: 'ELN', doc: 'ELN CML 项目页（官网入口）', version: '访问于 2026-10-27', entry: true, kind: 'hub', url: 'https://www.leukemia-net.org/leukemias/cml/project_info/', note: 'ELN 官网 CML 项目页；2025 建议全文见 Leukemia 2025;39(8):1797-1813 / PMC12310532，本台未在该页取得全文' },
        { org: '中华医学会血液学分会', doc: '中国 CML 诊断与治疗指南（2025）', version: '中华血液学杂志 2025;46(12):1081-1093', original: true, nolink: true, note: 'PMC 与 DOI 落地页均未取得验链器 OK' },
        { org: 'ICC', doc: 'International Consensus Classification of Myeloid Neoplasms and Acute Leukemias', version: '2022', original: true, nolink: true, note: 'Blood DOI 403、PMC 203/0 chars' }
      ]
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '下面按期别与线序列出本仓文档与指南里出现过的手段类别。这是「世界上大致有哪些办法」的地图，不是给你排的先后顺序。',
      groups: [
        {
          label: '慢性期一线（TKI）',
          points: [
            '伊马替尼（一代 ATP 竞争性 TKI）：口服 TKI，指南列为慢性期一线药物之一。',
            '尼洛替尼、氟马替尼（二代 TKI）：指南列为慢性期一线药物之一。',
            '阿思尼布（STAMP 变构抑制剂）：指南列为慢性期一线药物之一。'
          ]
        },
        {
          label: '二线及以后（TKI）',
          points: [
            '达沙替尼、博舒替尼（二代 TKI）：指南列举的 TKI，用于不耐受或耐药后的线序调整。',
            '泊那替尼、奥雷巴替尼（三代 TKI）：指南列举的 TKI，用于后续线序或 T315I 等情形。'
          ]
        },
        {
          label: '特殊情形',
          points: [
            '干扰素 α：指南将干扰素 α 列为妊娠期可用的选择之一。',
            'TFR（无治疗缓解）停药观察：指南把 TFR 列为慢性期管理内容之一，并列出停药条件与监测频率；本台只做条件核对清单，不给停药结论。'
          ]
        }
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。'
      ],
      sources: [
        { org: 'ELN', doc: '2025 European LeukemiaNet recommendations for the management of CML', version: 'Leukemia 2025;39(8):1797-1813', original: true, kind: 'fulltext', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12310532/', page: '页码待核' },
        { org: 'NCCN', doc: 'NCCN Guidelines · Chronic Myeloid Leukemia', version: 'V2.2024', entry: true, kind: 'hub', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1096', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: '中华医学会血液学分会', doc: '中国 CML 诊断与治疗指南（2025）', version: '中华血液学杂志 2025;46(12):1081-1093', original: true, nolink: true, note: 'PMC 与 DOI 落地页均未取得验链器 OK' }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '这一段只写已经发生的事：哪份文件换了版本、哪一天发表、分类体系改了什么。不写预测，不做评价，也不给任何倾向。',
      points: [
        '2022-09：ICC 共识分类发表（Blood 2022;140(11):1200-1228），CML 病程按 CP / AP / BP 原始细胞比例划分。',
        '2024-02：NCCN CML 指南 V2.2024 发表（JNCCN 2024;22(1):43-69）。',
        '2025-07：ELN 2025 CML 管理建议发表（Leukemia 2025;39(8):1797-1813）。',
        '2025-12：中国 CML 诊断与治疗指南（2025）发表（中华血液学杂志 2025;46(12):1081-1093）。',
        '2025 版中国指南新增药物条目：阿思尼布、奥雷巴替尼、泊那替尼（本仓医学调研记录）。',
        '2025 版中国指南新增「主动性剂量调整」内容：达沙替尼 100→50/20 mg、泊那替尼 45→15 mg、奥雷巴替尼 40 与 30 mg 隔日（本仓医学调研记录）。'
      ],
      sources: [
        { org: '中华医学会血液学分会', doc: '中国 CML 诊断与治疗指南（2025）', version: '中华血液学杂志 2025;46(12):1081-1093', original: true, nolink: true, note: 'PMC 与 DOI 落地页均未取得验链器 OK' },
        { org: 'ELN', doc: '2025 European LeukemiaNet recommendations for the management of CML', version: 'Leukemia 2025;39(8):1797-1813', original: true, kind: 'fulltext', url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12310532/', page: '页码待核' },
        { org: 'NCCN', doc: 'NCCN Guidelines · Chronic Myeloid Leukemia', version: 'V2.2024', entry: true, kind: 'hub', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1096', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: 'ICC', doc: 'International Consensus Classification of Myeloid Neoplasms and Acute Leukemias', version: '2022', original: true, nolink: true, note: 'Blood DOI 403、PMC 203/0 chars' }
      ]
    }
  ]
}
