import pandas as pd
from pymongo import MongoClient
from datetime import datetime
import motor.motor_asyncio
import asyncio

# เชื่อมต่อกับ MongoDB
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')
db = client['project']
logfiles_collection = db['logfiles']
update_collection = db['update']

# ฟังก์ชันสำหรับประมวลผลข้อมูล
async def process_latest_file(latest_file_document):
    raw_event_log = latest_file_document['Raw Event Log']

    # แบ่งสตริง raw_event_log เป็นบรรทัด
    raw_event_logs = raw_event_log.split('\n')
    processed_data = []

    for log in raw_event_logs:
        parts = log.split(',')
        if len(parts) > 113:  # ตรวจสอบให้มีข้อมูลเพียงพอ
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
                'Threat Information': ','.join(parts[109:114]).strip()  # รวมข้อมูล Threat Information
            })

    # อัปโหลดข้อมูลที่ประมวลผลไปยัง MongoDB
    if processed_data:
        try:
            # ทำการแทรกข้อมูลเป็นกลุ่มเพื่อเพิ่มประสิทธิภาพ
            batch_size = 1000
            for i in range(0, len(processed_data), batch_size):
                batch = processed_data[i:i+batch_size]
                result = await update_collection.insert_many(batch)
                if len(result.inserted_ids) != len(batch):
                    print(f"Warning: Only {len(result.inserted_ids)} out of {len(batch)} records were inserted.")
        except Exception as e:
            print(f"เกิดข้อผิดพลาดในการอัปโหลดข้อมูล: {e}")

    print("การประมวลผลข้อมูลเสร็จสมบูรณ์ อัปโหลดข้อมูลไปยัง MongoDB เรียบร้อยแล้ว")

# ฟังก์ชันสำหรับตรวจสอบการเปลี่ยนแปลงใน collection
async def watch_logfiles_collection():
    with logfiles_collection.watch() as stream:
        for change in stream:
            if change['operationType'] == 'insert':
                print("ตรวจพบการอัปโหลดไฟล์ใหม่ กำลังประมวลผล...")
                try:
                    latest_file_document = change['fullDocument']
                    await process_latest_file(latest_file_document)
                except Exception as e:
                    print(f"เกิดข้อผิดพลาดขณะประมวลผลไฟล์ใหม่: {e}")

# เริ่มตรวจสอบการเปลี่ยนแปลงใน collection
if __name__ == "__main__":
    print("เริ่มตรวจสอบการเปลี่ยนแปลงใน collection logfiles...")
    loop = asyncio.get_event_loop()
    loop.run_until_complete(watch_logfiles_collection())
