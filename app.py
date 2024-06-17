from flask import Flask, render_template, jsonify
import subprocess
import json

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/train')
def train():
    subprocess.call(['python', 'ai.py'])
    return 'Training started! Check the console for output.'

@app.route('/results')
def results():
    with open('ai_analysis_results.json', 'r') as f:
        ai_analysis_results = json.load(f)
    return jsonify(ai_analysis_results['Combined Malicious IPs'])

if __name__ == '__main__':
    app.run(debug=True)
