/* 小粒宝 GranPal · 演示数据生成器（唯一数据源）
   产出：demo/demo-data.sqlite（可 SQL 查询）+ prototypes/v0.2/demo-data.js（原型只读数据层）
   原则：全部患者数据为虚构模拟；trials 表为真实登记摘录（M4 前为空，不伪造）。
   运行：node demo/build-demo-data.mjs —— 改数据只改这里，两个产物一起重生成。

   本癌种专属约定（改前必读）：
   - **qPCR 记录必带可比性四要素**：unit（IS%）、lab、is_standardized、sensitivity。
     缺一即为"不可比"，趋势图上必须分段——这是 CML 最容易出错的地方（指南原文：
     "不建议根据 BCR::ABL1 IS 的单次、单一数值做出转换治疗的决策"）。
   - **处方变更含频次 frequency**：daily / qod（隔日）/ intermittent。2025 中国指南首次提出
     主动性剂量优化（达沙 100→50/20mg、泊那 45→15mg、奥雷巴替尼 40/30mg 隔日），
     频次不是备注而是主字段。
   - **副作用按药归属**：ae 记录带 drug_key，界面按当前用药过滤，不做全表平铺。
   - **分类值不进趋势**：kind='grade'/'qual' 的指标不参与数值曲线（只做时间线）。
   - **分节标题走 section_titles**，不在 profile 上排 *_title 列。
   - INSERT 一律写显式列名；events/docs/candidates 为定长数组。
*/
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync, unlinkSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const P2 = join(ROOT, 'prototypes/v0.2');

