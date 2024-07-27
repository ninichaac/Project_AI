import pandas as pd
import os

# Define the directories
uploads_dir = 'uploads'
update_dir = 'update'

# Get the latest CSV file from the 'uploads' directory
files = [f for f in os.listdir(uploads_dir) if f.endswith('.csv')]
latest_file = max(files, key=lambda f: os.path.getctime(os.path.join(uploads_dir, f)))

# Read the latest CSV file
df = pd.read_csv(os.path.join(uploads_dir, latest_file))

# Split the 'Raw Event Log' column by commas
df_split = df['Raw Event Log'].str.split(',', expand=True)

# Create new columns based on the correct indices
df['Country'] = df_split[42]            # Adjust the index based on the actual structure
df['Timestamp'] = df_split[1]           # Timestamp
df['Action'] = df_split[30]             # Action
df['Source IP'] = df_split[7]           # Source IP
df['Source Port'] = df_split[24]        # Corrected Source Port
df['Destination IP'] = df_split[8]      # Destination IP
df['Destination Port'] = df_split[25]   # Corrected Destination Port
df['Protocol'] = df_split[29]           # Protocol
df['Bytes Sent'] = df_split[31]         # Bytes Sent
df['Bytes Received'] = df_split[32]     # Bytes Received

# Concatenate columns 109, 110, 111, 112, 113 into 'Threat Information'
df['Threat Information'] = df_split[[109, 110, 111, 112, 113]].apply(lambda x: ','.join(x.dropna().astype(str)), axis=1)

# Select the desired columns in the specified order
result_df = df[['Country', 'Timestamp', 'Action', 'Source IP', 'Source Port', 'Destination IP', 'Destination Port', 'Protocol', 'Bytes Sent', 'Bytes Received', 'Threat Information']]

# Save the result to a new CSV file in the 'update' directory
result_csv_path = os.path.join(update_dir, 'processed_data.csv')
result_df.to_csv(result_csv_path, index=False)

print(f"Processed CSV saved to {result_csv_path}")
