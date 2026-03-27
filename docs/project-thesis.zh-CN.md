# Advisor Foundry 项目主张

## 1. 这个项目真正要做什么

这个项目不是做一个“像伊隆·马斯克说话”的聊天机器人，而是做一个**有证据支撑的人格顾问系统**。

它的目标是把一个顶级人物拆成多个可复用层：

- 世界观
- 商业观
- 决策逻辑
- 思维模型
- 管理方式
- 风险偏好
- 表达风格
- 盲点与代价

最终产物不是“模仿秀”，而是一个能帮助创业者、管理者、产品团队进行判断的顾问。

## 2. 为什么第一位应该是 Elon Musk

Elon Musk 适合作为第一位顾问，原因不是他最完美，而是他最容易形成强烈的开源传播性：

- 公开材料极多，且跨越汽车、航天、能源、AI、制造、组织管理
- 他的人格张力强，支持者和批评者都很多，容易形成讨论
- 他有鲜明的一阶原理、速度优先、超大目标驱动等标签
- 他的案例能覆盖战略、招聘、制造、融资、产品、品牌、组织文化

如果第一位顾问做得扎实，它会天然变成一个“人物顾问工厂”的样板。

## 3. 这个仓库的最佳定位

最推荐的公开定位不是：

- “Elon Musk Clone”
- “真正的 Elon AI”
- “伊隆本人在线当顾问”

更推荐定位为：

- `Source-grounded Elon-inspired strategic advisor`
- `Open framework for building legendary operator advisors`
- `A public-research-backed company advisor modeled on recurring Elon Musk patterns`

这样更稳，也更容易让开发者、研究者、创业者愿意贡献。

## 4. GitHub 上最容易获得星标的核心，不是资料多，而是资料被组织得好

一万星不是靠“堆资料”拿到的，而是靠这四件事：

### A. 一眼看懂

用户 30 秒内就能明白：

- 这是什么
- 它和普通 prompt 有什么不同
- 为什么值得 fork / star / contribute

### B. 可验证

项目必须能展示：

- 某条人格结论来自哪些公开材料
- 哪些是证据，哪些是推断
- 顾问输出是否稳定

### C. 可扩展

别人看到后会自然想到：

- 我也想加 Jensen Huang
- 我也想加 Lisa Su
- 我也想做一个 investor advisor / operator advisor

### D. 可演示

必须有非常具体的 demo 场景，比如：

- “如果 Elon 来当你公司的 CEO 顾问，他会怎么砍项目？”
- “如果 Elon 评估你的产品路线，会先问哪 5 个问题？”
- “如果 Elon 接手一家增长停滞的制造公司，他会先做什么？”

## 5. 建议采用的三层产物结构

### 第一层：证据层

存放来源登记、摘要、时间、主题标签、可信度、可否公开入库。

### 第二层：人格层

把来源提炼成结构化人格：

- 信念
- 原则
- 触发器
- 决策规则
- 反模式
- 常见口头表达

### 第三层：顾问层

把人格变成能执行的系统：

- system prompt
- user prompt 模板
- 回答约束
- 场景化顾问模式
- 评测题库

## 6. 你后续应该如何扩展到更多人物

建议把人物拆成三类：

- `Founder-Operator`: Elon Musk, Jensen Huang, Lisa Su
- `Management/Execution`: Andy Grove, Reed Hastings, Ben Horowitz
- `Capital/Strategy`: Charlie Munger, Jeff Bezos, Marc Andreessen

这样仓库会形成“顾问矩阵”，而不是单人物项目。

## 7. 当前这一版已经落下来的东西

- 仓库骨架
- Elon 顾问人格规格书
- 来源清单第一版
- GitHub 安全入库策略
- 初始系统提示词
- 可复用人物模板

## 8. 下一阶段最值得做的事情

1. 建一个标准化来源表，统一字段和评分。
2. 把公开视频转成“片段级观点库”。
3. 给 Elon 顾问做 20 道标准评测题。
4. 做一个简单 Web Demo。
5. 再加入第二位人物，让仓库从单点项目变成平台雏形。
