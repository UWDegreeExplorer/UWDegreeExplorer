import sqlite3
import re
from datetime import datetime

# --- 1. 配置区域 ---
DB_NAME = "uw_planner.db"

def setup_database_schema(cursor):
    """
    自动处理表结构变更。
    如果 antireq_ids 列不存在，则添加它。
    """
    try:
        print("正在检查并准备数据库列...")
        cursor.execute("ALTER TABLE course_requirements ADD COLUMN antireq_ids TEXT")
        print("✅ 成功添加 'antireq_ids' 列。")
    except sqlite3.OperationalError:
        # 如果列已经存在，SQLite 会报错，我们直接捕获并跳过
        print("ℹ️ 'antireq_ids' 列已存在，直接开始处理数据。")

def build_course_lookup(cursor):
    """
    建立全校课程映射字典。
    将 '学科 课号' (如 'MATH 137') 映射为 'course_id' (如 '012345')。
    """
    cursor.execute("PRAGMA table_info(courses)")
    cols = [col[1] for col in cursor.fetchall()]
    subj_col = 'subject_code' if 'subject_code' in cols else 'subject'
    cat_col = 'catalog_number' if 'catalog_number' in cols else 'catalog'

    cursor.execute(f"SELECT course_id, {subj_col}, {cat_col} FROM courses")
    lookup = {}
    for cid, subj, cat in cursor.fetchall():
        if subj and cat:
            key = f"{subj.strip().upper()} {cat.strip().upper()}"
            lookup[key] = cid
    return lookup

def extract_and_map_antireqs(text, lookup_dict):
    """
    核心逻辑：状态机正则提取。
    支持补全 'MATH 137, 147' 这种格式，并验证 ID 真实性。
    """
    if not text:
        return ""
    
    # 正则：(学科代码)? (课号)
    pattern = r"([A-Z]{2,5})?\s?(\d{3}[A-Z]?)"
    matches = re.finditer(pattern, text.upper())
    
    found_ids = []
    current_subject = None
    
    for match in matches:
        subj = match.group(1)
        num = match.group(2)
        
        if subj:
            current_subject = subj
            full_code = f"{subj} {num}"
        elif current_subject:
            # 状态机：使用上一个出现的学科代码
            full_code = f"{current_subject} {num}"
        else:
            continue
            
        # 验证是否为真实存在的课号
        cid = lookup_dict.get(full_code)
        if cid:
            found_ids.append(cid)
            
    # 去重并以逗号分隔存储
    return ",".join(list(dict.fromkeys(found_ids)))

def run_antireq_pipeline():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    # 1. 准备工作
    setup_database_schema(cursor)
    lookup = build_course_lookup(cursor)

    # 2. 读取原始数据
    cursor.execute("SELECT course_id, antireq_raw FROM course_requirements")
    rows = cursor.fetchall()
    
    print(f"🚀 正在处理 {len(rows)} 门课程的反修关系转换...")
    
    update_data = []
    for cid, raw_text in rows:
        ids_string = extract_and_map_antireqs(raw_text, lookup)
        update_data.append((ids_string, cid))

    # 3. 批量更新
    cursor.executemany(
        "UPDATE course_requirements SET antireq_ids = ? WHERE course_id = ?",
        update_data
    )

    conn.commit()
    conn.close()
    print("\n🏁 处理完成！")
    print("现在你可以在 'antireq_ids' 列中看到处理好的 ID 列表了。")

if __name__ == "__main__":
    run_antireq_pipeline()