import os
import google.oauth2.credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Authentication details from environment variables
CLIENT_ID = os.environ.get('YOUTUBE_CLIENT_ID')
CLIENT_SECRET = os.environ.get('YOUTUBE_CLIENT_SECRET')
REFRESH_TOKEN = os.environ.get('YOUTUBE_REFRESH_TOKEN')

# Video metadata
VIDEO_TITLE = os.environ.get('VIDEO_TITLE', '1-Hour Spinning Meme')
VIDEO_DESC = os.environ.get('VIDEO_DESC', 'Created with Spinning Meme Generator')
VIDEO_TAGS = os.environ.get('VIDEO_TAGS', '').split(',')

def get_authenticated_service():
    if not CLIENT_ID or not CLIENT_SECRET or not REFRESH_TOKEN:
        print("Missing YouTube credentials. Skipping upload (Mock success).")
        return None

    credentials = google.oauth2.credentials.Credentials(
        None,
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        refresh_token=REFRESH_TOKEN,
        token_uri="https://oauth2.googleapis.com/token",
    )
    return build('youtube', 'v3', credentials=credentials)

def upload_video(youtube):
    if not youtube:
        return
        
    print(f"Starting upload for: {VIDEO_TITLE}")
    
    body = {
        'snippet': {
            'title': VIDEO_TITLE,
            'description': VIDEO_DESC,
            'tags': [tag.strip() for tag in VIDEO_TAGS if tag.strip()],
            'categoryId': '23' # Comedy
        },
        'status': {
            'privacyStatus': 'private', # Private by default for safety
            'selfDeclaredMadeForKids': False,
        }
    }
    
    media = MediaFileUpload('output.mp4', chunksize=-1, resumable=True)
    
    request = youtube.videos().insert(
        part=','.join(body.keys()),
        body=body,
        media_body=media
    )
    
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Uploaded {int(status.progress() * 100)}%")
            
    print(f"Video uploaded successfully! Video ID: {response.get('id')}")

if __name__ == '__main__':
    youtube = get_authenticated_service()
    upload_video(youtube)
