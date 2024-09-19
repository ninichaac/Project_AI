import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier, IsolationForest
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score, roc_curve, precision_recall_curve, confusion_matrix
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier
import matplotlib.pyplot as plt
import logging
from pymongo import MongoClient
from datetime import datetime
import sys
import os

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Check if the Google ID argument is provided
if len(sys.argv) < 2:
    logging.error("Google ID argument is missing.")
    sys.exit(1)

# Get Google ID from command line argument
google_id = sys.argv[1]
logging.info(f"Received Google ID: {google_id}")

# Set directory
update_dir = 'update'

# Set the path to the CSV file.
processed_csv_path = os.path.join(update_dir, google_id, 'processed_data.csv')

# Check if the file exists or not
if not os.path.exists(processed_csv_path):
    logging.error(f"File {processed_csv_path} does not exist.")
    sys.exit(1)

# Load CSV files and handle dtype
logging.info("Loading CSV files...")
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')
db = client['project']
finish_collection = db['finishes']
output_file = pd.read_csv(processed_csv_path, dtype={'Source Port': str, 'Bytes Sent': str, 'Bytes Received': str})
dangerous_ip_file = pd.read_csv('python/Dangerous_IP.csv')

# Convert Timestamp to datetime object
output_file['Timestamp'] = pd.to_datetime(output_file['Timestamp'], errors='coerce')

# Convert problematic columns to numeric
output_file['Bytes Sent'] = pd.to_numeric(output_file['Bytes Sent'], errors='coerce')
output_file['Bytes Received'] = pd.to_numeric(output_file['Bytes Received'], errors='coerce')
output_file['Source Port'] = pd.to_numeric(output_file['Source Port'], errors='coerce').fillna(0).astype(int)
output_file['Destination Port'] = pd.to_numeric(output_file['Destination Port'], errors='coerce').fillna(0).astype(int)

# Get 'Source IP' column from Dangerous_IP.csv
dangerous_ips = set(dangerous_ip_file['Source IP'])

# Create label column: 1 for dangerous IPs, 0 for normal IPs
output_file['label'] = output_file['Source IP'].apply(lambda ip: 1 if ip in dangerous_ips else 0)

# Drop unnecessary columns
X = output_file.drop(columns=['label', 'Source IP', 'Destination IP', 'Timestamp'])
y = output_file['label']

# Encode categorical columns
X = pd.get_dummies(X, columns=['Country', 'Action', 'Protocol', 'Threat Information'])

# Fill missing values with 0
X = X.fillna(0)

# Split data into training and testing sets
logging.info("Splitting data into training and testing sets...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Define models
rf_model = RandomForestClassifier(random_state=42)
gbc_model = GradientBoostingClassifier(random_state=42)
xgb_model = XGBClassifier(random_state=42, eval_metric='logloss')

# Create Voting Classifier
voting_clf = VotingClassifier(estimators=[
    ('rf', rf_model),
    ('gbc', gbc_model),
    ('xgb', xgb_model)
], voting='soft')  # Use 'soft' voting for probability predictions

# Define the pipeline
pipeline = Pipeline([
    ('scaler', StandardScaler()),  # Add scaler if needed
    ('voting_clf', voting_clf)
])

# Define hyperparameters for RandomizedSearch
param_distributions = {
    'voting_clf__rf__n_estimators': [50, 100],
    'voting_clf__gbc__n_estimators': [50, 100],
    'voting_clf__xgb__n_estimators': [50, 100]
}

# Perform RandomizedSearchCV
logging.info("Performing RandomizedSearchCV...")
random_search = RandomizedSearchCV(pipeline, param_distributions, n_iter=8, cv=3, scoring='roc_auc', random_state=42)
random_search.fit(X_train, y_train)

# Best parameters and best score
logging.info(f"Best parameters: {random_search.best_params_}")
logging.info(f"Best ROC-AUC score: {random_search.best_score_}")

# Use the best model for predictions
best_model = random_search.best_estimator_
y_pred_proba = best_model.predict_proba(X_test)[:, 1]

# Calculate ROC-AUC score
roc_auc = roc_auc_score(y_test, y_pred_proba)
logging.info(f"ROC-AUC Score: {roc_auc}")

# Calculate ROC curve
fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)

