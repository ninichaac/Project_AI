from pymongo import MongoClient
import pandas as pd
from datetime import datetime

# Connect to MongoDB
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')
db = client['project']
finish_collection = db['finishes']

# Get the latest data from MongoDB
def get_latest_data(collection):
    try:
        # Retrieve the latest document based on the 'uploadedAt' field
        latest_data = collection.find().sort('uploadedAt', -1).limit(1)
        # Convert to a DataFrame
        df = pd.DataFrame(list(latest_data))
        return df
    except Exception as e:
        print(f"Error retrieving data: {e}")
        return pd.DataFrame()

# Get the latest data
latest_data_df = get_latest_data(finish_collection)

# Display the latest data
if not latest_data_df.empty:
    print("Latest data from MongoDB:")
    print(latest_data_df)
else:
    print("No data found.")
