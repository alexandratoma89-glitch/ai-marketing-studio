# Publishing the owner's videos

`/studio/publish` uploads and schedules the owner's **own** short vertical MP4/MOV videos to Instagram Reels, Facebook Page Reels, and YouTube Shorts, plus photos to Instagram and Facebook. TikTok is manual. This is a separate pipeline: Runway generation and its old Instagram queue remain locked. There are no AI-generation calls or automatic selection of sample/Runway videos.

## Workflow

1. Upload an MP4 or MOV: 5–150 seconds, maximum 150 MiB, portrait ratio 0.5–0.65, minimum 360×640. Recommend 1080×1920, H.264 video and AAC audio. The browser reads dimensions/duration; the server checks upload size, MIME type and the MP4/MOV or JPEG signature. Platform processing is the final codec/duration validator; the app does not transcode.
2. Preview the clip. Edit the title and caption before approval. Files upload directly to private Supabase Storage through a path-scoped, non-upserting upload URL, avoiding Vercel's request-body limit.
3. Select platforms, YouTube visibility/audience, and a time in Europe/Bucharest (or now). Confirm the footage is yours, not AI-generated, that you hold the rights to the video/audio, and that you approve the exact content and timing.
4. Approval freezes the asset and creates one job per selected platform/account. Each platform has independent progress and result links. The scheduler can prepare unpublished containers up to 15 minutes ahead, but never invokes Meta publish or completes a YouTube upload before the approved time. Provider processing and cron timing can delay actual appearance; exact publication to the second is not guaranteed.
5. Cancel a waiting job without affecting the other platforms. Working/completed/uncertain jobs cannot be silently canceled/reposted. A rejected step can be explicitly retried; uncertain outcomes require verification/recovery first.

Uploading is not publishing. No real video was uploaded or published while building/testing this feature. Tests use synthetic local MP4, MOV, PNG and HEIC fixtures and mocked provider responses.

## Database and storage

Apply `supabase/migrations/202611110009_own_video_publishing.sql` in the existing project **after Instagram migration 004 and social-connections migration 006**. It creates RLS-protected upload/publication tables and extends social OAuth storage with verified scope grants. Existing connections remain, but Facebook/YouTube grants default empty until reconnection.

For projects already running migration 009, apply `supabase/migrations/202611120010_own_video_duration.sql` to expand the duration constraint from 60 to 150 seconds. New setups should apply both 009 and 010 in order.

Create a **private** Storage bucket named `own-videos`, with allowed MIME types `video/mp4`, `video/quicktime`, `image/jpeg` and file-size limit **157286400** bytes (150 MiB). Do not make it public or reuse `runway-videos`. The preflight rejects public buckets, unsupported MIME allowlists and size limits smaller than the selected file. A larger bucket limit is allowed; the app and database still enforce 150 MiB for videos and 8 MiB for the prepared JPEG. Keep original content immutable; do not overwrite Storage objects or rotate encryption keys without a migration/reconnection plan.

No public storage policies are needed. Server-only service-role credentials create signed upload/download URLs. Object paths are generated as `<uuid>/video.mp4`, `<uuid>/video.mov`, or `<uuid>/photo.jpg`. Provider source URLs last one hour, owner previews five minutes. Those source links are intentionally shared only with the chosen provider for ingestion. Tokens and YouTube resumable-session URLs are encrypted using the existing social key; they do not appear in overview responses.

Production settings:

```
OWN_VIDEOS_DATABASE_READY=true
OWN_VIDEOS_ENABLED=true
OWN_VIDEOS_INSTAGRAM_ENABLED=false
OWN_VIDEOS_FACEBOOK_ENABLED=false
OWN_VIDEOS_YOUTUBE_ENABLED=false
```

Keep all three platform flags false until connections are ready. Enable and test **one platform at a time** with an owner-supplied clip and deliberate approval. The global flag also makes subsequent Facebook/YouTube OAuth requests ask for publishing scopes. Existing server-only Supabase settings, Instagram app/key settings, `SOCIAL_TOKEN_ENCRYPTION_KEY`, and relevant provider app credentials are reused. No secret goes into chat or a `NEXT_PUBLIC_` variable.

## Provider connections

