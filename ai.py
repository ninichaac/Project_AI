import pandas as pd
import re
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import accuracy_score, classification_report
import json

# Your known malicious IPs and AI training code here...

# Example AI training code
known_malicious_ips = [
    "1.3.3.7", "5.6.7.8", "8.8.8.8", "12.34.56.78", "23.45.67.89",
    "45.67.89.101", "67.89.101.123", "89.101.123.145", "123.145.167.189",
    "145.167.189.201", "192.168.1.1", "192.168.1.2", "203.0.113.1",
    "203.0.113.2", "10.0.0.1", "10.0.0.2", "172.16.0.1", "172.16.0.2",
    "192.0.2.1", "192.0.2.2", "198.51.100.1", "198.51.100.2", "192.88.99.1",
    "192.88.99.2", "240.0.0.1", "240.0.0.2", "203.0.113.3", "203.0.113.4",
    "10.0.0.3", "10.0.0.4", "172.16.0.3", "172.16.0.4", "192.0.2.3",
    "192.0.2.4", "198.51.100.3", "198.51.100.4", "192.88.99.3", "192.88.99.4",
    "240.0.0.3", "240.0.0.4"
]

# Read the CSV file
file_path = 'report1710215971890.csv.gz'
df = pd.read_csv(file_path)

def extract_features(row):
    log = row['Raw Event Log']
    ip_pattern = re.compile(r'(\d+\.\d+\.\d+\.\d+)')
    ips = ip_pattern.findall(log)
    src_ip = ips[0] if ips else None
    dest_ip = ips[1] if len(ips) > 1 else None
    is_failed = int('failed' in log.lower() or 'error' in log.lower() or 'unauthorized' in log.lower())
    return src_ip, dest_ip, is_failed

df[['Src_IP', 'Dest_IP', 'IsFailed']] = df.apply(extract_features, axis=1, result_type="expand")

flat_df = df.explode('Src_IP').dropna(subset=['Src_IP'])
flat_df['Label'] = flat_df['IsFailed']

def ip_to_features(ip):
    if ip is not None:
        return [int(part) for part in ip.split('.')]
    else:
        return [0, 0, 0, 0]

flat_df['Src_IP_Features'] = flat_df['Src_IP'].apply(ip_to_features)
flat_df[['Src_Feature1', 'Src_Feature2', 'Src_Feature3', 'Src_Feature4']] = pd.DataFrame(flat_df['Src_IP_Features'].tolist(), index=flat_df.index)

flat_df['Dest_IP_Features'] = flat_df['Dest_IP'].apply(ip_to_features)
flat_df[['Dest_Feature1', 'Dest_Feature2', 'Dest_Feature3', 'Dest_Feature4']] = pd.DataFrame(flat_df['Dest_IP_Features'].tolist(), index=flat_df.index)

flat_df['Label'] = flat_df.apply(lambda row: 1 if row['Src_IP'] in known_malicious_ips else row['Label'], axis=1)

features = flat_df[['Src_Feature1', 'Src_Feature2', 'Src_Feature3', 'Src_Feature4', 'Dest_Feature1', 'Dest_Feature2', 'Dest_Feature3', 'Dest_Feature4']]
labels = flat_df['Label']

X_train, X_test, y_train, y_test = train_test_split(features, labels, test_size=0.2, random_state=42)

clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

y_pred = clf.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
report = classification_report(y_test, y_pred)

print(f"Random Forest Model Accuracy: {accuracy}")
print(f"Random Forest Classification Report:\n{report}")

iso_forest = IsolationForest(contamination=0.05, random_state=42)
iso_forest.fit(features)

iso_labels = iso_forest.predict(features)
iso_labels = [1 if label == -1 else 0 for label in iso_labels]

iso_labels_series = pd.Series(iso_labels, index=features.index)
iso_malicious_ips = flat_df.loc[iso_labels_series == 1, 'Src_IP'].unique()
iso_malicious_table = pd.DataFrame({
    'IP Address': iso_malicious_ips,
    'Status': 'Malicious (Isolation Forest)'
})

print("Malicious IPs detected by Isolation Forest:")
print(iso_malicious_table)

combined_malicious_ips = set(iso_malicious_ips).union(set(flat_df.loc[iso_labels_series == 1, 'Src_IP'].unique()))

combined_malicious_table = pd.DataFrame({
    'IP Address': list(combined_malicious_ips),
    'Status': 'Malicious'
})

print("\nCombined Malicious IPs detected:")
print(combined_malicious_table)

ai_analysis_results = {
    'Random Forest Accuracy': accuracy,
    'Random Forest Report': report,
    'Isolation Forest Malicious IPs': iso_malicious_table.to_dict(orient='records'),
    'Combined Malicious IPs': combined_malicious_table.to_dict(orient='records')
}

with open('ai_analysis_results.json', 'w') as f:
    json.dump(ai_analysis_results, f, indent=4)

print("AI analysis results saved to ai_analysis_results.json")
