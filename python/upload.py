import pandas as pd
import os
import time
import sys
import logging

# Get the googleId value from the command line argument.
google_id = sys.argv[1]
logging.info(f"Received Google ID: {google_id}")

# Set directory based on googleId
uploads_dir = os.path.join('uploads', google_id)
update_dir = os.path.join('update', google_id)

# Check if the 'update' directory exists, if not then create a new one.
if not os.path.exists(update_dir):
    os.makedirs(update_dir)

# Function for processing the latest CSV files
def process_latest_file(latest_file):
    processed_csv_path = os.path.join(update_dir, 'processed_data.csv')
    logging.info(f"latest_file: {latest_file}")
    
    # Check if 'processed_data.csv' exists in the 'update' directory and delete it if it does.
    if os.path.exists(processed_csv_path):
        os.remove(processed_csv_path)

    # Read the latest CSV file
    df = pd.read_csv(os.path.join(uploads_dir, latest_file))

    # Separate 'Raw Event Log' columns with commas.
    df_split = df['Raw Event Log'].str.split(',', expand=True)

    # Create a new column based on the correct index.
    df['Country'] = df_split[42]            # Adjust the index according to the actual structure
    df['Timestamp'] = df_split[1]           # Timestamp
    df['Action'] = df_split[30]             # Action
    df['Source IP'] = df_split[7]           # Source IP
    df['Source Port'] = df_split[24]        # Source Port 
    df['Destination IP'] = df_split[8]      # Destination IP
    df['Destination Port'] = df_split[25]   # Destination Port
    df['Protocol'] = df_split[29]           # Protocol
    df['Bytes Sent'] = df_split[31]         # Bytes Sent
    df['Bytes Received'] = df_split[32]     # Bytes Received

    # Combine columns 109, 110, 111, 112, 113 as 'Threat Information'
    df['Threat Information'] = df_split[[109, 110, 111, 112, 113]].apply(lambda x: ','.join(x.dropna().astype(str)), axis=1)

    # Select the desired columns in the specified order.
    result_df = df[['Country', 'Timestamp', 'Action', 'Source IP', 'Source Port', 'Destination IP', 'Destination Port', 'Protocol', 'Bytes Sent', 'Bytes Received', 'Threat Information']]

    # Save results to a new CSV file in 'update' directory.
    result_df.to_csv(processed_csv_path, index=False)

    print(f"Processed CSV saved to {processed_csv_path}")

# Continuously check for new files
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

    time.sleep(10)
