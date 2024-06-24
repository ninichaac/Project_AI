import pandas as pd
from pymongo import MongoClient
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import numpy as np

# เชื่อมต่อกับ MongoDB
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')
db = client['project']
update_collection = db['update']

# ดึงข้อมูลเอกสารล่าสุดจากคอลเลกชัน update ใน MongoDB
latest_document = update_collection.find().sort([('$natural', -1)]).limit(1)
latest_data = list(latest_document)[0]

# แปลงข้อมูลจาก MongoDB เป็น DataFrame
output_file = pd.DataFrame([latest_data])

# โหลดไฟล์ CSV ของ Dangerous IP
dangerous_ip_file = pd.read_csv('Dangerous_IP.csv')

# แปลง Timestamp ให้เป็น datetime object
output_file['Timestamp'] = pd.to_datetime(output_file['Timestamp'], errors='coerce')

# แปลงคอลัมน์ที่มีปัญหาให้เป็นตัวเลข
output_file['Bytes Sent'] = pd.to_numeric(output_file['Bytes Sent'], errors='coerce')
output_file['Bytes Received'] = pd.to_numeric(output_file['Bytes Received'], errors='coerce')

# แปลงคอลัมน์ที่เป็น string ให้เป็นตัวเลข (ให้เป็น 0 ถ้ามีข้อผิดพลาด)
output_file['Source Port'] = pd.to_numeric(output_file['Source Port'], errors='coerce').fillna(0).astype(int)
output_file['Destination Port'] = pd.to_numeric(output_file['Destination Port'], errors='coerce').fillna(0).astype(int)

# ดึงคอลัมน์ 'Source IP' จากไฟล์ Dangerous_IP.csv
dangerous_ips = set(dangerous_ip_file['Source IP'])

# สร้างคอลัมน์ label: 1 สำหรับ IP อันตราย, 0 สำหรับ IP ปกติ
output_file['label'] = output_file['Source IP'].apply(lambda ip: 1 if ip in dangerous_ips else 0)

# ลบคอลัมน์ 'Timestamp' ออกจากฟีเจอร์
X = output_file.drop(columns=['label', 'Source IP', 'Destination IP', 'Timestamp'])
y = output_file['label']

# การแปลงข้อมูลที่เป็น string ให้เป็นตัวเลข (encoding)
X = pd.get_dummies(X, columns=['Country', 'Action', 'Protocol', 'Threat Information'])

# เติมค่า missing values ด้วย 0
X = X.fillna(0)

# แบ่งข้อมูลเป็นชุดฝึกและทดสอบ
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# กำหนดและฝึกโมเดล
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# ทำนายและประเมินผล
y_pred = model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred)}")
print(classification_report(y_test, y_pred))

# ทำนายสำหรับข้อมูลทั้งหมด
output_file['prediction'] = model.predict(X)
output_file['is_anomalous'] = output_file['prediction'] == 1

# กรองแถวที่มี IP อันตรายเท่านั้น
output_file_filtered = output_file[output_file['is_anomalous'] == True]

# ตรวจสอบข้อมูลครบถ้วนก่อนบันทึก
output_file_filtered.dropna(subset=['Country', 'Bytes Sent', 'Bytes Received'], inplace=True)

# บันทึกผลลัพธ์เป็นไฟล์ CSV ใหม่ที่มีแค่ IP ที่ถือว่าอันตรายและข้อมูลถูกต้องครบถ้วน
output_file_filtered.to_csv('filtered_output_corrected.csv', index=False)

output_file_filtered.head()
