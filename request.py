import requests
import random
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

p = {
    "iid": '7318518857994389254',
    "device_id": random.randint(7250000000000000000, 7351147085025500000),
    "version_code": "1337",
    "aweme_id": sys.argv[1]
}

u = "https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/"

try:
    t = 0
    r = requests.options(u, params=p)

    while r.status_code == 429 and t < 5:
        t+=1
        time.sleep(1)
        r = requests.options(u, params=p)

    sys.stdout.buffer.write(r.content)
except requests.exceptions.RequestException as e:
    pass