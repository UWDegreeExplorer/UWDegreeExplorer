# Graduation Requirement Verification Architecture

## 1. 核心挑战 (The Challenge)
PDF 中的毕业要求是高度自然语言化的，例如：
*   **正则匹配**：`CS 1[134]5` 代表 CS115, CS135, CS145 选一。
*   **范围匹配**：`CS 340-398; 440-489`。
*   **多重属性**：一门课（例如 ENGL 109）既是一门 Non-Math Elective，也是 Humanities Breadth，同时又是 Communication List 1。如果把它分配给了 List 1，它还能不能满足其他条件？
*   **复杂约束**：Depth requirement（深度要求）需要同一学科 1.5 学分，且包含 300+ 级别课程或构成先修链。

## 2. 规则数字化引擎 (Rule Digitization)
我们无法在代码里直接读取 PDF，必须将这些要求转化为**结构化的 JSON 规则树**，存入数据库（例如新建一张表 `planner_program_rules`）。

一个 BCS (计算机科学) 的规则 JSON 结构示例：
```json
{
  "programId": "bcs",
  "totalUnits": 20.0,
  "requirements": [
    {
      "id": "core_cs",
      "name": "Required CS Courses",
      "type": "exact_match",
      "courses": ["CS240", "CS241", "CS245", "CS246", "CS251", "CS341", "CS350"]
    },
    {
      "id": "intro_cs_1",
      "name": "Intro CS 1",
      "type": "regex_match",
      "pattern": "CS1[134]5",
      "units_required": 0.5
    },
    {
      "id": "breadth_comm",
      "name": "Communication Requirement",
      "type": "database_list_match",
      "listType": "list_1", // 对应 planner_communication_list
      "units_required": 0.5
    },
    {
      "id": "breadth_social",
      "name": "Social Science Breadth",
      "type": "category_match",
      "category": "Social Sciences", // 对应 planner_subject_breadth
      "units_required": 1.0
    },
    {
      "id": "depth_requirement",
      "name": "Depth Requirement",
      "type": "custom_evaluator",
      "evaluator": "depth_rule_1.5_units"
    }
  ]
}
```

## 3. 分配算法逻辑 (Allocation Algorithm)
这是一个典型的**约束满足问题 (Constraint Satisfaction Problem, CSP)**。由于一门课可能符合多个“槽位”（Slot），我们需要采用**贪心算法 + 回溯优先匹配 (Greedy with Priority)** 的机制来验证。

### 执行步骤：
1. **数据准备 (Data Hydration)**
   * 获取用户已修/计划修的课程列表（User Courses）。
   * 从 `planner_courses` 中查询它们的 Units（学分）。
   * 关联 `planner_subject_breadth` 获取学科分类。
   * 关联 `planner_communication_list` 确认是否为 List 1/2。

2. **第一优先级：严格精确匹配 (Strict Matching)**
   * 优先用用户的课去填补那些**唯一指定**的坑（如 `CS 240`, `MATH 135`）。
   * 填补后，从用户的可用课程池（Available Pool）中划掉这门课的对应学分。

3. **第二优先级：窄范围匹配 (Narrow Range / Regex Match)**
   * 例如 `CS 1[34]6`，或者 List 1 通讯课。
   * 遍历 Available Pool，找到符合条件的课填入。

4. **第三优先级：分类与广度匹配 (Category & Breadth)**
   * 例如填补 `Social Science` 和 `Humanities`。利用我们现有的 `planner_subject_breadth` 表，如果用户的剩余课程 `subjectCode` 在表中对应 `Humanities`，则填入该槽位。

5. **第四优先级：深度要求 (Depth Requirement Check)**
   * 对 Available Pool（或已经分配为 Non-Math Elective 的课）按 `subjectCode` 进行 `GROUP BY`。
   * 寻找是否有任何一个 Subject 累积达到了 1.5 学分，并且其中包含 `catalogNumber >= 300` 的记录。

6. **第五优先级：凑学分 (Free Electives)**
   * 任何填完上述所有槽位后剩下的课程，全部扔进 `Additional Elective Units` 槽位，检查总学分是否达到 20.0。

## 4. 关键点：双重计数 (Double Counting Rules)
在滑铁卢的体系中，**Breadth (广度)** 课程往往是可以和 **Depth (深度)** 课程互相重叠计数的（Double Counting），但**不能**同时作为两个不同的 Breadth。
* 代码实现上：我们需要区分“消耗型槽位”和“验证型槽位”。
* 比如填充 `Social Science` 槽位是“消耗型”，填了这 0.5 学分就被扣除了；
* 但 `Depth Requirement` 是“验证型”，引擎扫描用户所有 Non-Math 课程来验证是否满足深度，不需要扣除学分。

## 5. 后续开发建议
按照现在的数据库，你的地基打得非常好：
- `planner_courses` 提供基础属性。
- `planner_subject_breadth` 解决了最让人头疼的按文理科分类的问题。
- `planner_communication_list` 解决了特殊的通讯要求。

**下一步需要做的是：**
开发一个可视化的 **Degree Rule Builder (学位规则构建器)** 或者直接在代码里写一个 TypeScript 的 Rule Engine。我们不需要一次性解析全部 24 个 PDF，可以先手动把 `bcs.pdf` 翻译成 JSON 格式，把引擎跑通。
