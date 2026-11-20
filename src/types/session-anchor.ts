/** Server session geo — H3 observations only (no raw GPS retention). */
export type SpatialSessionAnchorMeta = {
  session_id: string
  /** Triangulated or boot H3 used for this request. */
  anchor_h3: string | null
  observation_count: number
  /** Local mesh boot (`SPATIAL_AI_DEFAULT_H3_CELL`). */
  boot_h3: string | null
  /** Regional prior when mesh unset (`SPATIAL_AI_REGION_*`). */
  region_h3: string | null
}