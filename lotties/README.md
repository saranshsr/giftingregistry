# Gift Registry lotties

Every lottie in the Gift Registry creation flow (01), in flow order. Each step folder has `lottie/` (dotLottie, WebP images, smallest: use this in the app) and `json/` (plain Lottie JSON, for lottie-web or LottieFiles).

| Folder | Screen | Files |
|---|---|---|
| 01 | 0.4 What is a Gift Registry (explainer) | 1 |
| 02 | 1.1 Occasion | 8: default + 7 occasions |
| 03 | 2.3 Whose is it | 7 occasions |
| 04 | Name your registry | 7 occasions |
| 05 | 1.3 When is it | 7 occasions |
| 06 | 2.5 Due date | Baby shower only |
| 07 | 1.4 Delivery details | 7 occasions |
| 08 | Registry empty state | 1, loops (8 s) |

Occasions: eid, birthday, baby-shower, wedding, house-warming, anniversary, other. File names read `gr-hero-<screen>-<occasion>`.

All heroes are exported with no background; the backgrounds are separate static images. These are copies; the source exports live in `occasions/export/` and `v2/proto/lottie/`, so re-copy after a re-export.