/* ---------- 档案 A：46 岁男性，慢性期 · 伊马替尼 → 达沙替尼（胸腔积液换药） ---------- */
const A = {
  name: '周建国', sex: '男', age: 46,
  meta: 'CML 慢性期 · e14a2 转录本 · 设备售后工程师',
  headline: '2026-01 体检发现白细胞升高确诊慢性期 CML（e14a2），伊马替尼 400mg 起步，8 月因胸腔积液换达沙替尼 50mg',
  phase: '慢性期（CP）', transcript: 'e14a2（典型）', risk: 'ELTS 中危（医生告知）',
  mindset: '最怕"停药"两个字听不懂：医生说过 MMR，但报告上到底哪一行是医生要看的，我记不住',
  dash_keys: ['pcr', 'wbc', 'plt', 'hgb'],
  path: ['e14a2', '慢性期', '伊马替尼 400mg', '达沙替尼 50mg'],
  activity: '每天早饭后吃药；每周三次快走 40 分钟，胸腔积液那阵改成散步',
  familyTalk: '和爱人说好：每次复查报告拍一张发家庭群，她负责提醒我吃药',
  /* 分子线：省血液病医院里程碑复测 + 一次外院（未 IS 标化，不可比 → 分段） */
  molecular: [
    { k: '转录本类型', v: 'e14a2（典型）', src: '血液科 2026-01-22 RT-PCR', state: 'ok', note: '典型转录本，TFR 书面前提之一' },
    { k: '染色体', v: 'Ph+（t9;22）', src: '骨髓细胞遗传学 2026-01-22', state: 'ok', note: '未见额外染色体异常（ACA）' },
    { k: 'BCR::ABL1（IS%）', v: '最近 0.086%', src: '省血液病医院 2026-10-12', state: 'ok', note: '实验室：省血液病医院（IS 标化）' },
    { k: '检测灵敏度', v: 'MR4.5（≥4.5 log）', src: '省血液病医院 2026-10-12', state: 'ok', note: '灵敏度达 MR4.5 才谈得上停药尝试' }
  ],
  lines: [
    { name: '一线 · 伊马替尼 400mg 每日', detail: '2026-01-24 起，2026-08-14 停（胸腔积液）', done: true },
    { name: '二线 · 达沙替尼 50mg 每日', detail: '2026-08-15 起（医生原话：先 50mg，看胸腔积液会不会反复）', done: false }
  ],
  /* 处方变更线（含频次） */
  rx: [
    ['2026-01-24', '伊马替尼', '400 mg', 'daily', null, '确诊后一线起始', '血液科门诊 2026-01-24', 'A-D1'],
    ['2026-05-08', '伊马替尼', '300 mg', 'daily', '2026-08-14', '医生原话：「白细胞和血小板都低了，先减到 300mg 观察」', '血液科门诊 2026-05-08', 'A-D3'],
    ['2026-08-15', '达沙替尼', '50 mg', 'daily', null, '医生原话：「胸腔积液考虑和伊马替尼无关，换达沙替尼，先用 50mg」', '血液科门诊 2026-08-15', 'A-D5']
  ],
  /* 每日服药打卡（近 6 个月摘要，逐日） */
  med_log: { drug_key: 'dasatinib', months: { '2026-05': { taken: 30, missed: 1 }, '2026-06': { taken: 28, missed: 2 }, '2026-07': { taken: 30, missed: 1 }, '2026-08': { taken: 26, missed: 5 }, '2026-09': { taken: 29, missed: 1 }, '2026-10': { taken: 11, missed: 1 } }, recent: [['2026-10-12', 'taken'], ['2026-10-11', 'taken'], ['2026-10-10', 'missed'], ['2026-10-09', 'taken'], ['2026-10-08', 'taken'], ['2026-10-07', 'taken']] },
  /* 副作用（按药归属） */
  ae: [
    ['2026-09-02', '胸腔积液 / 气促', 'dasatinib', '爬两层楼就喘，躺下更明显', '医生原话：「先停药三天复查胸片」', 'A-D6'],
    ['2026-07-20', '眼睑水肿', 'imatinib', '早上起床眼皮肿，下午好些', '自述；门诊提过，医生说常见', ''],
    ['2026-06-18', '肌肉痉挛（小腿）', 'imatinib', '夜里小腿抽筋，一周 2–3 次', '自述；医生说可以补充镁，具体听门诊', ''],
    ['2026-05-06', '白细胞偏低', 'imatinib', '化验单上白细胞 3.1，没有不舒服', '医生原话：「减量后复查」', 'A-D3']
  ],
  /* 血常规（治疗前 2 月每 1–2 周，之后每月） */
  cbc: [
    ['2026-01-22', 28.6, 168, 132, 320], ['2026-02-05', 12.4, 96, 128, 268],
    ['2026-02-19', 8.2, 62, 124, 210], ['2026-03-05', 6.4, 44, 122, 186],
    ['2026-04-02', 5.1, 32, 120, 168], ['2026-05-06', 3.1, 18, 116, 142],
    ['2026-06-04', 4.2, 24, 122, 176], ['2026-07-02', 4.6, 28, 128, 198],
    ['2026-08-06', 4.4, 26, 130, 204], ['2026-09-03', 4.8, 30, 134, 216],
    ['2026-10-12', 5.0, 32, 138, 222]
  ],
  /* qPCR（含可比性四要素）。外院那次 is_std=0 → 与主线不可比：图上断开、不跨组连线、不换算。
     这是真实排布里本来就会发生的事（出差就近复查），不是演示开关。 */
  pcr: [
    ['2026-01-22', 42.6, 'IS%', '省血液病医院', 1, 'MR4.5', '确诊基线'],
    ['2026-04-20', 8.4, 'IS%', '省血液病医院', 1, 'MR4.5', '3 个月里程碑'],
    ['2026-07-18', 1.12, 'IS%', '省血液病医院', 1, 'MR4.5', '6 个月里程碑'],
    ['2026-09-05', 0.21, 'IS%', '外院（华山医院）', 0, '未注明', '外地出差就近复查，外院未做 IS 标化'],
    ['2026-10-12', 0.086, 'IS%', '省血液病医院', 1, 'MR4.5', '12 个月里程碑']
  ],
  /* TFR 条件核对（照抄报告字段，不判定） */
  tfr: {
    status: '未开始核对（医生 2026-10-12 提过：先把 MMR 稳住）',
    must: [
      ['首次慢性期诊断', '已确认', '血液科 2026-01-22'],
      ['患者有停药意愿且沟通良好', '未确认', '—'],
      ['可靠定量方法（灵敏度至少 MR4.5）', '已确认', '省血液病医院 2026-10-12'],
      ['非典型转录本需高标准实验室', '不适用', '本例为典型 e14a2'],
      ['同意停药后接受更频繁监测', '未确认', '—']
    ],
    min: [
      ['一线治疗或敏感突变换二线', '已确认', '一线伊马替尼→不耐受换达沙替尼'],
      ['典型 e13a2/e14a2 转录本', '已确认', '2026-01-22 RT-PCR'],
      ['TKI 治疗 > 5 年（二代 > 4 年）', '未抄录', '截至 2026-10 已用药 9 个月（本仓只抄时长，不判是否够）'],
      ['DMR（MR4.0 或更好）持续 > 2 年', '未抄录', '最近 IS 0.086%（报告值，本仓不换算是否达某档）'],
      ['最佳：MR4.5 持续 > 2 年', '未抄录', '—']
    ],
    monitor: [['停药后前 6 个月', '每 1–2 个月 1 次分子学监测', '未开始'], ['第 7–12 个月', '每 2 个月 1 次', '未开始'], ['之后（无限期）', '保持 MMR 者每 3 个月 1 次', '未开始']]
  },
  /* 费用（按月，不跨药混算） */
  cost: [
    ['2026-05', '伊马替尼', 300, 1, '门特报销后自付', ''],
    ['2026-06', '伊马替尼', 300, 1, '门特报销后自付', ''],
    ['2026-07', '伊马替尼', 300, 1, '门特报销后自付', ''],
    ['2026-08', '伊马替尼', 150, 1, '半个月用量', ''],
    ['2026-08', '达沙替尼', 1240, 1, '换药首月，门特登记办理中（自费）', ''],
    ['2026-09', '达沙替尼', 620, 1, '门特登记通过后自付', ''],
    ['2026-10', '达沙替尼', 620, 1, '同前', '']
  ],
  fertility: [
    ['生育计划', '无再生育计划', '本人自述 2026-02'],
    ['医生谈过什么', '「TKI 期间不建议计划妊娠；男性方面现有资料显示对生育能力没有显著影响，但经验有限」', '血液科门诊 2026-02-20（原话）'],
    ['下次可以问什么', '长期服药对身体的其它影响、能不能减量，我要怎么问才说清楚', '本人记录']
  ],
  rhythm: [
    ['血液科门诊', '每 3 个月', '医生安排', '2027-01 上旬'],
    ['BCR::ABL1 qPCR', '每 3 个月（12 个月里程碑后）', '医生安排', '2027-01 中旬'],
    ['血常规', '每月 1 次（血象稳定后）', '医生安排', '2026-11 上旬']
  ],
  events: [
    ['2026-01-22', '确诊（Ph+ / BCR::ABL1 e14a2）'],
    ['2026-01-24', '开始伊马替尼 400mg'],
    ['2026-04-20', '3 个月里程碑 qPCR'],
    ['2026-05-08', '因血象减量至 300mg'],
    ['2026-07-18', '6 个月里程碑 qPCR'],
    ['2026-08-15', '换达沙替尼 50mg（胸腔积液）'],
    ['2026-10-12', '12 个月随访 qPCR']
  ],
  viewpoints: [
    ['2026-03-10', '有点烦', '每天吃药像闹钟，出差要算时差'],
    ['2026-08-20', '吓了一跳', '喘不上气那两天以为心脏出问题，结果是胸腔积液'],
    ['2026-10-12', '还行', '医生说数值在往下走，我先把这三个月过好']
  ],
  docs: [
    ['A-D1', '血常规 + 骨髓报告 2026-01-22.pdf', '2026-01-22', '化验单', '已解析'],
    ['A-D2', 'BCR-ABL1 定量报告 2026-01-22.pdf', '2026-01-22', '分子报告', '已解析'],
    ['A-D3', '血常规 2026-05-06.pdf', '2026-05-06', '化验单', '已解析'],
    ['A-D4', 'BCR-ABL1 定量报告 2026-10-12.pdf', '2026-10-12', '分子报告', '待核对'],
    ['A-D5', '门诊病历 2026-08-15.pdf', '2026-08-15', '门诊记录', '已入库'],
    ['A-D6', '胸部 CT 报告 2026-09-02.pdf', '2026-09-02', '影像报告', '已解析']
  ],
  candidates: [
    ['A-C1', 'BCR::ABL1', '0.086', 'BCR-ABL1 定量报告 2026-10-12', '待确认'],
    ['A-C2', '白细胞', '5.0', '血常规 2026-10-12', '待确认'],
    ['A-C3', '体重', '74.2', '门诊记录 2026-10-12', '已接受']
  ],
  /* 入组档案会用到的既有字段（全部来自已有报告/门诊记录，不重复录入）。
     故意留两个缺口（ECOG、QTc）来演示"缺失永远流向无法判定"。 */
  liverFn: 'ALT 23 U/L · 总胆红素 14.2 μmol/L（2026-10-12 生化，均在参考范围内）',
  renalFn: '肌酐 78 μmol/L · eGFR 96 mL/min（2026-10-12 生化）',
  lipase: '脂肪酶 42 U/L（参考 ≤60，2026-10-12 生化）',
  comorbid: ['胸腔积液（2026-09，达沙替尼相关，已停药复查）'],
  pregnancy: '不适用（男性）'
};

