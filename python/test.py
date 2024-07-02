import pandas as pd
from pymongo import MongoClient
from datetime import datetime

# เชื่อมต่อกับ MongoDB
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')
db = client['project']
logfiles_collection = db['logfiles']
update_collection = db['update']

# Function for processing data
def process_latest_file(latest_file_document):
    # Extract data from the "Raw Event Log" field
    raw_event_log = latest_file_document['Raw Event Log']

    # Split the raw_event_log string into lines
    raw_event_logs = raw_event_log.split('\n')
    processed_data = []

    for log in raw_event_logs:
        parts = log.split(',')
        if len(parts) > 113:  # Ensure there is sufficient data
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
                'Threat Information': ','.join(parts[109:114]).strip()  # Corrected Threat Information merging
            })

    # Upload processed data to MongoDB
    if processed_data:
        try:
            # Perform batch insert for efficiency
            update_collection.insert_many(processed_data)
        except Exception as e:
            print(f"Error uploading data: {e}")

    print("Data processing complete. Uploaded data to MongoDB successfully")

# ฟังก์ชันสำหรับตรวจสอบการเปลี่ยนแปลงใน collection
def watch_logfiles_collection():
    with logfiles_collection.watch() as stream:
        for change in stream:
            if change['operationType'] == 'insert':
                print("New file upload detected Processing...")
                try:
                    latest_file_document = change['fullDocument']
                    process_latest_file(latest_file_document)
                except Exception as e:
                    print(f"An error occurred while processing a new file: {e}")

# เริ่มตรวจสอบการเปลี่ยนแปลงใน collection
if __name__ == "__main__":
    print("Start checking for changes to collection logfiles...")
    watch_logfiles_collection()
