import sqlite3
import json
import os
import hashlib
import re

# 配置
DATA_DIR = 'data'
ACTIVE_DATA_DIR = 'active_data' # 存放 active_ids_xxxx.json 的地方
DB_NAME = 'uw_planner.db'

def get_normalized_hash(text):
    """保持你原来的归一化逻辑，确保版本比对的一致性"""
    if not text:
        return "empty"
    clean_text = re.sub(r'[^a-z0-9]', '', text.lower())
    return hashlib.md5(clean_text.encode('utf-8')).hexdigest()

def init_db():
    """保持你原来的表结构，不用变"""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS courses (course_id TEXT PRIMARY KEY, subject_code TEXT, catalog_number TEXT)")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_versions (
            version_id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id TEXT, term_code TEXT, title TEXT,
            description TEXT, requirements TEXT,
            desc_hash TEXT, req_hash TEXT,
            FOREIGN KEY (course_id) REFERENCES courses (course_id)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS course_offerings (
            offering_id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id TEXT, term_code TEXT, course_component TEXT,
            version_id INTEGER,
            FOREIGN KEY (version_id) REFERENCES course_versions (version_id)
        )
    """)
    conn.commit()
    return conn

def sync():
    # 建议运行前：rm uw_planner.db
    conn = init_db()
    cursor = conn.cursor()
    
    json_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.json')]
    
    for filename in sorted(json_files):
        term_code = filename.replace('courses_', '').replace('.json', '')
        print(f"🚀 正在处理学期: {term_code}...")
        
        # --- 1. 加载白名单 (新增) ---
        active_ids_file = os.path.join(ACTIVE_DATA_DIR, f'active_ids_{term_code}.json')
        active_ids = set()
        if os.path.exists(active_ids_file):
            with open(active_ids_file, 'r') as f:
                active_ids = set(json.load(f))
        
        # --- 2. 加载全量目录 ---
        with open(os.path.join(DATA_DIR, filename), 'r') as f:
            courses_list = json.load(f)
            
        for c in courses_list:
            cid = c['courseId']
            title = c.get('title', '')
            desc = c.get('description', '')
            reqs = c.get('requirementsDescription', '')
            comp = c.get('courseComponentCode', 'LEC')
            
            d_hash = get_normalized_hash(desc)
            r_hash = get_normalized_hash(reqs)
            
            # --- 步骤 A：更新基础表 (主表插入) ---
            # 无论开不开，只要在目录里，就得在主表占个座
            cursor.execute("INSERT OR IGNORE INTO courses VALUES (?, ?, ?)", 
                           (cid, c['subjectCode'], c['catalogNumber']))
            
            # --- 步骤 B：版本管理 (DNA 审计) ---
            # 这一步保留了你原本最得意的“版本复用”逻辑
            cursor.execute("""
                SELECT version_id FROM course_versions 
                WHERE course_id = ? AND desc_hash = ? AND req_hash = ?
            """, (cid, d_hash, r_hash))
            
            row = cursor.fetchone()
            if row:
                version_id = row[0]
            else:
                cursor.execute("""
                    INSERT INTO course_versions (course_id, term_code, title, description, requirements, desc_hash, req_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (cid, term_code, title, desc, reqs, d_hash, r_hash))
                version_id = cursor.lastrowid
            
            # --- 步骤 C：条件插入开设记录 (白名单过滤) ---
            # 【这是本次升级的核心：解决全员 7 学期的关键】
            if cid in active_ids:
                cursor.execute("""
                    INSERT INTO course_offerings (course_id, term_code, course_component, version_id)
                    VALUES (?, ?, ?, ?)
                """, (cid, term_code, comp, version_id))
            else:
                # 如果没在白名单里，我们只记录了它的版本，但不记录它的“出勤”
                pass
            
    conn.commit()
    conn.close()
    print("✨ 同步完成！现在你的数据既有历史深度（Versions），又有现实准确度（Offerings）。")

if __name__ == "__main__":
    sync()