- **Instagram @divinework.store:** existing Instagram Login requires `instagram_business_basic` and `instagram_business_content_publish`, already verified by the code-exchange flow. Reconnect if expired/revoked. This pipeline uses the owner's upload, never the old Runway queue. The API account must support content publishing; Meta determines any app-role/review/access requirements.
- **Facebook Page @divinework.store:** add `pages_manage_posts` in the Meta app alongside `pages_show_list` and `pages_read_engagement`, then reconnect through `/studio/social` **after** global own-video enablement. The Page is selected by exact `FACEBOOK_PAGE_ID` and verified with `/me` before provider operations. The existing read-only token alone is insufficient. No messaging/comment permissions are used here.
- **YouTube @divine-work:** enable YouTube Data API v3 in the Google Cloud project, configure its OAuth consent screen/authorized test users and existing callback `https://www.thedivinework.com/api/studio/social/youtube/callback`, and reconnect with `youtube.readonly` plus `youtube.upload`. Grant offline access for scheduled token refresh. The token must identify exactly one channel matching the approved account ID; ambiguous channel ownership is rejected before uploading. OAuth Testing refresh tokens can expire; reconnect as required.
- Google may require OAuth verification and a YouTube API compliance audit. Uploads from unaudited projects may remain private even if public was requested. The app verifies actual channel, processing and visibility after upload and shows **restricted**, not a successful public post, when visibility differs. It does not try to evade that restriction or silently change visibility.
- **TikTok:** no publishing adapter, jobs, permissions escalation or cron calls are added. Upload manually.

The first YouTube test should request **private**, notifications off. Once account/project permissions and behavior are verified, the owner may explicitly select public or unlisted on later approvals. Meta Reels are public when their approved publish step succeeds.

## Scheduler

`vercel.json` adds `/api/jobs/own-videos` every minute. The route requires the existing `CRON_SECRET` (at least 32 characters) and the global enable flag. Minute cron requires an appropriate Vercel plan; verify the deployed Cron Jobs page and an actual execution. Presence of the secret alone does not prove the scheduler is running.

Each invocation processes up to three independently leased steps concurrently, with a 120-second function budget. YouTube transfers at most 32 MiB per upload step and resumes the same session on subsequent steps. Keep Vercel function-duration/memory limits and Supabase storage limits aligned. Manual **Procesează programările scadente** processes one already approved step, not an unapproved upload.

## Recovery and duplicate protection

SQL row locks and unique video/platform/account keys prevent double approval and concurrent claims of the same target. Approval records exact copy, target account, visibility, audience and time. Editing after approval is rejected. A later reconnection to another account blocks the old approved target rather than posting somewhere else.

Every potentially ambiguous provider mutation persists intent first. Lost responses, interrupted leases and unacknowledged persistence become **uncertain**; no blind re-post is performed. Encrypted checkpoints preserve known IDs/sessions.

- Instagram lost publication responses cannot always resolve a permalink automatically: inspect the profile; the app will not call `media_publish` again for an uncertain result.
- Facebook recovery reads the known Reel's publishing status. It never repeats finish to guess the outcome.
- YouTube recovery queries the existing resumable upload session. A completed upload resumes verification; confirmed partial progress can resume that same session at the acknowledged offset. It never creates a new upload session to recover a potentially published video.

HTTP provider rejections are recorded with fixed error codes. Raw provider bodies, access/refresh tokens, service keys and upload-session URLs are not logged/returned to the owner page. Failed/read-only verification may be retried explicitly. Publication status uses provider confirmation rather than merely successful upload initiation.

Before disconnecting an account, cancel its queued/waiting jobs in the owner's library. Disconnection removes access; remaining approved jobs will fail safely if credentials disappear. Storage cleanup and provider-side deletion/revocation are manual owner tasks in this version. No provider post is deleted by local cancellation or disconnect.

## Verification evidence and limits

Automated tests cover the actual SQL migration/RLS, source isolation, immutable approval, exclusive leases, future/canceled times, DST gaps/ambiguity, all three mocked provider flows, lost publication acknowledgements, YouTube visibility restrictions/recovery, scope upgrade persistence, private-storage validation, CSRF and private Studio routes. A synthetic MP4 browser fixture exercises direct upload, preview, and approval of only the selected platform.

External Supabase uploads, new OAuth grants, cron executions and real posts still require account setup and the owner's first approved clip. This work does not claim those are complete.

