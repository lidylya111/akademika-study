AKADEMIKA STUDY — FIX FOR RAILWAY PERSISTENT STORAGE

1. Replace server.py in the existing GitHub repository with this file.
2. Do not create a new Railway project or a new Volume.
3. Keep the existing Volume mounted at /data.
4. Railway automatically provides RAILWAY_VOLUME_MOUNT_PATH=/data.
5. The app now always uses the Railway-provided mount path and refuses to start on Railway without a Volume, instead of silently storing students on ephemeral disk.