/* ---------- 档案 B：31 岁女性，e13a2 · 尼洛替尼 → TFR 停药尝试（家属代记主体） ---------- */
const B = {
  name: '林雨桐（家属代记：母亲）', sex: '女', age: 31,
  meta: 'CML 慢性期 · e13a2 转录本 · 小学教师 · 由母亲代记',
  headline: '2020-03 确诊慢性期 CML（e13a2），伊马替尼→尼洛替尼，2026-04 起进入 TFR 停药尝试并密测',
  phase: '慢性期（CP）', transcript: 'e13a2（典型）', risk: 'ELTS 低危（医生告知）',
  mindset: '停药后每 1–2 个月抽一次血，等报告那几天最难受；妈妈把每次报告都拍下来存着',
  dash_keys: ['pcr', 'wbc', 'hgb', 'crp'],
  path: ['e13a2', '慢性期', '尼洛替尼 300mg', 'TFR 停药尝试'],
  activity: '每天早晚各一次（尼洛替尼需空腹）；停药后散步、瑜伽，避免熬夜',
  familyTalk: '妈妈说：报告我先拍，等她愿意谈了再一起看；不催她',
  molecular: [
    { k: '转录本类型', v: 'e13a2（典型）', src: '血液科 2020-03-11 RT-PCR', state: 'ok', note: '典型转录本' },
    { k: '染色体', v: 'Ph+（t9;22）', src: '骨髓细胞遗传学 2020-03-11', state: 'ok', note: '未见 ACA' },
    { k: 'BCR::ABL1（IS%）', v: '最近 0.0021%', src: '市一院血液科 2026-10-08', state: 'ok', note: '实验室：市一院（IS 标化）' },
    { k: '检测灵敏度', v: 'MR4.5（≥4.5 log）', src: '市一院血液科 2026-10-08', state: 'ok', note: '满足停药监测的书面要求' }
  ],
  lines: [
    { name: '一线 · 伊马替尼 400mg 每日', detail: '2020-03-15 → 2021-06-30（皮疹、腹泻）', done: true },
    { name: '二线 · 尼洛替尼 300mg 每日两次', detail: '2021-07-01 → 2026-04-09', done: true },
    { name: 'TFR · 停药尝试（密测中）', detail: '2026-04-10 停药；前 6 个月每 1–2 个月 qPCR', done: false }
  ],
  rx: [
    ['2020-03-15', '伊马替尼', '400 mg', 'daily', '2021-06-30', '一线起始', '血液科门诊 2020-03-15', 'B-D1'],
    ['2021-07-01', '尼洛替尼', '300 mg', 'bid', '2026-04-09', '医生原话：「伊马替尼皮疹腹泻不耐受，换尼洛替尼，空腹早晚各一次」', '血液科门诊 2021-06-30', 'B-D2'],
    ['2026-04-10', '（停药观察）', '—', 'none', null, '医生原话：「DMR 超过 2 年、TKI 用了 6 年，达到书面条件，可以谈停药；停药后前半年每 1–2 个月抽一次」', '血液科门诊 2026-04-09', 'B-D5']
  ],
  med_log: { drug_key: 'none', months: { '2026-05': { taken: 0, missed: 0 }, '2026-06': { taken: 0, missed: 0 }, '2026-07': { taken: 0, missed: 0 }, '2026-08': { taken: 0, missed: 0 }, '2026-09': { taken: 0, missed: 0 }, '2026-10': { taken: 0, missed: 0 } }, recent: [['2026-10-12', 'na'], ['2026-10-11', 'na'], ['2026-10-10', 'na']], note: '停药中（TFR）：无每日服药打卡' },
  ae: [
    ['2026-05-02', '肌肉骨骼疼痛', 'withdrawal', '停药后腰背和膝盖酸，早上明显', '医生原话：「停药综合征，多数几个月会缓解；影响生活可以来门诊」', ''],
    ['2026-06-11', '皮肤瘙痒', 'withdrawal', '晚上痒，抓了会起红印', '自述；门诊提过', ''],
    ['2025-11-20', '肝功能异常（ALT 升高）', 'nilotinib', 'ALT 62，没有不舒服', '医生原话：「尼洛替尼可能影响肝酶，加查一次」', 'B-D4'],
    ['2021-05-08', '皮疹 / 腹泻', 'imatinib', '前臂皮疹，大便每天 3–4 次', '医生原话：「先减量，仍不耐受就换药」', 'B-D2']
  ],
  cbc: [
    ['2026-04-09', 5.6, 34, 132, 228], ['2026-05-08', 5.8, 36, 134, 232],
    ['2026-06-05', 5.4, 33, 130, 226], ['2026-07-06', 5.2, 32, 128, 220],
    ['2026-08-07', 5.0, 30, 126, 214], ['2026-09-04', 4.9, 29, 125, 212],
    ['2026-10-08', 4.8, 28, 124, 210]
  ],
  pcr: [
    ['2026-04-09', 0.0028, 'IS%', '市一院血液科', 1, 'MR4.5', '停药前最后 1 次'],
    ['2026-05-08', 0.0031, 'IS%', '市一院血液科', 1, 'MR4.5', '停药后 1 个月'],
    ['2026-06-05', 0.0024, 'IS%', '市一院血液科', 1, 'MR4.5', '停药后 2 个月'],
    ['2026-07-06', 0.0028, 'IS%', '市一院血液科', 1, 'MR4.5', '停药后 3 个月'],
    ['2026-08-07', 0.0030, 'IS%', '市一院血液科', 1, 'MR4.5', '停药后 4 个月'],
    ['2026-09-04', 0.0019, 'IS%', '市一院血液科', 1, 'MR4.5', '停药后 5 个月'],
    ['2026-10-08', 0.0021, 'IS%', '市一院血液科', 1, 'MR4.5', '停药后 6 个月']
  ],
  tfr: {
    status: '停药尝试中（2026-04-10 起，密测第 7 个月）',
    must: [
      ['首次慢性期诊断', '已确认', '血液科 2020-03-11'],
      ['患者有停药意愿且沟通良好', '已确认', '门诊沟通 2026-04-09'],
      ['可靠定量方法（灵敏度至少 MR4.5）', '已确认', '市一院 2026-10-08'],
      ['非典型转录本需高标准实验室', '不适用', '典型 e13a2'],
      ['同意停药后接受更频繁监测', '已确认', '门诊沟通 2026-04-09']
    ],
    min: [
      ['一线治疗或敏感突变换二线', '已确认', '一线不耐受换二线尼洛替尼'],
      ['典型 e13a2/e14a2 转录本', '已确认', '2020-03-11 RT-PCR'],
      ['TKI 治疗 > 5 年（二代 > 4 年）', '已确认', '2020-03-15 → 2026-04-09（约 6 年）'],
      ['DMR（MR4.0 或更好）持续 > 2 年', '已确认', '门诊记录 2026-04-09'],
      ['最佳：MR4.5 持续 > 2 年', '已确认', '门诊记录 2026-04-09']
    ],
    monitor: [['停药后前 6 个月', '每 1–2 个月 1 次分子学监测', '已完成 6 次（2026-05 → 2026-10）'], ['第 7–12 个月', '每 2 个月 1 次', '进行中（下次 2026-12 上旬）'], ['之后（无限期）', '保持 MMR 者每 3 个月 1 次', '未开始']]
  },
  cost: [
    ['2026-01', '尼洛替尼', 480, 1, '门特报销后自付', ''],
    ['2026-02', '尼洛替尼', 480, 1, '门特报销后自付', ''],
    ['2026-03', '尼洛替尼', 480, 1, '门特报销后自付', ''],
    ['2026-04', '尼洛替尼', 160, 1, '停药前半个月用量', ''],
    ['2026-05', '（停药）', 0, 0, '无药费；qPCR 每次自付', '单项 260 元'],
    ['2026-06', '（停药）', 260, 1, 'qPCR 自付', '停药期以监测为主']
  ],
  fertility: [
    ['生育意愿', '有生育计划（未定时间）', '本人自述 2026-04'],
    ['医生谈过什么', '「TKI 期间不建议计划妊娠；要备孕得先和血液科一起定方案，不能自己停」', '血液科门诊 2026-04-09（原话）'],
    ['下次可以问什么', '如果要备孕，需要提前多久开始准备、由哪几科一起看；停药期间万一数值动了怎么办', '母子共同记录 2026-10']
  ],
  rhythm: [
    ['血液科门诊 + qPCR', '停药第 7–12 个月：每 2 个月', '医生安排', '2026-12 上旬'],
    ['血常规', '每次门诊同时', '医生安排', '2026-12 上旬'],
    ['若丧失 MMR', '尽快恢复 TKI 并每月监测（由医生决定）', '指南书面口径', '—']
  ],
  events: [
    ['2020-03-11', '确诊（Ph+ / BCR::ABL1 e13a2）'],
    ['2020-03-15', '开始伊马替尼'],
    ['2021-07-01', '换尼洛替尼（不耐受）'],
    ['2026-04-09', '达到 TFR 书面条件（医生评估）'],
    ['2026-04-10', '停药，进入密测'],
    ['2026-10-08', '停药后第 6 个月 qPCR']
  ],
  viewpoints: [
    ['2026-05-20', '紧张', '停药第一周总觉得自己会复发，半夜会醒'],
    ['2026-07-15', '好一点', '两次报告都稳定，妈妈也不天天问了'],
    ['2026-10-08', '还行', '就是等报告那三天难熬']
  ],
  docs: [
    ['B-D1', '骨髓 + 融合基因报告 2020-03-11.pdf', '2020-03-11', '分子报告', '已解析'],
    ['B-D2', '门诊病历 2021-06-30（换药）.pdf', '2021-06-30', '门诊记录', '已入库'],
    ['B-D3', 'BCR-ABL1 定量报告 2026-10-08.pdf', '2026-10-08', '分子报告', '待核对'],
    ['B-D4', '肝功能 2025-11-20.pdf', '2025-11-20', '化验单', '已解析'],
    ['B-D5', 'TFR 评估门诊记录 2026-04-09.pdf', '2026-04-09', '门诊记录', '已入库'],
    ['B-D6', '血常规 2026-10-08.jpg', '2026-10-08', '化验单', '待核对']
  ],
  candidates: [
    ['B-C1', 'BCR::ABL1', '0.0021', 'BCR-ABL1 定量报告 2026-10-08', '待确认'],
    ['B-C2', '白细胞', '4.8', '血常规 2026-10-08', '待确认'],
    ['B-C3', '体重', '52.4', '门诊记录 2026-10-08', '已接受']
  ],
  /* 同 A：只用已有报告里的字段。B 档案缺 ECOG / QTc / 脂肪酶 → 演示"无法判定" */
  liverFn: 'ALT 62 U/L（2025-11-20，高于参考上限）· 总胆红素 11.0 μmol/L（正常）',
  renalFn: '肌酐 61 μmol/L · eGFR 102 mL/min（2026-10-08 生化）',
  comorbid: ['肝功能异常（ALT 升高，2025-11 尼洛替尼期间）'],
  pregnancy: '未孕（2026-10 自述；TKI 已停）'
};


