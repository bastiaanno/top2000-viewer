#!/usr/bin/python3

import json
import requests

with open('songs-unpruned.json') as f:
    songs = json.load(f)

output = []
for song in songs['positions']:
    item = {'title': song['title'],
            'artist': song['artist'],
            'id': song['position'],
            'previous': song['lastPosition'],
            'image_id': song['imageUrl']}
    output.append(item)

with open('songs.json', 'w') as f:
    json.dump(output, f)

