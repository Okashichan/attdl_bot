import requests
import random
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

p = {
    "iid": '7318518857994389254',
    "device_id": random.randint(7250000000000000000, 7351147085025500000),
    "version_code": "1337",
    "aweme_id": sys.argv[1]
}

u = "https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/"

try:
    r = requests.options(u, params=p)
    print(json.dumps(r.json()))
except requests.exceptions.RequestException as e:
    pass
