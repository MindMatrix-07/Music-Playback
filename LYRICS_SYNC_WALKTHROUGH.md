# Manual Lyrics Sync Implementation

I have successfully implemented the manual synchronization feature for the lyrics module. This feature allows users to "anchor" the lyrics to the song's playback by tapping a lyric line at the exact moment they hear it.

## Key Changes

### 1. Virtual Internal Player
Added a set of state variables to manage a "virtual" playback timer:
- `virtualStartTime`: Anchors the start of the song relative to the system clock.
- `virtualSyncAnchored`: A flag indicating if the manual sync is active.
- `virtualTimerId`: Manages the interval that updates the lyric sync.

### 2. Manual Sync Logic (`seekTo`)
The `seekTo(time)` function now handles two scenarios:
- **Active Preview Audio**: If the internal `previewAudio` is playing, it simply seeks the audio element.
- **Manual Sync**: If no audio is playing (or it's an external player), it calculates the `virtualStartTime` based on the tapped line's timestamp and starts an internal timer to keep the lyrics scrolling.

### 3. Visual Feedback (`syncStatusBanner`)
Added a new UI element above the lyrics area:
- **Instructional**: Tells the user to "Tap a line below 👆 when you hear the vocals".
- **Confirmation**: Changes to "Lyrics synced! Tracking music internally..." when the user triggers the sync.
- **Dynamic**: Automatically hides when only plain lyrics are available or when a new search starts.

### 4. Robust Integration
Updated core lyrics functions for seamless behavior:
- `fetchLyrics`: Resets the virtual player whenever a new song is fetched.
- `switchLyricsTab`: Ensures the sync banner only appears on the "Synced" tab.
- `syncLyrics`: Now accepts time from either the `previewAudio` or the virtual timer.

## Verification
- [x] Verified HTML structure for the new banner.
- [x] Verified JavaScript logic for state management and timer handling.
- [x] Cleaned up temporary integration scripts.

You can now use the "Synced" tab to manually track lyrics for any song, providing a much smoother experience when the native player doesn't expose its progress.