/* ---------- 临床研究：入组档案 + 规则库 + 三档求值（MATCHING-SPEC §2/§3/§4） ----------
   铁律（改前必读）：
   1. 缺失永远流向「无法判定」，绝不流向「已满足」。
   2. 求值是确定性规则求值：同档案 + 同规则版本 = 同结果，不调用模型。
   3. 不输出匹配度百分比、不排序推荐。唯一的"指数"是**入组档案完整度 x/y**。
   4. 未确认规则（pending）不进三档，单列一档。
   5. CML 与实体瘤不同：入组条件看的是**分期 / 转录本类型 / 突变 / 既往 TKI 线数 / 器官功能**，
      **不做 IHC 标志物筛选**（IHC 是实体瘤的分型工具）。本文件不把 IHC 塞进 CML 目录。
*/

/* 入组档案字段清单：全部来自既有病情数据（不重复录入）。present=false 表示本档案没有该记录。 */
function enrollmentProfile(p, tag) {
  const has = (v) => v !== undefined && v !== null && v !== '' && v !== 'unknown';
  const mutation = (p.molecular || []).filter((m) => /突变|激酶区|T315I/.test(String(m.k)))[0];
  const transcript = (p.molecular || []).filter((m) => /转录本/.test(String(m.k)))[0];
  const dxDate = p.meta ? (String(p.meta).match(/2026-\d\d|2021-\d\d|20\d\d-\d\d/) || [])[0] : null;
  const fields = [
    { k: '年龄',        g: '基本',   v: has(p.age) ? p.age + ' 岁' : null },
    { k: '性别',        g: '基本',   v: has(p.sex) ? p.sex : null },
    { k: '病种与分期',  g: '基本',   v: has(p.phase) ? p.phase : null },
    { k: '确诊日期',    g: '基本',   v: dxDate || null },
    { k: 'BCR::ABL1 转录本类型', g: '基因分子', v: transcript ? String(transcript.v) : null },
    { k: '激酶区突变',  g: '基因分子', v: mutation ? String(mutation.v) : null },
    { k: '检测方法与标本', g: '基因分子', v: transcript && transcript.note ? String(transcript.note) : null },
    { k: '基因检测报告日期', g: '基因分子', v: (p.docs || []).filter((d) => /基因|融合|定量/.test(String(d[3]) + String(d[1]))).map((d) => d[2])[0] || null },
    { k: '细胞遗传学（Ph 染色体 / 附加异常）', g: '病理', v: (p.molecular || []).filter((m) => /染色体/.test(String(m.k))).map((m) => String(m.v))[0] || null },
    { k: '既往 TKI 线数', g: '治疗史', v: (() => {
        const drugs = Array.from(new Set((p.rx || []).map((r) => r[1])
          .filter((d) => d && d !== '停药' && !/^[（(]/.test(String(d)))));
        return drugs.length ? drugs.length + ' 线（' + drugs.join(' → ') + '）' : null;
      })() },
    { k: '当前用药与剂量', g: '治疗史', v: (() => {
        const cur = (p.rx || []).filter((r) => !r[4])[0];
        return cur ? cur[1] + ' ' + cur[2] + ' ' + cur[3] : null;
      })() },
    { k: 'ECOG 体能评分', g: '体能', v: p.ecog || null },
    { k: '肝功能（ALT / 总胆红素）', g: '器官功能', v: p.liverFn || null },
    { k: '脂肪酶 / 淀粉酶', g: '器官功能', v: p.lipase || null },
    { k: '肾功能（肌酐 / eGFR）', g: '器官功能', v: p.renalFn || null },
    { k: '心电图 QTc', g: '器官功能', v: p.qtc || null },
    { k: '妊娠状态', g: '其他', v: p.pregnancy || null },
    { k: '主要并发症', g: '其他', v: (p.comorbid || []).length ? p.comorbid.join(' · ') : null }
  ];
  return fields.map((f) => Object.assign({ tag }, f, { present: has(f.v) }));
}

/* 三档求值：确定性。missing → undetermined（铁律），never satisfied。 */
function evalRule(rule, prof) {
  const get = (k) => (prof.filter((f) => f.k === k && f.present)[0] || {}).v;
  const tier = (v) => {
    if (v === undefined || v === null || v === '') return 'undetermined';
    return rule.test(v) ? 'satisfied' : 'conflict';
  };
  const v = get(rule.field);
  return { text: rule.text, field: rule.field, tier: tier(v), mine: v == null ? '（本档案无此记录）' : String(v), src: rule.src };
}

/* 规则库：每条 = 原文 + 结构化条件 + 确认状态。演示条目标 confirmed 的才进三档。 */
function matchRulesFor(tag) {
  const R = (id, text, field, test, src, st) => ({ id, text, field, test, src, status: st || 'confirmed' });
  return [
    R('r-age',   '年龄 ≥18 岁',                          '年龄', (v) => parseInt(v, 10) >= 18, '入选标准 1'),
    R('r-phase', '慢性期（或加速期，见原文分项）',        '病种与分期', (v) => /慢性期|加速期/.test(v), '入选标准 2'),
    R('r-tr',    'Ph 染色体阳性 / BCR::ABL1 阳性',        '细胞遗传学（Ph 染色体 / 附加异常）', (v) => /Ph|阳性|t\(9;22\)/i.test(v), '入选标准 3'),
    R('r-tx',    '既往 TKI 治疗线数 ≤2',                  '既往 TKI 线数', (v) => parseInt(v, 10) <= 2, '入选标准 4'),
    R('r-ecog',  'ECOG 0–1',                              'ECOG 体能评分', (v) => /^[01]/.test(String(v)), '入选标准 5'),
    /* 无临床意义的判定不给模型猜：原文同时出现"高于/超出"就是冲突；出现"参考范围/正常"且无"高于"才算满足 */
    R('r-liver', 'ALT 与总胆红素在正常上限内',            '肝功能（ALT / 总胆红素）',
      (v) => !/高于|超出|异常|↑/.test(v) && /参考范围|正常|≤/.test(v), '入选标准 6'),
    R('r-lip',   '脂肪酶 ≤1.5×ULN',                       '脂肪酶 / 淀粉酶',
      (v) => !/高于|超出/.test(v) && /≤|正常|参考/.test(v), '入选标准 7'),
    R('r-qtc',   'QTc <450ms（男）/ <470ms（女）',        '心电图 QTc', (v) => parseFloat(v) < 450, '入选标准 8'),
    R('r-preg',  '非妊娠期（女性受试者）',                '妊娠状态', (v) => /未孕|非妊娠|不适用/.test(v), '排除标准 3'),
    R('r-t315i', '排除已知 T315I 突变',                   '激酶区突变', (v) => !/T315I/i.test(v), '排除标准 4'),
    /* 未确认：结构化不了的原文，保留原文并单列，不进三档 */
    R('r-other', '试验期间需采取有效避孕措施（原文未结构化）', '妊娠状态', () => true, '排除标准 5', 'pending')
  ];
}


/* ---------- 指标类别目录（唯一来源） ----------
   24 号 §：类别标题、顺序、项目归属只在这里定义；指标趋势页与一图秀的选择目录共用同一份，
   页面里不做第二处排序或分组。颜色只标类别身份，不用红绿表示好坏。 */
const CATEGORY_ORDER = [
  { cat: '分子学', label: '分子学反应（BCR::ABL1）', color: '#2f6f66',
    note: '只看可比序列：换实验室/换单位会拆成不同可比组，不跨组连线、不自行换算。' },
  { cat: '血象', label: '血象（血常规）', color: '#4a6fa5',
    note: '同一台机器、同一单位才算同一可比组。' },
  { cat: '副作用', label: '副作用（按药归属）', color: '#8a5a1f',
    note: '分级/定性记录不进数值曲线，只在时间线里出现。' },
  { cat: '费用', label: '费用（月自付）', color: '#6b5b95',
    note: '按实际支付记录；医保结算滞后时以到账为准并标注。' }
];

/* ---------- 指标定义（分类值 kind 不进趋势） ---------- */
function metricsOf(p, key) {
  const pcrPts = p.pcr.map(([d, v, unit, lab, isStd, sens, src]) => ({ d, v, src, lab, is_std: isStd, unit, sens }));
  const cbcPts = (i, name) => p.cbc.map((r) => ({ d: r[0], v: r[i], src: '血常规' }));
  const m = [
    { key: 'pcr', name: 'BCR::ABL1（IS%）', unit: 'IS%', dec: 3, kind: 'num', band: null, cat: '分子学', color: '#2f6f66',
      note: '数值只抄报告原文；不同实验室/未 IS 标化不可直接连成一条线（趋势页会分段）', points: pcrPts },
    { key: 'wbc', name: '白细胞', unit: '10⁹/L', dec: 1, kind: 'num', band: [3.5, 9.5], cat: '血象', color: '#c2687f', note: '不同医院参考区间不合并', points: cbcPts(1) },
    { key: 'anc', name: '中性粒细胞', unit: '10⁹/L', dec: 2, kind: 'num', band: [1.8, 6.3], cat: '血象', color: '#8f2d4a', note: '治疗前 2 个月每 1–2 周监测', points: cbcPts(2) },
    { key: 'hgb', name: '血红蛋白', unit: 'g/L', dec: 0, kind: 'num', band: [115, 150], cat: '血象', color: '#a03d5c', note: '—', points: cbcPts(3) },
    { key: 'plt', name: '血小板', unit: '10⁹/L', dec: 0, kind: 'num', band: [125, 350], cat: '血象', color: '#b3556e', note: '—', points: cbcPts(4) },
    { key: 'ae', name: '副作用记录', dec: null, kind: 'qual', band: null, cat: '副作用', color: '#a85724',
      note: '按当前用药归属；只记录不适，不分级判读', points: p.ae.map(([d, term, drug]) => ({ d, v: term, src: drug === 'withdrawal' ? '停药后' : drug })) },
    { key: 'cost', name: '月自费金额', unit: '元', dec: 0, kind: 'num', band: null, cat: '费用', color: '#6a55b8',
      note: '按月聚合；不跨药混算', points: p.cost.map(([m2, drug, amt]) => ({ d: m2 + '-01', v: amt, src: drug })) }
  ];
  return { key, metrics: m };
}

/* ---------- SQLite 落库（显式列名；供 M5 开发版复用同一份纯数据） ---------- */
function buildDemoProfiles() {
  return { profiles: { A, B }, trials: [] };
}

function toSqlite(db, p, tag) {
  db.exec(`CREATE TABLE IF NOT EXISTS demo_profile (tag TEXT, name TEXT, phase TEXT, transcript TEXT, headline TEXT)`);
  db.prepare(`INSERT INTO demo_profile (tag,name,phase,transcript,headline) VALUES (?,?,?,?,?)`).run(tag, p.name, p.phase, p.transcript, p.headline);
  db.exec(`CREATE TABLE IF NOT EXISTS demo_mol (tag TEXT, draw_date TEXT, value REAL, unit TEXT, lab TEXT, is_standardized INTEGER, sensitivity TEXT, note TEXT)`);
  const insMol = db.prepare(`INSERT INTO demo_mol (tag,draw_date,value,unit,lab,is_standardized,sensitivity,note) VALUES (?,?,?,?,?,?,?,?)`);
  for (const r of p.pcr) insMol.run(tag, r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
  db.exec(`CREATE TABLE IF NOT EXISTS demo_rx (tag TEXT, start_date TEXT, drug TEXT, dose TEXT, frequency TEXT, end_date TEXT, reason TEXT, source TEXT, doc_id TEXT)`);
  const insRx = db.prepare(`INSERT INTO demo_rx (tag,start_date,drug,dose,frequency,end_date,reason,source,doc_id) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const r of p.rx) insRx.run(tag, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
  db.exec(`CREATE TABLE IF NOT EXISTS demo_ae (tag TEXT, onset_date TEXT, term TEXT, drug TEXT, note TEXT, action TEXT, doc_id TEXT)`);
  const insAe = db.prepare(`INSERT INTO demo_ae (tag,onset_date,term,drug,note,action,doc_id) VALUES (?,?,?,?,?,?,?)`);
  for (const r of p.ae) insAe.run(tag, r[0], r[1], r[2], r[3], r[4], r[5]);
  db.exec(`CREATE TABLE IF NOT EXISTS demo_cost (tag TEXT, month TEXT, drug TEXT, amount REAL, self_pay INTEGER, tag_note TEXT, note TEXT)`);
  const insCost = db.prepare(`INSERT INTO demo_cost (tag,month,drug,amount,self_pay,tag_note,note) VALUES (?,?,?,?,?,?,?)`);
  for (const r of p.cost) insCost.run(tag, r[0], r[1], r[2], r[3], r[4], r[5]);
}

function main() {
  const data = buildDemoProfiles();
  /* 2026-10-25：本函数头注释一直声称产出 demo/demo-data.sqlite（"可 SQL 查询"），
     但实现只写了 demo-data.js 与 demo-summary.json —— 声明与实现矛盾，且用户点名要"自带 sqlitedb"。
     现改为真正落盘：先删旧文件（避免重复运行时 INSERT 叠行），再建文件库。 */
  const SQLITE = join(ROOT, 'demo/demo-data.sqlite');
  try { unlinkSync(SQLITE); } catch { /* 首次运行没有旧文件 */ }
  const db = new DatabaseSync(SQLITE);
  toSqlite(db, A, 'A');
  toSqlite(db, B, 'B');
  const counts = {
    mol: db.prepare('SELECT COUNT(*) c FROM demo_mol').get().c,
    rx: db.prepare('SELECT COUNT(*) c FROM demo_rx').get().c,
    ae: db.prepare('SELECT COUNT(*) c FROM demo_ae').get().c,
    cost: db.prepare('SELECT COUNT(*) c FROM demo_cost').get().c
  };
  /* 唯一源断言：qPCR 行数 = 两档案 pcr 之和；四要素齐备 */
  const missing = db.prepare(`SELECT COUNT(*) c FROM demo_mol WHERE unit IS NULL OR lab IS NULL OR is_standardized IS NULL OR sensitivity IS NULL`).get().c;
  if (counts.mol !== A.pcr.length + B.pcr.length) throw new Error('mol 行数与源数据不符');
  if (missing !== 0) throw new Error(`qPCR 可比性四要素缺失 ${missing} 行`);
  mkdirSync(join(ROOT, 'demo'), { recursive: true });
  mkdirSync(P2, { recursive: true });
  /* 临床研究：入组档案 + 三档求值（确定性，在此算完；原型只读结果，不自己判） */
  const enroll = { A: enrollmentProfile(A, 'A'), B: enrollmentProfile(B, 'B') };
  const assess = {};
  ['A', 'B'].forEach((tag) => {
    const rules = matchRulesFor(tag);
    const confirmed = rules.filter((r) => r.status === 'confirmed');
    const pending = rules.filter((r) => r.status !== 'confirmed');
    const judged = confirmed.map((r) => Object.assign({ id: r.id, status: r.status }, evalRule(r, enroll[tag])));
    assess[tag] = {
      profileRevision: 'demo-v0.2',
      ruleSetVersion: 'cml-rules-2026.10-1',
      generatedAt: '2026-10-25',
      done: judged.filter((j) => j.tier === 'satisfied').length,
      conflict: judged.filter((j) => j.tier === 'conflict').length,
      undetermined: judged.filter((j) => j.tier === 'undetermined').length,
      pending: pending.map((r) => ({ id: r.id, text: r.text, src: r.src })),
      judgments: judged
    };
  });

  /* 试验目录：**演示虚构**，不是真实登记信息，M4 接 unified-trial-mcp 后整体替换。
     保留渠道状态字段以演示"未就绪 ≠ 没有试验"。 */
  const trials = [
    { id: 'DEMO-CML-TFR-01', title: '【演示虚构】TKI 停药后分子学复发监测路径研究', phase: 'II 期', status: '招募中（演示）', sponsor: '（演示）某血液病中心', note: '针对已达到深度分子学反应、拟尝试停药的患者，研究停药后监测频率。', lastCheck: '2026-10-25', channel: 'demo' },
    { id: 'DEMO-CML-T315I-01', title: '【演示虚构】T315I 突变阳性患者的第三代 TKI 用药研究', phase: 'I/II 期', status: '招募中（演示）', sponsor: '（演示）某三甲医院血液科', note: '入组条件涉及激酶区突变类型。', lastCheck: '2026-10-25', channel: 'demo' },
    { id: 'DEMO-CML-2L-01', title: '【演示虚构】二线 TKI 换药后的疗效与安全性观察', phase: 'IV 期', status: '尚未招募（演示）', sponsor: '（演示）某省血液病医院', note: '入组条件涉及既往 TKI 治疗线数。', lastCheck: '2026-10-25', channel: 'demo' },
    { id: 'DEMO-CML-QOL-01', title: '【演示虚构】长期服用 TKI 患者的生活质量随访', phase: '观察性', status: '招募中（演示）', sponsor: '（演示）某患者组织合作项目', note: '不涉及用药调整。', lastCheck: '2026-10-25', channel: 'demo' }
  ];

  /* ---------- 入组档案 / 三档判定 / 试验目录 落库 ---------- */
  db.exec(`CREATE TABLE IF NOT EXISTS demo_enrollment (tag TEXT, grp TEXT, field TEXT, value TEXT, present INTEGER)`);
  const insEnroll = db.prepare(`INSERT INTO demo_enrollment (tag,grp,field,value,present) VALUES (?,?,?,?,?)`);
  /* enroll[tag] 是扁平数组：[{k, g, v, present}]，不是分组结构 */
  ['A', 'B'].forEach((tag) => {
    for (const f of enroll[tag]) insEnroll.run(tag, f.g, f.k, String(f.v == null ? '' : f.v), f.present ? 1 : 0);
  });

  db.exec(`CREATE TABLE IF NOT EXISTS demo_match_judgment (tag TEXT, rule_id TEXT, rule_text TEXT, field TEXT, tier TEXT, mine TEXT, src TEXT)`);
  const insJudge = db.prepare(`INSERT INTO demo_match_judgment (tag,rule_id,rule_text,field,tier,mine,src) VALUES (?,?,?,?,?,?,?)`);
  ['A', 'B'].forEach((tag) => {
    for (const j of assess[tag].judgments) insJudge.run(tag, j.id, j.text, j.field, j.tier, j.mine, j.src);
  });

  db.exec(`CREATE TABLE IF NOT EXISTS demo_trial (id TEXT, title TEXT, phase TEXT, status TEXT, sponsor TEXT, note TEXT, last_check TEXT, channel TEXT)`);
  const insTrial = db.prepare(`INSERT INTO demo_trial (id,title,phase,status,sponsor,note,last_check,channel) VALUES (?,?,?,?,?,?,?,?)`);
  for (const t of trials) insTrial.run(t.id, t.title, t.phase, t.status, t.sponsor, t.note, t.lastCheck, t.channel);

  /* 落库自检：三张新表行数必须与内存数据一致，否则数据层与库不同源 */
  const enrollRows = db.prepare('SELECT COUNT(*) c FROM demo_enrollment').get().c;
  const enrollExpect = enroll.A.length + enroll.B.length;
  if (enrollRows !== enrollExpect) throw new Error(`demo_enrollment 行数 ${enrollRows} ≠ 源数据 ${enrollExpect}`);
  const judgeRows = db.prepare('SELECT COUNT(*) c FROM demo_match_judgment').get().c;
  const judgeExpect = assess.A.judgments.length + assess.B.judgments.length;
  if (judgeRows !== judgeExpect) throw new Error(`demo_match_judgment 行数 ${judgeRows} ≠ 源数据 ${judgeExpect}`);
  const trialRows = db.prepare('SELECT COUNT(*) c FROM demo_trial').get().c;
  if (trialRows !== trials.length) throw new Error(`demo_trial 行数 ${trialRows} ≠ 源数据 ${trials.length}`);
  db.close();

  const js = `/* 由 demo/build-demo-data.mjs 生成；勿手改，改数据请改生成器后重新运行。 */\nwindow.DEMO_DATA = ${JSON.stringify({ profiles: { A, B }, metrics: { A: metricsOf(A, 'A').metrics, B: metricsOf(B, 'B').metrics }, enrollment: enroll, match: assess, trials: trials, categoryOrder: CATEGORY_ORDER })};\n`;
  writeFileSync(join(P2, 'demo-data.js'), js);
  writeFileSync(join(ROOT, 'demo/demo-summary.json'), JSON.stringify({ counts, profiles: ['A', 'B'], generated_by: 'demo/build-demo-data.mjs' }, null, 2));
  console.log(JSON.stringify({ ok: true, counts, js_bytes: js.length,
    sqlite_bytes: statSync(SQLITE).size,
    sqlite_tables: ['demo_profile', 'demo_mol', 'demo_rx', 'demo_ae', 'demo_cost', 'demo_enrollment', 'demo_match_judgment', 'demo_trial'] }, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith('build-demo-data.mjs')) main();
export { buildDemoProfiles };
