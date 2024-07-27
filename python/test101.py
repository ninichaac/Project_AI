# ตรวจสอบว่า datetime.now() ถูกตั้งค่าเป็นเวลาปัจจุบันอย่างถูกต้อง
from datetime import datetime
current_time = datetime.now()
print("Current Time:", current_time)
