import pandas as pd
import os
import time
import sys
import logging

# รับค่า googleId จากอาร์กิวเมนต์ในบรรทัดคำสั่ง
google_id = sys.argv[1]  # คาดว่าจะมี googleId เป็นอาร์กิวเมนต์แรก
logging.info(f"Received Google ID: {google_id}")

# กำหนดไดเรกทอรีตาม googleId
uploads_dir = os.path.join('uploads', google_id)
update_dir = os.path.join('update', google_id)

# ตรวจสอบว่ามีไดเรกทอรี 'update' อยู่หรือไม่ ถ้าไม่มีก็สร้างใหม่
if not os.path.exists(update_dir):
    os.makedirs(update_dir)

# ฟังก์ชันสำหรับประมวลผลไฟล์ CSV ล่าสุด
def process_latest_file(latest_file):
    processed_csv_path = os.path.join(update_dir, 'processed_data.csv')
    logging.info(f"latest_file: {latest_file}")
    
    # ตรวจสอบว่ามี 'processed_data.csv' อยู่ในไดเรกทอรี 'update' หรือไม่ และลบออกถ้ามี
    if os.path.exists(processed_csv_path):
        os.remove(processed_csv_path)

    # อ่านไฟล์ CSV ล่าสุด
    df = pd.read_csv(os.path.join(uploads_dir, latest_file))

    # แยกคอลัมน์ 'Raw Event Log' ด้วยคอมม่า
    df_split = df['Raw Event Log'].str.split(',', expand=True)

    # สร้างคอลัมน์ใหม่ตามดัชนีที่ถูกต้อง
    df['Country'] = df_split[42]            # ปรับดัชนีตามโครงสร้างที่แท้จริง
    df['Timestamp'] = df_split[1]           # Timestamp
    df['Action'] = df_split[30]             # Action
    df['Source IP'] = df_split[7]           # Source IP
    df['Source Port'] = df_split[24]        # Source Port ที่ถูกต้อง
    df['Destination IP'] = df_split[8]      # Destination IP
    df['Destination Port'] = df_split[25]   # Destination Port ที่ถูกต้อง
    df['Protocol'] = df_split[29]           # Protocol
    df['Bytes Sent'] = df_split[31]         # Bytes Sent
    df['Bytes Received'] = df_split[32]     # Bytes Received

    # รวมคอลัมน์ 109, 110, 111, 112, 113 เป็น 'Threat Information'
    df['Threat Information'] = df_split[[109, 110, 111, 112, 113]].apply(lambda x: ','.join(x.dropna().astype(str)), axis=1)

    # เลือกคอลัมน์ที่ต้องการในลำดับที่กำหนด
    result_df = df[['Country', 'Timestamp', 'Action', 'Source IP', 'Source Port', 'Destination IP', 'Destination Port', 'Protocol', 'Bytes Sent', 'Bytes Received', 'Threat Information']]

    # บันทึกผลลัพธ์ไปยังไฟล์ CSV ใหม่ในไดเรกทอรี 'update'
    result_df.to_csv(processed_csv_path, index=False)

    print(f"Processed CSV saved to {processed_csv_path}")

# ตรวจสอบไฟล์ใหม่อย่างต่อเนื่อง
latest_processed_file = None

while True:
    files = [f for f in os.listdir(uploads_dir) if f.endswith('.csv')]
    
    if not files:
        print(f"No CSV files found in {uploads_dir}, waiting for new files...")
    else:
        latest_file = max(files, key=lambda f: os.path.getctime(os.path.join(uploads_dir, f)))
        
        if latest_file != latest_processed_file:
            print(f"Processing new file: {latest_file}")
            process_latest_file(latest_file)
            latest_processed_file = latest_file

    time.sleep(10)  # รอ 10 วินาทีก่อนตรวจสอบอีกครั้ง
