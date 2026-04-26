import requests
import json
import time
import os
from dotenv import load_dotenv

# --- 配置区 ---
load_dotenv()
API_KEY = os.getenv("UW_API_KEY")
# 定义需要抓取的学期列表
TERMS = ['1241', '1245', '1249', '1251', '1255', '1259', '1261', '1265']

# 获取当前脚本所在目录，并创建一个 'data' 文件夹
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, 'data')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def fetch_term_data(term_code):
    url = f'https://openapi.data.uwaterloo.ca/v3/Courses/{term_code}'
    headers = {'x-api-key': API_KEY, 'accept': 'application/json'}
    
    print(f"正在抓取学期 {term_code}...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        # 如果某个学期还没发布数据（404），我们跳过它而不是让程序崩溃
        if response.status_code == 404:
            print(f"  [跳过] 学期 {term_code} 的数据暂未发布或不存在。")
            return
            
        response.raise_for_status()
        courses_data = response.json()
        
        # 保存文件到 data 文件夹
        file_path = os.path.join(DATA_DIR, f'courses_{term_code}.json')
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(courses_data, f, ensure_ascii=False, indent=4)
            
        print(f"  [成功] 已保存 {len(courses_data)} 门课程到 {file_path}")

    except Exception as e:
        print(f"  [错误] 抓取 {term_code} 时发生异常: {e}")

def main():
    start_time = time.time()
    
    for term in TERMS:
        fetch_term_data(term)
        # 礼貌性延迟 0.5 秒，保护 API
        time.sleep(0.5)
    
    end_time = time.time()
    print(f"\n全部任务完成！总耗时: {end_time - start_time:.2f} 秒")

if __name__ == "__main__":
    main()