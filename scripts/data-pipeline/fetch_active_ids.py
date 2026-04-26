import requests
import json
import os
import urllib3
from dotenv import load_dotenv
load_dotenv()
API_KEY = os.getenv("UW_API_KEY")

# 1. 禁用 SSL 警告（针对你环境里 LibreSSL 版本较低的问题）
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def get_active_ids(term, api_key):
    api_url = f"https://openapi.data.uwaterloo.ca/v3/ClassSchedules/{term}"
    headers = {"x-api-key": api_key}
    
    print(f"正在抓取学期 {term} 的开课名单...")
    
    try:
        # verify=False 解决你的 SSL 握手报错问题
        response = requests.get(api_url, headers=headers, verify=False)
        
        if response.status_code == 200:
            data = response.json()
            # 2. 核心修正：利用 set 去重，但立刻转回 list 以兼容 JSON
            active_ids = list(set(data)) 
            return active_ids
        else:
            print(f"❌ 抓取失败: {term}, 状态码: {response.status_code}")
            return []
    except Exception as e:
        print(f"🚨 请求发生异常: {e}")
        return []

if __name__ == "__main__":
    TERMS = ["1241", "1245", "1249", "1251", "1255", "1259", "1261"]
    
    if not os.path.exists('data'):
        os.makedirs('data')
        
    for term in TERMS:
        active_list = get_active_ids(term, API_KEY)
        if active_list:
            file_path = f"data/active_ids_{term}.json"
            with open(file_path, 'w') as f:
                # 再次确认写入的是 list
                json.dump(active_list, f)
            print(f"✅ 已保存 {len(active_list)} 条记录到 {file_path}")