# Plot ROC curve
# plt.figure()
# plt.plot(fpr, tpr, label=f'ROC curve (area = {roc_auc:.2f})')
# plt.plot([0, 1], [0, 1], 'k--')
# plt.xlim([0.0, 1.0])
# plt.ylim([0.0, 1.05])
# plt.xlabel('False Positive Rate')
# plt.ylabel('True Positive Rate')
# plt.title('Receiver Operating Characteristic')
# plt.legend(loc="lower right")
# plt.show()

# Calculate Precision-Recall curve
precision, recall, thresholds_pr = precision_recall_curve(y_test, y_pred_proba)

# Plot Precision-Recall curve
# plt.figure()
# plt.plot(recall, precision, label='Precision-Recall curve')
# plt.xlabel('Recall')
# plt.ylabel('Precision')
# plt.title('Precision-Recall curve')
# plt.legend(loc="lower left")
# plt.show()

# Adjust threshold to balance precision and recall
optimal_threshold = thresholds[np.argmax(tpr - fpr)]
logging.info(f"Optimal Threshold: {optimal_threshold}")

# Predict with custom threshold
y_pred_custom_threshold = (y_pred_proba >= optimal_threshold).astype(int)

# Evaluate prediction results
accuracy = accuracy_score(y_test, y_pred_custom_threshold)
logging.info(f"Accuracy with custom threshold: {accuracy}")
logging.info("Classification report:")
logging.info(f"\n{classification_report(y_test, y_pred_custom_threshold)}")

# Confusion Matrix
conf_matrix = confusion_matrix(y_test, y_pred_custom_threshold)
logging.info(f"Confusion Matrix:\n{conf_matrix}")

# Use Isolation Forest to detect anomalies
isolation_forest = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
isolation_forest.fit(X_train)

# Predict with Isolation Forest
output_file['anomaly_score'] = isolation_forest.decision_function(X)
output_file['is_anomalous_isolation_forest'] = isolation_forest.predict(X)

# Convert Isolation Forest predictions to 0 for normal, 1 for anomaly
output_file['is_anomalous_isolation_forest'] = output_file['is_anomalous_isolation_forest'].apply(lambda x: 1 if x == -1 else 0)

# Merge results from both models
output_file_filtered = pd.concat([output_file, pd.Series(y_pred_custom_threshold, name='y_pred_custom_threshold')], axis=1)

# Drop any rows with missing values in critical columns
output_file_filtered.dropna(subset=['Country', 'Bytes Sent', 'Bytes Received', 'y_pred_custom_threshold'], inplace=True)

# Filter rows with dangerous IPs based on multiple conditions
filtered_output_dangerous_ips = output_file_filtered[
    (output_file_filtered['label'] == 1) |  # IP is marked as dangerous
    (output_file_filtered['anomaly_score'] < 0) |  # Anomaly score indicates abnormal behavior
    (output_file_filtered['is_anomalous_isolation_forest'] == 1) |  # Detected as anomalous by Isolation Forest
    (output_file_filtered['y_pred_custom_threshold'] == 1)  # Predicted as dangerous by custom threshold
]

# Define a function to determine the status
def determine_status(row):
    count_dangerous = row['label'] + (row['anomaly_score'] < 0) + row['is_anomalous_isolation_forest'] + row['y_pred_custom_threshold']
    if count_dangerous == 1:
        return 'Risk'
    elif count_dangerous == 2:
        return 'High Risk'
    elif count_dangerous == 3:
        return 'Dangerous'
    elif count_dangerous == 4:
        return 'Very dangerous'
    else:
        return 'Unknown'

# Apply the function to each row to create the 'status' column
filtered_output_dangerous_ips['status'] = filtered_output_dangerous_ips.apply(determine_status, axis=1)

# Add 'uploadedAt' field with current timestamp
filtered_output_dangerous_ips['uploadedAt'] = datetime.now()

# Add Google ID to each record
filtered_output_dangerous_ips['googleId'] = google_id

# Convert DataFrame to dictionary for MongoDB insertion
filtered_output_dangerous_ips_dict = filtered_output_dangerous_ips.to_dict('records')

# Insert filtered data into the 'finish' collection in MongoDB
logging.info("Inserting filtered data into MongoDB...")
finish_collection.insert_many(filtered_output_dangerous_ips_dict)

# Display the first few rows of the filtered data
logging.info("Filtered dangerous IPs with status:")
logging.info(f"\n{filtered_output_dangerous_ips.head()}")
