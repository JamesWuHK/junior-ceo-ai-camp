#!/usr/bin/env python3
"""Deploy teacher-auth cloud function to Tencent Cloud SCF"""
import os, sys, json, base64, zipfile, io, time

# Read credentials
with open(os.path.expanduser('~/.tccli/default.credential')) as f:
    creds = {}
    for line in f:
        line = line.strip()
        if '=' in line:
            k, v = line.split('=', 1)
            creds[k.strip()] = v.strip()

SECRET_ID = creds['secretId']
SECRET_KEY = creds['secretKey']
REGION = 'ap-beijing'
FUNCTION_NAME = 'teacher-auth-ceo-camp'

# Read function code
fn_dir = os.path.join(os.path.dirname(__file__), 'teacher-auth')
index_js = open(os.path.join(fn_dir, 'index.js')).read()

# Create zip
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('index.js', index_js)
zip_b64 = base64.b64encode(buf.getvalue()).decode()

print(f"Function code zipped: {len(buf.getvalue())} bytes")

# Import SDK
from tencentcloud.common import credential
from tencentcloud.common.profile.client_profile import ClientProfile
from tencentcloud.common.profile.http_profile import HttpProfile
from tencentcloud.scf.v20180416 import scf_client, models

cred = credential.Credential(SECRET_ID, SECRET_KEY)
httpProfile = HttpProfile()
httpProfile.endpoint = "scf.tencentcloudapi.com"
clientProfile = ClientProfile()
clientProfile.httpProfile = httpProfile
client = scf_client.ScfClient(cred, REGION, clientProfile)

# Step 1: Check if function exists
try:
    req = models.GetFunctionRequest()
    req.FunctionName = FUNCTION_NAME
    req.Namespace = 'default'
    resp = client.GetFunction(req)
    exists = True
    print(f"Function '{FUNCTION_NAME}' exists, updating...")
except Exception as e:
    if 'ResourceNotFound' in str(e):
        exists = False
        print(f"Function '{FUNCTION_NAME}' not found, creating...")
    else:
        print(f"Error checking function: {e}")
        sys.exit(1)

if exists:
    # Update function code
    req = models.UpdateFunctionCodeRequest()
    req.FunctionName = FUNCTION_NAME
    req.Namespace = 'default'
    req.Handler = 'index.main'
    req.ZipFile = zip_b64
    
    # Update env vars
    env_req = models.UpdateFunctionConfigurationRequest()
    env_req.FunctionName = FUNCTION_NAME
    env_req.Namespace = 'default'
    env_json = json.dumps({"Variables": [{"Key": "TEACHER_PASSWORD", "Value": "ceo2026"}]})
    env_req.Environment = models.Environment()
    env_req.Environment.from_json_string(env_json)
    
    resp = client.UpdateFunctionCode(req)
    print(f"Code updated: {resp.to_json_string()}")
    
    resp2 = client.UpdateFunctionConfiguration(env_req)
    print(f"Config updated")
else:
    # Create function
    req = models.CreateFunctionRequest()
    req.FunctionName = FUNCTION_NAME
    req.Namespace = 'default'
    req.Handler = 'index.main'
    req.Runtime = 'Nodejs18.15'
    req.Code = models.Code()
    req.Code.ZipFile = zip_b64
    req.Description = '少年CEO AI创业营 · 教师认证'
    req.MemorySize = 128
    req.Timeout = 3
    req.Role = 'SCF_QcsRole'
    env_json = json.dumps({"Variables": [{"Key": "TEACHER_PASSWORD", "Value": "ceo2026"}]})
    req.Environment = models.Environment()
    req.Environment.from_json_string(env_json)
    
    resp = client.CreateFunction(req)
    print(f"Function created: {resp.to_json_string()}")

# Step 2: Create HTTP trigger
try:
    trigger_req = models.CreateTriggerRequest()
    trigger_req.FunctionName = FUNCTION_NAME
    trigger_req.Namespace = 'default'
    trigger_req.TriggerName = 'http-trigger'
    trigger_req.Type = 'apigw'
    trigger_req.TriggerDesc = json.dumps({
        "api": {
            "authRequired": "FALSE",
            "requestConfig": {"method": "ANY"},
            "isIntegratedResponse": True
        }
    })
    resp = client.CreateTrigger(trigger_req)
    print(f"Trigger created: {resp.to_json_string()}")
except Exception as e:
    if 'already exists' in str(e).lower():
        print("HTTP trigger already exists")
    else:
        print(f"Trigger note: {e}")

# Step 3: Get the API URL
try:
    api_req = models.ListTriggersRequest()
    api_req.FunctionName = FUNCTION_NAME
    api_req.Namespace = 'default'
    resp = client.ListTriggers(api_req)
    data = json.loads(resp.to_json_string())
    for t in data.get('Triggers', []):
        desc = json.loads(t.get('TriggerDesc', '{}'))
        subdomain = desc.get('service', {}).get('subDomain', '')
        if subdomain:
            url = f"https://{subdomain}/release/"
            print(f"\n✅ 云函数已部署！")
            print(f"访问地址: {url}")
            print(f"\n请把这个 URL 更新到 camp-website/teacher.html 的 AUTH_URL 变量")
except Exception as e:
    print(f"\n✅ 函数已部署，请到控制台查看 HTTP 触发地址: https://console.cloud.tencent.com/scf/list?rid=1")
