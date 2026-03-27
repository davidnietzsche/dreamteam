# Elon 10k 内容库路线图

## 当前判断

要做出真正像样的 Elon 顾问，`12` 条种子来源远远不够。

但要到 `10,000` 条内容，不能靠手工整理，必须分层建库。

## 最现实的 10k 拆法

### 1. 官方页面与公告层

- Tesla
- Tesla IR
- SpaceX
- xAI
- Neuralink
- The Boring Company

这一层数量不会到 10k，但它决定人格主轴，优先级最高。

### 2. 视频与演讲层

- TED
- Tesla YouTube
- SpaceX YouTube
- xAI/Grok 相关公开视频
- 采访、发布会、股东会、工程更新

这一层适合做：

- 时间线
- 观点切片
- 口径变化追踪

### 3. 社交媒体层

- X / Twitter posts
- replies
- quote posts
- long threads

这一层最容易把规模推到数千条，但也是版权、接口和抓取稳定性最复杂的一层。

### 4. Podcast / interview transcript 层

- Lex Fridman
- TED interview transcripts
- conference interviews
- mainstream media interviews

### 5. Rise and Fall 时间线层

这层不是“原始内容”，但很关键：

- Zip2 / PayPal 早期
- Tesla 量产地狱
- SpaceX Falcon 爆炸和复盘
- SolarCity / Twitter / xAI 争议阶段
- compensation / governance / legal 节点

这样顾问才不会只学“成功叙事”，而会学到风险、冲突、判断失误和风格代价。

## 为什么我不会假装已经有 10k

因为这几类并不等价：

- “链接数量”不等于“可用知识”
- “社交帖子数”不等于“高价值训练样本数”
- “全网转录”往往存在版权和质量问题

所以正确做法是：

1. 先搭 ingestion system
2. 再做分层抓取
3. 再做去重、切片、打标
4. 最后才进入顾问记忆层

## 这次已经开始落地的东西

- 统一来源面清单
- 自动抓取脚本
- corpus 输出目录
- summary 统计文件

## 还缺的关键能力

- X / Twitter 导入器
- transcript chunker
- event timeline builder
- semantic tagging
- benchmark generation
