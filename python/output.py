import pandas as pd

# Load the data
df = pd.read_csv('report1710215971890.csv.gz', compression='gzip')

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

# Save the result to a new CSV file
result_df.to_csv('output_file.csv', index=False)