Provider contracts checked against official SDK/discovery files:
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py (`video_reels`, start/finish and `is_ai_generated`)
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/advideo.py (`PUBLISHED` state)
- https://github.com/googleapis/google-api-python-client/blob/main/googleapiclient/discovery_cache/documents/youtube.v3.json (upload scopes, resumable protocol, visibility/audience/synthetic-media fields)

## Two Instagram profiles

Apply migration `202611120011_multiple_instagram_accounts.sql` after 009 and 010. It preserves the existing @divinework.store authorization, adds separate encrypted credentials for @travelmellon, and changes publication uniqueness to video/platform/account. Register this additional Instagram Login redirect URI in the same Meta app (keep the existing one too):

`https://www.thedivinework.com/api/studio/publish/instagram/callback`

Use the two named connect buttons on `/studio/publish`. Each requested username is bound to the expiring, single-use OAuth state; authorizing the wrong profile is rejected. Both accounts must be professional Instagram Business or Creator profiles and have the required app access/tester role or approved app permissions. Connecting @travelmellon does not replace @divinework.store. Select either profile or both explicitly on each approval; no default cross-post to the second profile is added. Each target has its own result and cancellation. Tokens stay server-side. Disconnect cancels queued/waiting jobs for that profile; Meta signed revocation also removes its credentials and related publication records. Active provider requests may already be in progress when disconnect is requested.

The old Instagram/Runway queue remains locked and single-account. Use the owner's publishing page to manage these two connections.

## Larger uploads

Apply `202611120012_own_video_size.sql` after 011. Set the private `own-videos` bucket file-size limit to **157286400 bytes (150 MiB)** and retain its explicit MIME allowlist (extend it as below for MOV/photos). The project-wide Storage maximum must also allow at least this size. Supabase Free limits uploads to 50 MB, so 150 MB uploads require a supporting paid Supabase plan. Changing the bucket alone does not override the project-wide limit. No plan upgrades are performed by this code. Browser uploads still go directly to Storage, bypassing Vercel's body-size cap.

## iPhone MOV and photos

Apply `202611120013_own_photos_mov.sql` after 012. Existing MP4 uploads and approved jobs retain their paths and video defaults. Extend the private bucket allowlist to exactly:

```
video/mp4
video/quicktime
image/jpeg
```

The picker accepts MP4, MOV, JPEG/JPG, PNG and HEIC/HEIF. MOV remains MOV; no video transcoding is performed. Video metadata must be readable by the browser (Safari may be needed for some iPhone HEVC files). Provider codec validation still applies; an unsupported codec may need an H.264 export.

Photos are decoded in the browser, with a lazily loaded local `heic2any` decoder when native HEIC decoding is unavailable. No photo is sent to an external conversion service. The browser produces a static JPEG canvas at 1080×1350: the full image is contained without cropping, with black margins when necessary. Only this prepared JPEG is uploaded; the owner must review it before approving. JPEG export strips source metadata. HEIC Live Photos/multi-image files produce one still photo. Unreadable HEICs show an explicit JPEG-export fallback. Photos are limited to 8 MiB after conversion and cannot target YouTube (rejected in UI, API, SQL and worker).

Instagram photos use unpublished image containers followed by the approved publication step. Facebook photos use the Page photos endpoint at the approved time. Each account's state and uncertain-result protection remain independent. A lost Facebook photo publish response never causes a blind second photo post.

Synthetic photo fixtures are a locally generated 64×80 purple image, encoded with ImageMagick (PNG) and Pillow/pillow-heif (HEIC). No user media or externally sourced photographs are included in tests.

## Upload progress and recovery

YouTube's HTTP 308 responses are upload progress, even when they include a `Location` header. The worker reads their `Range` without following redirects or forwarding credentials elsewhere. HTTP redirects from mutations on other endpoints remain uncertain. Recovery network errors preserve the uncertain checkpoint and cannot become blind retries. Upload checkpoints from earlier releases are probed against the same resumable session before sending more file bytes; an already complete session proceeds directly to verification. No new YouTube upload session is created for that recovery.

Facebook's upload and processing phases are distinct. Once `uploading_phase.status` is `complete`, the worker can issue the already-approved finish step, even when processing has not started yet. It then waits for confirmed publication. Waiting for processing before finish can deadlock some Reels.
