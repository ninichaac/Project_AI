import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier, IsolationForest
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score, roc_curve, precision_recall_curve, confusion_matrix
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier
import matplotlib.pyplot as plt
import logging
from imblearn.over_sampling import SMOTE

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Connect to MongoDB and fetch data from the 'update' collection
logging.info("Connecting to MongoDB...")
client = MongoClient('mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin')
db = client['project']
collection = db['update']

# Load data from MongoDB
logging.info("Loading data from MongoDB...")
data = pd.DataFrame(list(collection.find()))

# Drop the _id column
data.drop(columns=['_id'], inplace=True)

# Data preprocessing
data['Timestamp'] = pd.to_datetime(data['Timestamp'], errors='coerce')
data['Bytes Sent'] = pd.to_numeric(data['Bytes Sent'], errors='coerce')
data['Bytes Received'] = pd.to_numeric(data['Bytes Received'], errors='coerce')
data['Source Port'] = pd.to_numeric(data['Source Port'], errors='coerce').fillna(0).astype(int)
data['Destination Port'] = pd.to_numeric(data['Destination Port'], errors='coerce').fillna(0).astype(int)

# Get 'Source IP' column from Dangerous_IP collection
dangerous_ip_collection = db['update']
dangerous_ips = set(dangerous_ip_collection.distinct('Source IP'))

# Create label column: 1 for dangerous IPs, 0 for normal IPs
data['label'] = data['Source IP'].apply(lambda ip: 1 if ip in dangerous_ips else 0)

# Ensure there are normal IPs
if data['label'].value_counts().get(0, 0) == 0:
    logging.info("No normal IPs found, creating synthetic normal IPs...")
    # Create synthetic normal IPs
    normal_ips = [f'192.168.1.{i}' for i in range(1, 1001)]
    normal_data = data.sample(n=len(normal_ips), replace=True).copy()
    normal_data['Source IP'] = normal_ips
    normal_data['label'] = 0
    data = pd.concat([data, normal_data], ignore_index=True)

# Check initial class distribution
logging.info(f"Initial class distribution: {data['label'].value_counts()}")

# Drop unnecessary columns
X = data.drop(columns=['label', 'Source IP', 'Destination IP', 'Timestamp'])
y = data['label']

# Encode categorical columns
X = pd.get_dummies(X, columns=['Country', 'Action', 'Protocol', 'Threat Information'])

# Fill missing values with 0
X = X.fillna(0)

# Split data into training and testing sets
logging.info("Splitting data into training and testing sets...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Check class distribution in training and testing sets
logging.info(f"Class distribution in the training set: {y_train.value_counts()}")
logging.info(f"Class distribution in the testing set: {y_test.value_counts()}")

# Check if training set contains both classes
if len(y_train.unique()) == 1:
    logging.error("The training set contains only one class. Please ensure that the data contains both classes.")
else:
    # Use SMOTE to balance the training set
    smote = SMOTE(random_state=42)
    X_train_res, y_train_res = smote.fit_resample(X_train, y_train)

    # Check class distribution after resampling
    logging.info(f"Class distribution after SMOTE: {y_train_res.value_counts()}")

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

    # Define hyperparameters for GridSearchCV
    param_distributions = {
        'voting_clf__rf__n_estimators': [50, 100],
        'voting_clf__gbc__n_estimators': [50, 100],
        'voting_clf__xgb__n_estimators': [50, 100]
    }

    # Perform GridSearchCV
    logging.info("Performing GridSearchCV...")
    grid_search = GridSearchCV(pipeline, param_distributions, cv=3, scoring='roc_auc')
    grid_search.fit(X_train_res, y_train_res)

    # Best parameters and best score
    logging.info(f"Best parameters: {grid_search.best_params_}")
    logging.info(f"Best ROC-AUC score: {grid_search.best_score_}")

    # Use the best model for predictions
    best_model = grid_search.best_estimator_
    y_pred_proba = best_model.predict_proba(X_test)[:, 1]

    # Calculate ROC-AUC score
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    logging.info(f"ROC-AUC Score: {roc_auc}")

    # Calculate ROC curve
    fpr, tpr, thresholds = roc_curve(y_test, y_pred_proba)

    # Plot ROC curve
    plt.figure()
    plt.plot(fpr, tpr, label=f'ROC curve (area = {roc_auc:.2f})')
    plt.plot([0, 1], [0, 1], 'k--')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('Receiver Operating Characteristic')
    plt.legend(loc="lower right")
    plt.show()

    # Calculate Precision-Recall curve
    precision, recall, thresholds_pr = precision_recall_curve(y_test, y_pred_proba)

    # Plot Precision-Recall curve
    plt.figure()
    plt.plot(recall, precision, label='Precision-Recall curve')
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title('Precision-Recall curve')
    plt.legend(loc="lower left")
    plt.show()

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
    isolation_forest = IsolationForest(contamination='auto', random_state=42)
    isolation_forest.fit(X)

    # Predict anomalies in the entire dataset
    is_anomalous = isolation_forest.predict(X)
    data['is_anomalous_isolation_forest'] = is_anomalous

    # Add custom threshold predictions to the DataFrame
    data['is_dangerous_custom_threshold'] = (data['label'] == 1).astype(int)
    data['is_dangerous_isolation_forest'] = (data['is_anomalous_isolation_forest'] == -1).astype(int)  # -1 indicates anomaly

    # Filter results for Source IPs predicted as dangerous by both models
    filtered_output_dangerous_ips = data[
        (data['is_dangerous_custom_threshold'] == 1) |  # Dangerous IPs
        (data['is_dangerous_isolation_forest'] == 1)  # Anomalous IPs by Isolation Forest
    ]

    # Save the results to a new MongoDB collection 'filtered_update'
    filtered_update_collection = db['filtered_update']
    filtered_update_collection.insert_many(filtered_output_dangerous_ips.to_dict('records'))

    logging.info("Filtered data saved to MongoDB collection 'filtered_update'.")
