import pandas as pd
from pymongo import MongoClient
from datetime import datetime

# เชื่อมต่อกับ MongoDB
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')  # ปรับ connection string ตามความเหมาะสม
db = client['project']
logfiles_collection = db['logfiles']
update_collection = db['update']

# ฟังก์ชันสำหรับประมวลผลข้อมูล
def process_latest_file():
    # ดึงข้อมูลไฟล์ที่อัปโหลดล่าสุด
    latest_file_document = logfiles_collection.find().sort([('$natural', -1)]).limit(1)
    latest_file_document = list(latest_file_document)[0]

    # ดึงข้อมูลจากฟิลด์ "Raw Event Log"
    raw_event_log = latest_file_document['Raw Event Log']

    # raw_event_log เป็นสตริงและต้องแยกข้อมูล
    raw_event_logs = raw_event_log.split('\n')  # แยกบรรทัด
    processed_data = []

    for log in raw_event_logs:
        parts = log.split(',')
        if len(parts) > 42:  # ตรวจสอบให้แน่ใจว่ามีข้อมูลเพียงพอ
            processed_data.append({
                'Country': parts[42].strip(),
                'Timestamp': parts[1].strip(),
                'Action': parts[30].strip(),
                'Source IP': parts[7].strip(),
                'Source Port': parts[24].strip(),
                'Destination IP': parts[8].strip(),
                'Destination Port': parts[25].strip(),
                'Protocol': parts[29].strip(),
                'Bytes Sent': parts[31].strip(),
                'Bytes Received': parts[32].strip(),
                'Threat Information': ','.join(parts[109:114]).strip()
            })

    # อัปโหลดข้อมูลที่ประมวลผลแล้วกลับไปยัง MongoDB
    if processed_data:
        # ปรับปรุงการอัปโหลดเพื่อแยกข้อมูลเป็นฟิลด์ต่างๆ
        for data in processed_data:
            update_collection.insert_one(data)

    print("การประมวลผลเสร็จสิ้นและอัปโหลดข้อมูลกลับไปยัง MongoDB เรียบร้อยแล้ว")

# ฟังก์ชันสำหรับตรวจสอบการเปลี่ยนแปลงใน collection
def watch_logfiles_collection():
    with logfiles_collection.watch() as stream:
        for change in stream:
            if change['operationType'] == 'insert':
                print("ตรวจพบการอัปโหลดไฟล์ใหม่ กำลังประมวลผล...")
                try:
                    process_latest_file()
                except Exception as e:
                    print(f"Error processing new file: {e}")

# เริ่มตรวจสอบการเปลี่ยนแปลงใน collection
if __name__ == "__main__":
    print("เริ่มการตรวจสอบการเปลี่ยนแปลงใน collection logfiles...")
    watch_logfiles_collection()
